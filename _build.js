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
    .replace(/(\.stage[^{]*\{[^}]*)background\s*:[^;]+;/g, '$1')
    .replace(/\s*html\s*\{[^}]*\}/g, '')
    .replace(/background(?:-color)?\s*:\s*#[0-1][0-9a-fA-F][0-9a-fA-F](?:[0-9a-fA-F]{3})?\s*(?:!important)?\s*;/gi, '')
    .replace(/background(?:-color)?\s*:\s*rgba?\(\s*(?:\d|[01]\d|2[0-9]|30)\s*,\s*(?:\d|[01]\d|2[0-9]|30)\s*,\s*(?:\d|[01]\d|2[0-9]|30)[^)]*\)\s*(?:!important)?\s*;/gi, '');
}

// ============================================================
// 提取 iframe 分类中的子效果列表
// ============================================================
function extractIframeEffects(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const effects = [];

  // 辅助：从 h2 内容中提取纯文本（去掉 span 等子标签）
  function cleanH2(raw) {
    return raw.replace(/<[^>]+>/g, '').replace(/^\d+\.\s*/, '').trim();
  }

  // 模式1: <section ... id="xxx" ...> ... <h2>标题</h2>
  const sectionRegex = /<section[^>]*id="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = sectionRegex.exec(html)) !== null) {
    const name = cleanH2(m[2]);
    if (name) effects.push({ id: m[1], name });
  }
  if (effects.length > 0) return effects;

  // 模式2: <div class="section ..." ...> ... <h2 ...>标题</h2>（允许换行，class可含额外类名）
  const divSectionRegex = /<div class="section[^"]*"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  while ((m = divSectionRegex.exec(html)) !== null) {
    const name = cleanH2(m[1]);
    if (name) effects.push({ id: '', name });
  }
  if (effects.length > 0) return effects;

  // 模式3: class="section" id="xxx" 带 id
  const sectionIdRegex = /<(?:div|section)[^>]*class="[^"]*section[^"]*"[^>]*id="([^"]*)"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/g;
  while ((m = sectionIdRegex.exec(html)) !== null) {
    const name = cleanH2(m[2]);
    if (name) effects.push({ id: m[1], name });
  }

  return effects;
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
const collectFiles = [];
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
    // iframe 分类：提取内部效果列表（section id + h2 标题）
    const iframeEffects = extractIframeEffects(path.join(dir, file));
    iframeCategories.push({ id: catId, file, title: cleanTitle, effects: iframeEffects });
    totalEffects += Math.max(iframeEffects.length, 1);
    console.log(`◆ ${file}: iframe mode (${cleanTitle}) - ${iframeEffects.length} sub-effects`);
  }
}

console.log(`\n✅ Total: ${totalEffects} effects from ${parsedCategories.length + iframeCategories.length + (collectFiles.length > 0 ? 1 : 0)} categories`);

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
const sortedCollect = [...collectFiles].sort((a, b) => a.file.localeCompare(b.file));

