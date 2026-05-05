const fs = require('fs');
const path = require('path');

// ============================================================
// 智能 HTML 解析器 - 正确处理嵌套标签
// ============================================================

/**
 * 从指定位置开始，找到匹配的闭合 div 标签
 * 正确处理嵌套
 */
function findMatchingClose(html, startIdx) {
  let depth = 0;
  let i = startIdx;
  while (i < html.length) {
    if (html.startsWith('<div', i)) {
      depth++;
      i += 4;
    } else if (html.startsWith('</div>', i)) {
      depth--;
      if (depth === 0) return i;
      i += 6;
    } else {
      i++;
    }
  }
  return -1;
}

/**
 * 提取 div 的内部 HTML（从开始标签结束到闭合标签开始）
 */
function extractDivContent(html, openTagStart) {
  // 找到开始标签的结束 >
  const tagEnd = html.indexOf('>', openTagStart);
  if (tagEnd === -1) return null;
  const contentStart = tagEnd + 1;
  
  // 找到匹配的 </div>
  const closeStart = findMatchingClose(html, openTagStart);
  if (closeStart === -1) return null;
  
  return { content: html.slice(contentStart, closeStart), end: closeStart + 6 };
}

// ============================================================
// 解析子页面
// ============================================================

function parseSubPage(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const html = fs.readFileSync(filePath, 'utf8');
  
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  let css = styleMatch ? styleMatch[1] : '';
  
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, '.html');
  
  // 提取 <script> 内容（某些效果需要 JS）
  const scripts = [];
  const scriptRegex = /<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/g;
  let sm;
  while ((sm = scriptRegex.exec(html)) !== null) {
    const content = sm[2].trim();
    if (content && !content.includes('copy-effect')) {
      scripts.push(content);
    }
  }
  
  const effects = [];
  
  // ===== 策略 A: <div class="card"><h3>名</h3><span class="tag">标签</span><div class="stage">...嵌套HTML...</div></div>
  {
    const marker = '<div class="card"><h3>';
    let pos = 0;
    while ((pos = html.indexOf(marker, pos)) !== -1) {
      // 提取整个 card 的内容
      const cardResult = extractDivContent(html, pos);
      if (!cardResult) { pos++; continue; }
      const cardInner = cardResult.content;
      
      // 从 cardInner 提取 h3
      const h3Match = cardInner.match(/^<h3>([^<]+)<\/h3>/);
      if (!h3Match) { pos = cardResult.end; continue; }
      const name = h3Match[1].trim();
      
      // 提取 tag
      const tagMatch = cardInner.match(/<span class="tag">([^<]*)<\/span>/);
      const tag = tagMatch ? tagMatch[1].trim() : '';
      
      // 提取 stage 内容
      const stageIdx = cardInner.indexOf('<div class="stage">');
      if (stageIdx !== -1) {
        const stageResult = extractDivContent(cardInner, stageIdx);
        if (stageResult) {
          effects.push({ name, tag, stageHtml: stageResult.content });
        }
      } else {
        // 没有 stage 包裹 - 提取 tag 之后的所有内容
        const afterTag = cardInner.indexOf('</span>');
        if (afterTag !== -1) {
          let content = cardInner.slice(afterTag + 7).trim();
          // 移除末尾的 <p class="hint">...</p>
          content = content.replace(/<p class="hint">[^<]*<\/p>\s*$/, '').trim();
          if (content) {
            effects.push({ name, tag, stageHtml: content });
          }
        }
      }
      
      pos = cardResult.end;
    }
  }
  
  if (effects.length > 0) return { css, title, effects, scripts, structure: 'A/B' };
  
  // ===== 策略 C: <div class="card"><div class="stage...">...HTML...</div><div class="card-info"><h3>名</h3>...
  {
    const marker = '<div class="card">';
    let pos = html.indexOf('<div class="grid">');
    if (pos === -1) pos = 0;
    
    while ((pos = html.indexOf(marker, pos)) !== -1) {
      const cardResult = extractDivContent(html, pos);
      if (!cardResult) { pos++; continue; }
      const cardInner = cardResult.content;
      
      // 检查是否以 <div class="stage 开头
      const stageMatch = cardInner.match(/^\s*<div class="stage([^"]*)"([^>]*)>/);
      if (!stageMatch) { pos = cardResult.end; continue; }
      
      const stageClass = stageMatch[1].trim();
      const stageAttrs = stageMatch[2].trim();
      
      // 提取 stage 内容
      const stageStart = cardInner.indexOf('<div class="stage');
      const stageResult = extractDivContent(cardInner, stageStart);
      if (!stageResult) { pos = cardResult.end; continue; }
      
      // 提取 card-info
      const h3Match = cardInner.match(/<h3>([^<]+)<\/h3>/);
      const tagMatch = cardInner.match(/<span class="tag">([^<]*)<\/span>/);
      
      if (h3Match) {
        effects.push({
          name: h3Match[1].trim(),
          tag: tagMatch ? tagMatch[1].trim() : '',
          stageHtml: stageResult.content,
          stageClass,
          stageAttrs
        });
      }
      
      pos = cardResult.end;
    }
  }
  
  if (effects.length > 0) return { css, title, effects, scripts, structure: 'C' };
  
  return { css, title, effects: [], scripts, structure: 'none' };
}

