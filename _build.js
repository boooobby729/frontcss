const fs = require('fs');
const path = require('path');

// ============================================================
// 智能 HTML 解析器 - 正确处理嵌套标签
// ============================================================

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

function extractDivContent(html, openTagStart) {
  const tagEnd = html.indexOf('>', openTagStart);
  if (tagEnd === -1) return null;
  const contentStart = tagEnd + 1;
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

  // 策略 A/B
  {
    const marker = '<div class="card"><h3>';
    let pos = 0;
    while ((pos = html.indexOf(marker, pos)) !== -1) {
      const cardResult = extractDivContent(html, pos);
      if (!cardResult) { pos++; continue; }
      const cardInner = cardResult.content;

      const h3Match = cardInner.match(/^<h3>([^<]+)<\/h3>/);
      if (!h3Match) { pos = cardResult.end; continue; }
      const name = h3Match[1].trim();

      const tagMatch = cardInner.match(/<span class="tag">([^<]*)<\/span>/);
      const tag = tagMatch ? tagMatch[1].trim() : '';

      const stageIdx = cardInner.indexOf('<div class="stage">');
      if (stageIdx !== -1) {
        const stageResult = extractDivContent(cardInner, stageIdx);
        if (stageResult) {
          effects.push({ name, tag, stageHtml: stageResult.content });
        }
      } else {
        const afterTag = cardInner.indexOf('</span>');
        if (afterTag !== -1) {
          let content = cardInner.slice(afterTag + 7).trim();
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

  // 策略 C
  {
    const marker = '<div class="card">';
    let pos = html.indexOf('<div class="grid">');
    if (pos === -1) pos = 0;

    while ((pos = html.indexOf(marker, pos)) !== -1) {
      const cardResult = extractDivContent(html, pos);
      if (!cardResult) { pos++; continue; }
      const cardInner = cardResult.content;

      const stageMatch = cardInner.match(/^\s*<div class="stage([^"]*)"([^>]*)>/);
      if (!stageMatch) { pos = cardResult.end; continue; }

      const stageClass = stageMatch[1].trim();
      const stageAttrs = stageMatch[2].trim();

      const stageStart = cardInner.indexOf('<div class="stage');
      const stageResult = extractDivContent(cardInner, stageStart);
      if (!stageResult) { pos = cardResult.end; continue; }

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
    .replace(/\s*\.card-info p\s*\{[^}]*\}/g, '')
    // 清除 stage 自带的背景色
    .replace(/(\.stage[^{]*\{[^}]*)background\s*:[^;]+;/g, '$1')
    // 清除子页面 html 背景
    .replace(/\s*html\s*\{[^}]*\}/g, '')
    // 清除所有深色纯色背景（#0xx #1xx 系列，如 #0a0a0f #13131a #111 #000 等）
    .replace(/background(?:-color)?\s*:\s*#[0-1][0-9a-fA-F][0-9a-fA-F](?:[0-9a-fA-F]{3})?\s*(?:!important)?\s*;/gi, '')
    // 清除 rgb/rgba 三通道都极低的深色
    .replace(/background(?:-color)?\s*:\s*rgba?\(\s*(?:\d|[01]\d|2[0-9]|30)\s*,\s*(?:\d|[01]\d|2[0-9]|30)\s*,\s*(?:\d|[01]\d|2[0-9]|30)[^)]*\)\s*(?:!important)?\s*;/gi, '');
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
const collectFiles = []; // collect 合集：46+ 的文件
let totalEffects = 0;

for (const file of files) {
  const result = parseSubPage(path.join(dir, file));
  if (!result) continue;

  const catId = file.replace('.html', '');
  const num = parseInt(file.slice(0, 2), 10);
  const cleanTitle = result.title
    .replace(/集$/, '')
    .replace(/效果$/, '')
    .replace(/\d+\s*[·\-]\s*/, '')
    .replace(/\s*\|.*$/, '')
    .trim();

  // 46+ 的文件都归入 Collect 合集
  if (num >= 46) {
    collectFiles.push({ id: catId, file, title: cleanTitle, num });
    totalEffects += 1;
    console.log(`★ ${file}: collect (${cleanTitle})`);
  } else if (result.effects.length > 0) {
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

console.log(`\n✅ Total: ${totalEffects} effects from ${parsedCategories.length + iframeCategories.length} categories`);
console.log(`   Parsed: ${parsedCategories.length} | Iframe: ${iframeCategories.length}`);

// ============================================================
// 验证 HTML 完整性
// ============================================================
let htmlErrors = 0;
for (const cat of parsedCategories) {
  for (const eff of cat.effects) {
    const opens = (eff.stageHtml.match(/<div/g) || []).length;
    const closes = (eff.stageHtml.match(/<\/div>/g) || []).length;
    if (opens !== closes) {
      console.log(`  ⚠️  ${cat.file} > "${eff.name}": ${opens} opens vs ${closes} closes`);
      htmlErrors++;
    }
  }
}
if (htmlErrors === 0) console.log(`✓ All HTML structures validated`);

// ============================================================
// 排序
// ============================================================
const sortedParsed = [...parsedCategories].sort((a, b) => a.file.localeCompare(b.file));
const sortedIframe = [...iframeCategories].sort((a, b) => a.file.localeCompare(b.file));

// ============================================================
// 侧边栏导航（纯文字，无数字，无 dot）
// ============================================================
let sidebarItems = '';
sortedParsed.forEach((cat, i) => {
  const active = i === 0 ? ' active' : '';
  sidebarItems += `      <button class="filter-item${active}" data-cat="${cat.id}">${cat.title}</button>\n`;
});
sortedIframe.forEach(cat => {
  sidebarItems += `      <button class="filter-item" data-cat="${cat.id}">${cat.title}</button>\n`;
});
// Collect 合集作为一个分类
if (collectFiles.length > 0) {
  sidebarItems += `      <button class="filter-item" data-cat="collect">Collect</button>\n`;
}

// ============================================================
// 为每个 parsed 效果生成独立 HTML（放在 _effects/ 目录）
// ============================================================
const effectsDir = path.join(dir, '_effects');
if (fs.existsSync(effectsDir)) fs.rmSync(effectsDir, { recursive: true });
fs.mkdirSync(effectsDir);

let effectIndex = 0;
for (const cat of sortedParsed) {
  for (const eff of cat.effects) {
    effectIndex++;
    const fileName = `${String(effectIndex).padStart(3, '0')}.html`;
    const stageAttrs = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
    const stageClass = eff.stageClass ? ` stage${eff.stageClass}` : ' stage';
    const effectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${eff.name}</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.stage{width:100%;height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
${cat.css}
</style>
</head>
<body>
<div class="${stageClass.trim()}"${stageAttrs}>${eff.stageHtml}</div>
${cat.scripts.map(s => `<script>${s}<\/script>`).join('\n')}
</body>
</html>`;
    fs.writeFileSync(path.join(effectsDir, fileName), effectHtml);
    eff._file = `_effects/${fileName}`;
  }
}

// iframe 类效果直接用原文件
for (const cat of sortedIframe) {
  cat._file = cat.file;
}

console.log(`📁 Generated ${effectIndex} standalone effect files in _effects/`);

// ============================================================
// 卡片 HTML（点击全屏展示单个效果）
// ============================================================
let allCards = '';
for (const cat of sortedParsed) {
  for (const eff of cat.effects) {
    const stageAttrs = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
    const stageClass = eff.stageClass ? ` ${eff.stageClass}` : '';
    allCards += `      <div class="card" data-cat="${cat.id}" data-src="${eff._file}">
        <div class="card-visual"><div class="stage${stageClass}"${stageAttrs}>${eff.stageHtml}</div></div>
        <div class="card-info"><h3>${eff.name}</h3>${eff.tag ? `<span class="tag">${eff.tag}</span>` : ''}</div>
      </div>\n`;
  }
}

let iframeCards = '';
for (const cat of sortedIframe) {
  iframeCards += `      <div class="card card-iframe" data-cat="${cat.id}" data-src="${cat._file}">
        <div class="card-visual"><iframe src="${cat.file}" loading="lazy" sandbox="allow-scripts allow-same-origin" scrolling="no"></iframe></div>
        <div class="card-info"><h3>${cat.title}</h3></div>
      </div>\n`;
}

// Collect 合集卡片
let collectCards = '';
const sortedCollect = [...collectFiles].sort((a, b) => a.file.localeCompare(b.file));
for (const item of sortedCollect) {
  collectCards += `      <div class="card card-iframe" data-cat="collect" data-src="${item.file}">
        <div class="card-visual"><iframe src="${item.file}" loading="lazy" sandbox="allow-scripts allow-same-origin" scrolling="no"></iframe></div>
        <div class="card-info"><h3>${item.title}</h3></div>
      </div>\n`;
}

// ============================================================
// 合并 CSS
// ============================================================
let allCss = '';
for (const cat of sortedParsed) {
  allCss += `\n/* ${cat.title} */\n${cat.css}\n`;
}

// ============================================================
// 输出 HTML
// ============================================================
const firstCatId = sortedParsed[0]?.id || '';

const finalHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif;min-height:100vh;overflow-x:hidden}
a{text-decoration:none;color:inherit}

/* ── Layout ── */
.app-layout{display:flex;min-height:100vh}

/* ── Sidebar ── */
.sidebar{position:fixed;top:0;left:0;bottom:0;width:230px;background:rgba(6,6,6,.95);backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px);border-right:1px solid rgba(255,255,255,.06);z-index:100;display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:none}
.sidebar::-webkit-scrollbar{display:none}
.sidebar-header{padding:36px 20px 20px}
.sidebar-logo{font-size:1rem;font-weight:600;letter-spacing:-.02em;color:rgba(255,255,255,.9)}
.sidebar-nav{padding:4px 10px 40px;flex:1}
.nav-group{margin-bottom:20px}
.nav-label{font-size:.6rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.2);padding:0 10px;margin-bottom:1px;display:block}
.filter-item{display:block;width:100%;padding:5px 10px;border:none;background:transparent;color:rgba(255,255,255,.42);font-size:.75rem;font-weight:400;border-radius:5px;cursor:pointer;transition:color .12s,background .12s;text-align:left;font-family:inherit;letter-spacing:-.01em;line-height:1.4}
.filter-item:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.88)}
.filter-item.active{background:rgba(255,255,255,.1);color:#fff;font-weight:500}

/* ── Main ── */
.main-content{margin-left:230px;flex:1;min-width:0}
.page-header{padding:40px 32px 16px}
.page-title{font-size:1.75rem;font-weight:600;letter-spacing:-.03em;line-height:1;color:rgba(255,255,255,.9)}

/* ── Grid ── */
.grid-section{padding:0 0 80px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1px;background:rgba(255,255,255,.07)}

/* ── Card ── */
.card{position:relative;background:#111;color:inherit;opacity:0;transform:translateY(8px);display:none;flex-direction:column;transition:opacity .3s cubic-bezier(.4,0,.2,1),transform .3s cubic-bezier(.4,0,.2,1);cursor:pointer}
.card.visible{opacity:1;transform:none}
.card.show{display:flex}
.card:hover{background:#161616;z-index:1}
.card:hover .card-visual{background:#161616 !important}
.card:hover .card-visual .stage{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px;background:#111 !important}
.card-visual *{--bg-override:none}
.card-visual iframe{width:300%;height:300%;border:none;pointer-events:none;transform:scale(.3333);transform-origin:top left}
.card-info{padding:8px 12px 12px;background:#111}
.card-info h3{font-size:.72rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-info .tag{display:block;font-size:.62rem;color:rgba(255,255,255,.2);margin-top:1px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ── Fullscreen Overlay ── */
.effect-overlay{position:fixed;inset:0;z-index:9999;background:#111;display:none;flex-direction:column;align-items:center;justify-content:center}
.effect-overlay.open{display:flex}
.effect-overlay iframe{width:100%;height:100%;border:none}
.effect-overlay-close{position:fixed;top:20px;right:24px;z-index:10000;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}
.effect-overlay-close:hover{background:rgba(255,255,255,.2)}
.effect-overlay-close svg{width:14px;height:14px;stroke:#fff;stroke-width:2}

/* ── Fav ── */
.fav-btn{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .15s;z-index:5;opacity:0;border:none;padding:0}
.card:hover .fav-btn{opacity:1}
.fav-btn svg{width:12px;height:12px;fill:none;stroke:rgba(255,255,255,.55);stroke-width:2}
.fav-btn.active{opacity:1}
.fav-btn.active svg{fill:#ff3b30;stroke:#ff3b30}


/* ── Mobile ── */
.mobile-toggle{position:fixed;top:16px;left:16px;z-index:200;width:34px;height:34px;border-radius:8px;background:rgba(28,28,30,.85);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);align-items:center;justify-content:center;cursor:pointer;display:none;padding:0}
.mobile-toggle svg{width:15px;height:15px;stroke:#f5f5f7;fill:none;stroke-width:1.5}

@media(max-width:768px){
  .sidebar{left:-230px;transition:transform .3s cubic-bezier(.4,0,.2,1)}
  .sidebar.open{transform:translateX(230px)}
  .main-content{margin-left:0}
  .mobile-toggle{display:flex}
  .page-header{padding:56px 16px 20px}
  .page-title{font-size:1.5rem}
  .grid-section{padding:0 0 60px}
  .card-grid{grid-template-columns:repeat(2,1fr)}
}

/* ── Effect styles ── */
${allCss}
</style>
</head>
<body>
<div class="app-layout">

<button class="mobile-toggle" id="mobileToggle" aria-label="Menu">
  <svg viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
</button>

<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="sidebar-logo">Bの宝库</div>
  </div>
  <nav class="sidebar-nav">
    <div class="nav-group">
      <span class="nav-label">收藏</span>
      <button class="filter-item" data-cat="fav">我的收藏</button>
    </div>
    <div class="nav-group">
      <span class="nav-label">分类</span>
${sidebarItems}    </div>
  </nav>
</aside>

<main class="main-content">
  <header class="page-header">
    <h1 class="page-title">Bの宝库</h1>
  </header>

  <section class="grid-section">
    <div class="card-grid">
${allCards}${iframeCards}${collectCards}    </div>
  </section>
</main>
</div>

<div class="effect-overlay" id="effectOverlay">
  <button class="effect-overlay-close" id="overlayClose">
    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
  </button>
  <iframe id="overlayIframe" src="about:blank"></iframe>
</div>

<` + `script>
const FAV_KEY='bno_fav';
function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch(e){return[];}}
function setFavs(a){localStorage.setItem(FAV_KEY,JSON.stringify(a));}
function toggleFav(id){const f=getFavs();const i=f.indexOf(id);if(i>-1)f.splice(i,1);else f.push(id);setFavs(f);return i===-1;}

// Overlay logic
const overlay=document.getElementById('effectOverlay');
const overlayIframe=document.getElementById('overlayIframe');
const overlayClose=document.getElementById('overlayClose');
function openOverlay(src){overlayIframe.src=src;overlay.classList.add('open');document.body.style.overflow='hidden';}
function closeOverlay(){overlay.classList.remove('open');overlayIframe.src='about:blank';document.body.style.overflow='';}
overlayClose.addEventListener('click',closeOverlay);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))closeOverlay();});

// Fav buttons + card click
document.querySelectorAll('.card').forEach(card=>{
  const h3=card.querySelector('.card-info h3');
  if(!h3)return;
  const id=(card.dataset.cat||'fs')+'::'+h3.textContent;
  card.dataset.favId=id;
  const btn=document.createElement('button');
  btn.className='fav-btn'+(getFavs().includes(id)?' active':'');
  btn.setAttribute('aria-label','收藏');
  btn.innerHTML='<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  btn.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    const on=toggleFav(id);
    btn.classList.toggle('active',on);
    if(!on&&document.querySelector('.filter-item[data-cat="fav"].active')){
      card.classList.remove('show','visible');
    }
  });
  card.appendChild(btn);
  // Click card -> open overlay
  card.addEventListener('click',e=>{
    if(e.target.closest('.fav-btn'))return;
    const src=card.dataset.src;
    if(src)openOverlay(src);
  });
});

// Filter
function filterCards(cat){
  const cards=document.querySelectorAll('.card[data-cat]');
  const visible=[];
  cards.forEach(c=>{
    const show=cat==='fav'?getFavs().includes(c.dataset.favId):c.dataset.cat===cat;
    c.classList.toggle('show',show);
    c.classList.remove('visible');
    if(show)visible.push(c);
  });
  visible.forEach((c,i)=>setTimeout(()=>c.classList.add('visible'),Math.min(i*20,600)));
}

document.querySelectorAll('.filter-item').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.filter-item').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    filterCards(btn.dataset.cat);
    if(window.innerWidth<=768)document.getElementById('sidebar').classList.remove('open');
  });
});

filterCards('${firstCatId}');


// Mobile
(function(){
  const btn=document.getElementById('mobileToggle');
  const sb=document.getElementById('sidebar');
  if(!btn||!sb)return;
  btn.addEventListener('click',()=>sb.classList.toggle('open'));
  document.addEventListener('click',e=>{
    if(window.innerWidth<=768&&sb.classList.contains('open')&&!sb.contains(e.target)&&!btn.contains(e.target))
      sb.classList.remove('open');
  });
})();
<` + `/script>
</body>
</html>`;

fs.writeFileSync('index.html', finalHtml);
console.log(`\n📄 index.html: ${(Buffer.byteLength(finalHtml)/1024).toFixed(1)} KB`);