// 所有分类合并（用于首页展示）
const allCategories = [
  ...sortedParsed.map(c => ({ id: c.id, file: c.file, title: c.title, count: c.effects.length, type: 'parsed' })),
  ...sortedIframe.map(c => ({ id: c.id, file: c.file, title: c.title, count: c.effects.length, type: 'iframe' })),
];
if (sortedCollect.length > 0) {
  allCategories.push({ id: 'collect', file: null, title: 'Collect', count: sortedCollect.length, type: 'collect' });
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
console.log(`📁 Generated ${effectIndex} standalone effect files in _effects/`);

// ============================================================
// 生成导航栏 HTML/CSS/JS（所有页面共用）
// ============================================================
function generateNavItems(activeCatId, pathPrefix) {
  let items = '';
  for (const cat of allCategories) {
    const href = `${pathPrefix}_cat/${cat.id}.html`;
    const isActive = cat.id === activeCatId ? ' active' : '';
    items += `<a href="${href}" class="nav-item${isActive}" title="${cat.title}">${cat.title}</a>`;
  }
  return items;
}

const navCss = `
.site-nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(17,17,17,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.nav-inner{display:flex;align-items:center;height:48px;padding:0 16px;gap:8px}
.nav-logo{font-size:.85rem;font-weight:700;color:rgba(255,255,255,.9);white-space:nowrap;letter-spacing:-.02em;flex-shrink:0;text-decoration:none}
.nav-scroll-wrap{position:relative;flex:1;overflow:hidden;margin:0 4px}
.nav-scroll{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;scroll-behavior:smooth;padding:6px 0}
.nav-scroll::-webkit-scrollbar{display:none}
.nav-item{padding:5px 12px;border-radius:6px;font-size:.72rem;color:rgba(255,255,255,.45);white-space:nowrap;transition:all .15s;text-decoration:none;flex-shrink:0}
.nav-item:hover{color:rgba(255,255,255,.8);background:rgba(255,255,255,.06)}
.nav-item.active{color:#fff;background:rgba(255,255,255,.1)}
.nav-arrow{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .15s;color:rgba(255,255,255,.4)}
.nav-arrow:hover{background:rgba(255,255,255,.12);color:#fff}
.nav-arrow svg{width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none}
.nav-expand-btn{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .15s;color:rgba(255,255,255,.4)}
.nav-expand-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.nav-expand-btn svg{width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none;transition:transform .2s}
.nav-expand-btn.open svg{transform:rotate(180deg)}
.nav-dropdown{position:fixed;top:48px;left:0;right:0;z-index:199;background:rgba(17,17,17,.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06);padding:16px 20px;display:none;flex-wrap:wrap;gap:6px;max-height:60vh;overflow-y:auto}
.nav-dropdown.open{display:flex}
.nav-dropdown .nav-item{padding:8px 16px;font-size:.75rem}
`;

const navJs = `
(function(){
  var scroll=document.querySelector('.nav-scroll');
  var leftBtn=document.getElementById('navLeft');
  var rightBtn=document.getElementById('navRight');
  var expandBtn=document.getElementById('navExpand');
  var dropdown=document.getElementById('navDropdown');
  if(leftBtn)leftBtn.addEventListener('click',function(){scroll.scrollBy({left:-200,behavior:'smooth'})});
  if(rightBtn)rightBtn.addEventListener('click',function(){scroll.scrollBy({left:200,behavior:'smooth'})});
  if(expandBtn&&dropdown){
    expandBtn.addEventListener('click',function(){expandBtn.classList.toggle('open');dropdown.classList.toggle('open')});
    document.addEventListener('click',function(e){if(!expandBtn.contains(e.target)&&!dropdown.contains(e.target)){expandBtn.classList.remove('open');dropdown.classList.remove('open')}});
  }
  var active=scroll.querySelector('.nav-item.active');
  if(active)setTimeout(function(){active.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'})},100);
})();`;

function generateNavBar(activeCatId, pathPrefix) {
  const items = generateNavItems(activeCatId, pathPrefix);
  return `<nav class="site-nav">
  <div class="nav-inner">
    <a href="${pathPrefix}index.html" class="nav-logo">Bの宝库</a>
    <button class="nav-arrow" id="navLeft"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></button>
    <div class="nav-scroll-wrap"><div class="nav-scroll">${items}</div></div>
    <button class="nav-arrow" id="navRight"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></button>
    <button class="nav-expand-btn" id="navExpand"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>
  </div>
</nav>
<div class="nav-dropdown" id="navDropdown">${items}</div>`;
}

// ============================================================
// 共享 overlay 样式和脚本（调节面板 + 收藏功能）
// ============================================================
const overlayCss = `
.effect-overlay{position:fixed;inset:0;z-index:9999;background:#111;display:none;flex-direction:row}
.effect-overlay.open{display:flex}
.effect-overlay iframe{flex:1;height:100%;border:none}
.overlay-toolbar{position:fixed;top:16px;right:16px;z-index:10001;display:flex;gap:8px;align-items:center}
.overlay-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:rgba(255,255,255,.7)}
.overlay-btn:hover{background:rgba(255,255,255,.2);color:#fff}
.overlay-btn svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none}
.overlay-btn.fav-active{color:#f5576c;background:rgba(245,87,108,.15);border-color:rgba(245,87,108,.3)}
.overlay-btn.fav-active svg{fill:#f5576c;stroke:#f5576c}
.card.is-fav .card-info::after{content:'\\2665';position:absolute;top:8px;right:10px;color:#f5576c;font-size:.7rem}
.card-info{position:relative}
.ctrl-sidebar{width:240px;flex-shrink:0;background:rgba(17,17,17,.97);border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:6px;padding:56px 14px 14px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
.ctrl-sidebar::-webkit-scrollbar{width:4px}
.ctrl-sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.ctrl-sidebar .ctrl-title{font-size:.7rem;color:rgba(255,255,255,.6);font-weight:600;padding:0 4px 4px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:2px}
.ctrl-sidebar .ctrl-empty{font-size:.65rem;color:rgba(255,255,255,.25);text-align:center;padding:20px 0}
.ctrl-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.ctrl-card .ctrl-el-name{font-size:.6rem;color:rgba(255,255,255,.55);font-weight:600;letter-spacing:.02em;display:flex;align-items:center;gap:6px}
.ctrl-card .ctrl-el-name .ctrl-el-tag{font-size:.55rem;color:rgba(255,255,255,.25);font-weight:400}
.ctrl-card .ctrl-prop{display:flex;align-items:center;gap:8px;padding:3px 0}
.ctrl-card .ctrl-prop-label{font-size:.6rem;color:rgba(255,255,255,.35);min-width:44px;flex-shrink:0}
.ctrl-card .ctrl-prop input[type="range"]{flex:1;height:3px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.1);border-radius:2px;outline:none}
.ctrl-card .ctrl-prop input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#667eea;cursor:pointer;border:2px solid rgba(255,255,255,.2)}
.ctrl-card .ctrl-prop input[type="color"]{width:28px;height:28px;border:2px solid rgba(255,255,255,.08);border-radius:6px;cursor:pointer;padding:0;background:none;-webkit-appearance:none;flex-shrink:0}
.ctrl-card .ctrl-prop input[type="color"]::-webkit-color-swatch-wrapper{padding:2px}
.ctrl-card .ctrl-prop input[type="color"]::-webkit-color-swatch{border-radius:3px;border:none}
.ctrl-card .ctrl-prop-val{font-size:.58rem;color:rgba(255,255,255,.3);min-width:32px;text-align:right;flex-shrink:0}
.ctrl-reset-btn{padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);font-size:.65rem;cursor:pointer;transition:all .15s;text-align:center;margin-top:4px}
.ctrl-reset-btn:hover{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
@media(max-width:640px){.ctrl-sidebar{width:100%;max-height:200px;border-left:none;border-top:1px solid rgba(255,255,255,.06);padding:12px;overflow-y:auto}.effect-overlay{flex-direction:column}.effect-overlay iframe{flex:1;width:100%;height:auto}}
`;

const overlayHtml = `<div class="effect-overlay" id="overlay">
  <div class="overlay-toolbar">
    <button class="overlay-btn" id="favBtn" title="收藏"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>
    <button class="overlay-btn" id="overlayClose" title="关闭"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>
  <iframe id="overlayIframe" src="about:blank"></iframe>
  <div class="ctrl-sidebar" id="ctrlSidebar">
    <div class="ctrl-title">属性控制</div>
    <div class="ctrl-empty" id="ctrlLoading">加载中...</div>
  </div>
</div>`;

const overlayJs = `
// === 收藏功能 ===
var favorites = JSON.parse(localStorage.getItem('bfx_favorites') || '[]');
var currentEffectSrc = '';

function updateFavBtn() {
  var btn = document.getElementById('favBtn');
  if (!btn) return;
  if (favorites.indexOf(currentEffectSrc) !== -1) {
    btn.classList.add('fav-active');
  } else {
    btn.classList.remove('fav-active');
  }
}

function updateCardFavStates() {
  document.querySelectorAll('.card-grid .card').forEach(function(card) {
    var src = card.dataset.src;
    if (favorites.indexOf(src) !== -1) {
      card.classList.add('is-fav');
    } else {
      card.classList.remove('is-fav');
    }
  });
}

document.getElementById('favBtn').addEventListener('click', function() {
  if (!currentEffectSrc) return;
  var idx = favorites.indexOf(currentEffectSrc);
  if (idx === -1) {
    favorites.push(currentEffectSrc);
  } else {
    favorites.splice(idx, 1);
  }
  localStorage.setItem('bfx_favorites', JSON.stringify(favorites));
  updateFavBtn();
  updateCardFavStates();
});

// === 动态属性控制面板 ===
// 定义哪些 CSS 属性值得暴露为控制项
var CTRL_PROPS = [
  { prop: 'width', label: '宽度', type: 'range', unit: 'px', min: 4, max: 400, step: 2 },
  { prop: 'height', label: '高度', type: 'range', unit: 'px', min: 4, max: 400, step: 2 },
  { prop: 'borderRadius', label: '圆角', type: 'range', unit: 'px', min: 0, max: 200, step: 1 },
  { prop: 'fontSize', label: '字号', type: 'range', unit: 'px', min: 8, max: 120, step: 1 },
  { prop: 'letterSpacing', label: '字距', type: 'range', unit: 'px', min: -5, max: 40, step: 0.5 },
  { prop: 'opacity', label: '透明度', type: 'range', unit: '', min: 0, max: 1, step: 0.05 },
  { prop: 'gap', label: '间距', type: 'range', unit: 'px', min: 0, max: 40, step: 1 },
];
var COLOR_PROPS = [
  { prop: 'color', label: '颜色' },
  { prop: 'backgroundColor', label: '背景色' },
  { prop: 'borderColor', label: '边框色' },
];

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '';
  var m = rgb.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
  if (!m) return '';
  return '#' + [m[1],m[2],m[3]].map(function(x){ return parseInt(x).toString(16).padStart(2,'0'); }).join('');
}

function getAnimDuration(el) {
  var cs = getComputedStyle(el);
  var dur = parseFloat(cs.animationDuration) || 0;
  return dur;
}

function analyzeElement(el, doc) {
  var cs = doc.defaultView.getComputedStyle(el);
  var controls = [];
  // 数值属性
  CTRL_PROPS.forEach(function(def) {
    var raw = cs[def.prop];
    if (!raw || raw === 'auto' || raw === 'normal' || raw === 'none') return;
    var val = parseFloat(raw);
    if (isNaN(val)) return;
    // 跳过无意义的值
    if (def.prop === 'borderRadius' && val === 0) return;
    if (def.prop === 'letterSpacing' && val === 0) return;
    if (def.prop === 'opacity' && val === 1) return;
    controls.push({ type: 'range', prop: def.prop, label: def.label, value: val, min: def.min, max: Math.max(def.max, val * 2.5), step: def.step, unit: def.unit });
  });
  // 颜色属性
  COLOR_PROPS.forEach(function(def) {
    var raw = cs[def.prop];
    var hex = rgbToHex(raw);
    if (!hex) return;
    if (def.prop === 'backgroundColor' && (hex === '#000000' || hex === '#111111' || hex === '#0a0a0f')) return;
    controls.push({ type: 'color', prop: def.prop, label: def.label, value: hex });
  });
  // 动画速度
  var dur = getAnimDuration(el);
  if (dur > 0) {
    controls.push({ type: 'speed', prop: '__speed', label: '速度', value: 1, min: 0.1, max: 5, step: 0.1 });
  }
  return controls;
}

function getElementLabel(el) {
  var cls = el.className || '';
  if (typeof cls === 'string' && cls.trim()) {
    var main = cls.trim().split(/\\s+/)[0];
    if (main !== 'stage') return '.' + main;
  }
  var tag = el.tagName.toLowerCase();
  return tag;
}

// 不应该出现在控制面板中的标签
var SKIP_TAGS = ['H1','H2','H3','H4','H5','H6','P','A','NAV','SCRIPT','STYLE','LINK','META','TITLE','BR','HR','HEADER','FOOTER','LABEL','SPAN','SVG'];

function findEffectRoot(doc, iframeSrc) {
  // 1. 如果有 .stage，直接用（parsed 类型的独立效果页）
  var stage = doc.querySelector('.stage');
  if (stage) return { container: stage, elements: Array.prototype.slice.call(stage.children) };
  // 2. 如果 URL 有 hash，定位到对应 section 的 .demo 容器
  var hash = '';
  try { hash = new URL(iframeSrc, location.href).hash.slice(1); } catch(e){}
  if (hash) {
    var section = doc.getElementById(hash);
    if (section) {
      // 在 section 内找 .demo 容器（实际效果区域）
      var demo = section.querySelector('.demo');
      if (demo) return { container: demo, elements: collectEffectElements(demo) };
      // 没有 .demo 就用 section 本身，但过滤掉文档元素
      return { container: section, elements: collectEffectElements(section) };
    }
  }
  // 3. 没有 hash 也没有 .stage，尝试找第一个 .demo
  var firstDemo = doc.querySelector('.demo');
  if (firstDemo) return { container: firstDemo, elements: collectEffectElements(firstDemo) };
  // 4. fallback: body 的子元素，但过滤
  return { container: doc.body, elements: collectEffectElements(doc.body) };
}

function collectEffectElements(container) {
  var result = [];
  var children = Array.prototype.slice.call(container.children);
  var win = container.ownerDocument.defaultView || window;
  children.forEach(function(el) {
    if (SKIP_TAGS.indexOf(el.tagName) !== -1) return;
    // 跳过隐藏的或纯布局的元素
    try {
      var cs = win.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
    } catch(e) {}
    result.push(el);
  });
  return result;
}

function buildCtrlPanel() {
  var sidebar = document.getElementById('ctrlSidebar');
  var ifr = document.getElementById('overlayIframe');
  // 清空旧内容（保留标题）
  sidebar.innerHTML = '<div class="ctrl-title">属性控制</div>';
  try {
    var doc = ifr.contentDocument || ifr.contentWindow.document;
    var root = findEffectRoot(doc, ifr.src);
    var elements = root.elements;
    if (elements.length === 0) {
      sidebar.innerHTML += '<div class="ctrl-empty">无可控元素</div>';
      return;
    }
    var hasControls = false;
    elements.forEach(function(el, idx) {
      var controls = analyzeElement(el, doc);
      if (controls.length === 0) return;
      hasControls = true;
      var card = document.createElement('div');
      card.className = 'ctrl-card';
      var label = getElementLabel(el);
      card.innerHTML = '<div class="ctrl-el-name">' + label + ' <span class="ctrl-el-tag">' + el.tagName.toLowerCase() + '</span></div>';
      controls.forEach(function(ctrl) {
        var row = document.createElement('div');
        row.className = 'ctrl-prop';
        if (ctrl.type === 'range' || ctrl.type === 'speed') {
          var displayVal = ctrl.type === 'speed' ? ctrl.value + 'x' : Math.round(ctrl.value) + (ctrl.unit || '');
          row.innerHTML = '<span class="ctrl-prop-label">' + ctrl.label + '</span>' +
            '<input type="range" min="' + ctrl.min + '" max="' + ctrl.max + '" step="' + ctrl.step + '" value="' + ctrl.value + '">' +
            '<span class="ctrl-prop-val">' + displayVal + '</span>';
          var input = row.querySelector('input');
          var valSpan = row.querySelector('.ctrl-prop-val');
          (function(c, element, inp, vs) {
            inp.addEventListener('input', function() {
              var v = parseFloat(inp.value);
              if (c.type === 'speed') {
                vs.textContent = v + 'x';
                try {
                  var anims = doc.getAnimations ? doc.getAnimations() : [];
                  anims.forEach(function(a) {
                    if (a.effect && a.effect.target === element) {
                      try { a.playbackRate = v; } catch(ex){}
                    }
                  });
                } catch(ex){}
              } else {
                vs.textContent = Math.round(v) + (c.unit || '');
                element.style[c.prop] = v + (c.unit || '');
              }
            });
          })(ctrl, el, input, valSpan);
        } else if (ctrl.type === 'color') {
          row.innerHTML = '<span class="ctrl-prop-label">' + ctrl.label + '</span>' +
            '<input type="color" value="' + ctrl.value + '">' +
            '<span class="ctrl-prop-val">' + ctrl.value + '</span>';
          var input = row.querySelector('input');
          var valSpan = row.querySelector('.ctrl-prop-val');
          (function(c, element, inp, vs) {
            inp.addEventListener('input', function() {
              element.style[c.prop] = inp.value;
              vs.textContent = inp.value;
            });
          })(ctrl, el, input, valSpan);
        }
        card.appendChild(row);
      });
      sidebar.appendChild(card);
    });
    if (!hasControls) {
      sidebar.innerHTML += '<div class="ctrl-empty">该效果无可调属性</div>';
    } else {
      var resetBtn = document.createElement('button');
      resetBtn.className = 'ctrl-reset-btn';
      resetBtn.textContent = '重置全部';
      resetBtn.addEventListener('click', function() {
        ifr.contentWindow.location.reload();
        setTimeout(buildCtrlPanel, 500);
      });
      sidebar.appendChild(resetBtn);
    }
  } catch(e) {
    sidebar.innerHTML += '<div class="ctrl-empty">无法分析（跨域）</div>';
  }
}

// iframe 加载完成后构建控制面板
document.getElementById('overlayIframe').addEventListener('load', function() {
  if (this.src !== 'about:blank') {
    setTimeout(buildCtrlPanel, 300);
  }
});

// === Overlay 开关 ===
var overlay = document.getElementById('overlay');
var iframe = document.getElementById('overlayIframe');

function closeOverlay() {
  overlay.classList.remove('open');
  iframe.src = 'about:blank';
  currentEffectSrc = '';
  // 清空控制面板
  var sidebar = document.getElementById('ctrlSidebar');
  sidebar.innerHTML = '<div class="ctrl-title">属性控制</div><div class="ctrl-empty">加载中...</div>';
}

document.getElementById('overlayClose').addEventListener('click', closeOverlay);
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeOverlay(); });

document.querySelectorAll('.card-grid .card').forEach(function(card) {
  card.addEventListener('click', function() {
    var src = card.dataset.src;
    if (src) {
      currentEffectSrc = src;
      iframe.src = src;
      overlay.classList.add('open');
      updateFavBtn();
    }
  });
});

// 初始化卡片收藏状态
updateCardFavStates();
`;

// ============================================================
// 生成每个 parsed 分类的集合页面（二级页面，卡片网格 + overlay）
// ============================================================
const catPagesDir = path.join(dir, '_cat');
if (fs.existsSync(catPagesDir)) fs.rmSync(catPagesDir, { recursive: true });
fs.mkdirSync(catPagesDir);

for (const cat of sortedParsed) {
  let cards = '';
  for (const eff of cat.effects) {
    const stageAttrs = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
    const stageClass = eff.stageClass ? ` ${eff.stageClass}` : '';
    cards += `    <div class="card" data-src="../${eff._file}">
      <div class="card-visual"><div class="stage${stageClass}"${stageAttrs}>${eff.stageHtml}</div></div>
      <div class="card-info"><h3>${eff.name}</h3>${eff.tag ? `<span class="tag">${eff.tag}</span>` : ''}</div>
    </div>\n`;
  }

  const catHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${cat.title} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:48px}
.card{background:#111;cursor:pointer;transition:background .15s}
.card:hover{background:#161616}
.card:hover .card-visual,.card:hover .card-visual .stage{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px;background:#111 !important}
.card-info{padding:10px 14px 14px;background:#111}
.card-info h3{font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-info .tag{display:block;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:2px}
${overlayCss}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr)}}
${cat.css}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<div class="card-grid">
${cards}</div>
${overlayHtml}
<` + `script>
${navJs}
${overlayJs}
${cat.scripts.map(s => s).join('\n')}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, `${cat.id}.html`), catHtml);
}