// 清理 CSS
function cleanCss(css) {
  return css
    .replace(/\s*\*[\s,]*\*::before[\s\S]*?\}/g, '')
    .replace(/\s*body\s*\{[^}]*\}/g, '')
    .replace(/\s*h1\s*\{[^}]*\}/g, '')
    .replace(/\s*\.subtitle\s*\{[^}]*\}/g, '')
    .replace(/\s*\.grid\s*\{[^}]*\}/g, '')
    .replace(/\s*\.hint\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card:hover\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card h3\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card \.tag\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card-info\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card-info h3\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card-info \.tag\s*\{[^}]*\}/g, '')
    .replace(/\s*\.card-info p\s*\{[^}]*\}/g, '');
}

// ============================================================
// 扫描所有子页面
// ============================================================
const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => /^\d{2}-.*\.html$/.test(f))
  .sort();

console.log(`Found ${files.length} sub-pages\n`);

const parsedCategories = [];
const iframeCategories = [];
let totalEffects = 0;

for (const file of files) {
  const result = parseSubPage(path.join(dir, file));
  if (!result) continue;
  
  const catId = file.replace('.html', '');
  const cleanTitle = result.title
    .replace(/集$/, '')
    .replace(/效果$/, '')
    .replace(/\d+\s*[·\-]\s*/, '')
    .replace(/\s*\|.*$/, '')
    .trim();
  
  if (result.effects.length > 0) {
    parsedCategories.push({
      id: catId,
      file,
      title: cleanTitle,
      css: cleanCss(result.css),
      effects: result.effects,
      scripts: result.scripts,
      structure: result.structure
    });
    totalEffects += result.effects.length;
    console.log(`✓ ${file}: ${result.effects.length} effects (${result.structure})`);
  } else {
    iframeCategories.push({ id: catId, file, title: cleanTitle });
    totalEffects += 1;
    console.log(`◆ ${file}: iframe mode (${cleanTitle})`);
  }
}

const totalCategories = parsedCategories.length + iframeCategories.length;
console.log(`\n✅ Total: ${totalEffects} effects from ${totalCategories} categories`);
console.log(`   Parsed: ${parsedCategories.length} categories (multi-card)`);
console.log(`   Iframe: ${iframeCategories.length} categories (single-card)`);

// ============================================================
// 验证 HTML 完整性
// ============================================================
let htmlErrors = 0;
for (const cat of parsedCategories) {
  for (const eff of cat.effects) {
    const opens = (eff.stageHtml.match(/<div/g) || []).length;
    const closes = (eff.stageHtml.match(/<\/div>/g) || []).length;
    if (opens !== closes) {
      console.log(`  ⚠️ HTML mismatch in ${cat.file} > "${eff.name}": ${opens} opens vs ${closes} closes`);
      htmlErrors++;
    }
  }
}
if (htmlErrors === 0) console.log(`\n✓ All HTML structures validated (no mismatched divs)`);
else console.log(`\n⚠️ ${htmlErrors} HTML structure issues found`);

// ============================================================
// 生成侧边栏
// ============================================================
const dotColors = ['#2997ff','#bf5af2','#30d158','#ff453a','#ff6482','#64d2ff','#5e5ce6','#fb923c','#ffd60a','#ac8e68'];

let sidebarItems = '';
let allCats = [...parsedCategories.map(c => ({...c, type: 'parsed'})), ...iframeCategories.map(c => ({...c, type: 'iframe'}))];
allCats.sort((a, b) => a.file.localeCompare(b.file));

allCats.forEach((cat, i) => {
  const active = i === 0 ? ' active' : '';
  const dot = dotColors[i % dotColors.length];
  const count = cat.type === 'parsed' ? cat.effects.length : 1;
  sidebarItems += `    <button class="filter-item${active}" data-cat="${cat.id}"><div class="dot" style="background:${dot}"></div>${cat.title}<span class="filter-count">${count}</span></button>\n`;
});

// ============================================================
// 生成卡片 HTML
// ============================================================
let allCards = '';

for (const cat of parsedCategories) {
  for (const eff of cat.effects) {
    const stageAttrs = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
    const stageClass = eff.stageClass ? ` ${eff.stageClass}` : '';
    allCards += `    <a class="card" data-cat="${cat.id}" href="${cat.file}" target="_blank">
      <div class="card-visual"><div class="stage${stageClass}"${stageAttrs}>${eff.stageHtml}</div></div>
      <div class="card-content"><h3>${eff.name}</h3></div>
      <div class="card-footer"><span class="tag">${eff.tag}</span></div>
    </a>\n`;
  }
}

for (const cat of iframeCategories) {
  allCards += `    <a class="card card-iframe" data-cat="${cat.id}" href="${cat.file}" target="_blank">
      <div class="card-visual"><iframe src="${cat.file}" loading="lazy" sandbox="allow-scripts" scrolling="no"></iframe></div>
      <div class="card-content"><h3>${cat.title}</h3></div>
      <div class="card-footer"><span class="tag">全屏展示 · 点击查看</span></div>
    </a>\n`;
}

// ============================================================
// 合并所有 CSS
// ============================================================
let allCss = '';
for (const cat of parsedCategories) {
  allCss += `\n/* ===== ${cat.title} (${cat.file}) ===== */\n${cat.css}\n`;
}

// ============================================================
// 输出最终 HTML
// ============================================================
const firstCatId = allCats[0]?.id || '';

const finalHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bの宝库</title>
<style>
/* === Base Reset & Layout === */
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{background:#0a0a0f;color:#f5f5f7;font-family:'SF Pro Display','SF Pro Text',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;min-height:100vh;overflow-x:hidden;line-height:1.47}
.app-layout{display:flex;min-height:100vh}

/* === Sidebar === */
.sidebar{position:fixed;top:0;left:0;bottom:0;width:220px;background:rgba(10,10,12,.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-right:1px solid rgba(255,255,255,.06);z-index:1000;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
.sidebar::-webkit-scrollbar{width:4px}
.sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.sidebar-header{padding:24px 20px 20px;border-bottom:1px solid rgba(255,255,255,.06)}
.sidebar-logo{font-size:1.3rem;font-weight:800;letter-spacing:-.02em;color:#f5f5f7}
.sidebar-logo span{background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sidebar-sub{font-size:.68rem;color:rgba(255,255,255,.3);margin-top:4px;letter-spacing:.02em}
.sidebar-nav{padding:12px 12px;flex:1}
.filter-item{display:flex;align-items:center;gap:10px;width:100%;padding:7px 12px;border:none;background:transparent;color:rgba(255,255,255,.55);font-size:.75rem;border-radius:8px;cursor:pointer;transition:all .2s;text-align:left;font-family:inherit}
.filter-item:hover{background:rgba(255,255,255,.05);color:rgba(255,255,255,.85)}
.filter-item.active{background:rgba(255,255,255,.08);color:#f5f5f7;font-weight:600}
.filter-item .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.filter-item .filter-count{margin-left:auto;font-size:.62rem;color:rgba(255,255,255,.25);font-weight:400}

/* === Main Content === */
.main-content{margin-left:220px;flex:1;min-width:0}
.hero{padding:44px 48px 24px;text-align:center}
.hero h1{font-size:2rem;font-weight:800;letter-spacing:-.03em}
.hero h1 em{font-style:normal;background:linear-gradient(135deg,#a78bfa 0%,#f472b6 50%,#fb923c 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-sub{color:rgba(255,255,255,.35);font-size:.82rem;margin-top:6px}
.grid-section{padding:0 24px 60px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;max-width:1600px;margin:0 auto}

/* === Cards === */
.card{position:relative;background:#13131a;border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;transition:all .35s cubic-bezier(.4,0,.2,1);opacity:0;transform:translateY(16px);display:none;flex-direction:column}
.card.visible{opacity:1;transform:translateY(0)}
.card.show{display:flex}
.card:hover{border-color:rgba(255,255,255,.12);transform:translateY(-3px);box-shadow:0 16px 32px rgba(0,0,0,.4)}
.card-visual{width:100%;height:180px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#0a0a12}
.card-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px}
.card-visual iframe{width:166%;height:166%;border:none;pointer-events:none;transform:scale(.6);transform-origin:center center}
.card-content{padding:10px 16px 4px}
.card-content h3{font-size:.8rem;font-weight:600;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-footer{padding:0 16px 10px;display:flex;align-items:center;gap:8px}
.card-footer .tag{font-size:.6rem;padding:2px 8px;border-radius:20px;background:rgba(102,126,234,.1);color:#667eea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}

/* === Favorites === */
.fav-btn{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;z-index:5;opacity:0}
.card:hover .fav-btn{opacity:1}
.fav-btn svg{width:13px;height:13px;fill:none;stroke:rgba(255,255,255,.5);stroke-width:2}
.fav-btn.active svg{fill:#ff3b30;stroke:#ff3b30}
.fav-btn.active{opacity:1}

/* === Mobile === */
.mobile-toggle{position:fixed;top:14px;left:14px;z-index:1100;width:36px;height:36px;border-radius:10px;background:rgba(30,30,34,.9);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08);align-items:center;justify-content:center;cursor:pointer;display:none}
.mobile-toggle svg{width:18px;height:18px;stroke:#f5f5f7;fill:none;stroke-width:2}
.footer{text-align:center;padding:30px 20px 24px;border-top:1px solid rgba(255,255,255,.04)}
.footer-note{font-size:.7rem;color:rgba(255,255,255,.18)}

@media(max-width:768px){
  .sidebar{position:fixed;left:-220px;transition:transform .3s ease}
  .sidebar.open{transform:translateX(220px)}
  .main-content{margin-left:0}
  .mobile-toggle{display:flex}
  .hero{padding:50px 20px 20px}
  .hero h1{font-size:1.5rem}
  .grid-section{padding:0 10px 40px}
  .card-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
  .card-visual{height:120px}
}

/* ============================================================
   Effect Styles (extracted from sub-pages)
   ============================================================ */
${allCss}
</style>
</head>
<body>
<div class="app-layout">

<div class="mobile-toggle" id="mobileToggle">
  <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
</div>

<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-logo"><span>B</span>の宝库</div>
    <div class="sidebar-sub">${totalEffects} Effects · Pure CSS/JS</div>
  </div>
  <nav class="sidebar-nav">
    <button class="filter-item" data-cat="fav"><div class="dot" style="background:#ff3b30"></div>我的收藏<span class="filter-count" id="countFav">0</span></button>
${sidebarItems}  </nav>
</aside>

<main class="main-content">
<section class="hero">
  <h1><em>Bの宝库</em></h1>
  <p class="hero-sub">纯前端效果收藏库 · 零依赖 · 开箱即用</p>
</section>

<section class="grid-section">
  <div class="card-grid">
${allCards}  </div>
</section>

<footer class="footer">
  <p class="footer-note">Bの宝库 — ${totalEffects} Effects · Zero Dependencies</p>
</footer>
</main>
</div>

<` + `script>
// Favorites
const FAV_KEY='bno_favorites';
function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch(e){return[];}}
function setFavs(arr){localStorage.setItem(FAV_KEY,JSON.stringify(arr));}
function toggleFav(id){const favs=getFavs();const idx=favs.indexOf(id);if(idx>-1)favs.splice(idx,1);else favs.push(id);setFavs(favs);return idx===-1;}
function updateFavCount(){const el=document.getElementById('countFav');if(el)el.textContent=getFavs().length;}

// Init cards
document.querySelectorAll('.card').forEach(card=>{
  const h3=card.querySelector('.card-content h3');
  if(!h3)return;
  const id=card.dataset.cat+'::'+h3.textContent;
  card.dataset.favId=id;
  const btn=document.createElement('div');
  btn.className='fav-btn'+(getFavs().includes(id)?' active':'');
  btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  btn.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    const isNow=toggleFav(id);
    btn.classList.toggle('active',isNow);
    updateFavCount();
    if(document.querySelector('.filter-item[data-cat="fav"].active')&&!isNow){
      card.classList.remove('show','visible');
    }
  });
  card.appendChild(btn);
});
updateFavCount();

// Filter
function filterCards(cat){
  const cards=document.querySelectorAll('.card');
  let visible=[];
  cards.forEach(card=>{
    let show=false;
    if(cat==='fav'){show=getFavs().includes(card.dataset.favId);}
    else{show=card.dataset.cat===cat;}
    card.classList.toggle('show',show);
    card.classList.remove('visible');
    if(show)visible.push(card);
  });
  visible.forEach((c,i)=>{setTimeout(()=>c.classList.add('visible'),Math.min(i*25,800));});
}

document.querySelectorAll('.filter-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.filter-item').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    filterCards(btn.dataset.cat);
    if(window.innerWidth<=768)document.getElementById('sidebar').classList.remove('open');
  });
});

// Default: show first category
filterCards('${firstCatId}');

// Mobile toggle
(function(){
  const toggle=document.getElementById('mobileToggle');
  const sidebar=document.getElementById('sidebar');
  if(!toggle||!sidebar)return;
  toggle.addEventListener('click',()=>sidebar.classList.toggle('open'));
  document.addEventListener('click',(e)=>{
    if(window.innerWidth<=768&&sidebar.classList.contains('open')&&!sidebar.contains(e.target)&&e.target!==toggle&&!toggle.contains(e.target))sidebar.classList.remove('open');
  });
})();
<` + `/script>
</body>
</html>`;

fs.writeFileSync('index.html', finalHtml);
console.log(`\n📄 index.html: ${(Buffer.byteLength(finalHtml)/1024).toFixed(1)} KB`);