// iframe 分类的集合页面（截图卡片 + overlay 加载原文件）
for (const cat of sortedIframe) {
  let cards = '';
  if (cat.effects.length > 0) {
    for (let i = 0; i < cat.effects.length; i++) {
      const eff = cat.effects[i];
      const anchor = eff.id ? `#${eff.id}` : '';
      const thumbFile = `${cat.id}_${i}.png`;
      const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
      const visual = thumbExists
        ? `<img src="../_thumbs/${thumbFile}" alt="${eff.name}" style="width:100%;height:100%;object-fit:cover">`
        : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:.8rem;text-align:center;padding:8px">${eff.name}</div>`;
      cards += `    <div class="card" data-src="../${cat.file}${anchor}">
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${eff.name}</h3></div>
    </div>\n`;
    }
  } else {
    // 没有解析出子效果，整个文件作为一个卡片
    const thumbFile = `${cat.file.replace('.html', '.png')}`;
    const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
    const visual = thumbExists
      ? `<img src="../_thumbs/${thumbFile}" alt="${cat.title}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:1.5rem;font-weight:700">${cat.title.charAt(0)}</div>`;
    cards += `    <div class="card" data-src="../${cat.file}">
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${cat.title}</h3></div>
    </div>\n`;
  }

  const iframeCatHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${cat.title} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:48px}
.card{background:#111;cursor:pointer;transition:background .15s}
.card:hover{background:#161616}
.card:hover .card-visual{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-info{padding:10px 14px 14px;background:#111}
.card-info h3{font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${overlayCss}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<div class="card-grid">
${cards}</div>
${overlayHtml}
<` + `script>
${navJs}
${overlayJs}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, `${cat.id}.html`), iframeCatHtml);
}

// collect 分类的集合页面
if (sortedCollect.length > 0) {
  let collectCardsHtml = '';
  for (const item of sortedCollect) {
    const thumbFile = item.file.replace('.html', '.png');
    const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
    const visual = thumbExists
      ? `<img src="../_thumbs/${thumbFile}" alt="${item.title}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:1.5rem;font-weight:700">${item.title.charAt(0)}</div>`;
    collectCardsHtml += `    <div class="card" data-src="../${item.file}">
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${item.title}</h3></div>
    </div>\n`;
  }

  const collectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Collect - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:48px}
.card{background:#111;cursor:pointer;transition:background .15s}
.card:hover{background:#161616}
.card:hover .card-visual{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-info{padding:10px 14px 14px;background:#111}
.card-info h3{font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${overlayCss}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
${generateNavBar('collect', '../')}
<div class="card-grid">
${collectCardsHtml}</div>
${overlayHtml}
<` + `script>
${navJs}
${overlayJs}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, 'collect.html'), collectHtml);
}

console.log(`📁 Generated ${sortedParsed.length + sortedIframe.length + (sortedCollect.length > 0 ? 1 : 0)} category pages in _cat/`);

// ============================================================
// 生成首页 index.html（轻量：只有分类卡片 + 截图）
// ============================================================
let catCards = '';
for (const cat of allCategories) {
  const thumbFile = cat.type === 'collect' ? '46-collect.png' : `${cat.file?.replace('.html', '.png')}`;
  const thumbPath = path.join(dir, '_thumbs', thumbFile);
  const thumbExists = fs.existsSync(thumbPath);
  const href = `_cat/${cat.id}.html`;

  let visual;
  if (thumbExists) {
    visual = `<img src="_thumbs/${thumbFile}" alt="${cat.title}" loading="lazy">`;
  } else {
    visual = `<div class="placeholder">${cat.title.charAt(0)}</div>`;
  }

  catCards += `    <a href="${href}" class="cat-card">
      <div class="cat-visual">${visual}</div>
      <div class="cat-info"><h3>${cat.title}</h3><span class="cat-count">${cat.count}</span></div>
    </a>\n`;
}

// 首页不嵌入任何 CSS 动画，全部用截图

const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:48px}
.cat-card{background:#111;display:flex;flex-direction:column;transition:background .15s}
.cat-card:hover{background:#161616}
.cat-card:hover .cat-visual{background:#161616 !important}
.cat-card:hover .cat-info{background:#161616}
.cat-visual{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.cat-visual img{width:100%;height:100%;object-fit:cover}
.cat-visual .placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.2);font-size:2rem;font-weight:700}
.cat-info{padding:12px 16px 16px;background:#111;display:flex;align-items:baseline;gap:8px}
.cat-info h3{font-size:.85rem;font-weight:500;color:rgba(255,255,255,.7);letter-spacing:-.01em}
.cat-count{font-size:.65rem;color:rgba(255,255,255,.25)}
@media(max-width:768px){.cat-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
${generateNavBar('', '')}
<div class="cat-grid">
${catCards}</div>
<` + `script>
${navJs}
<` + `/script>
</body>
</html>`;

fs.writeFileSync('index.html', indexHtml);
console.log(`\n📄 index.html: ${(Buffer.byteLength(indexHtml)/1024).toFixed(1)} KB`);