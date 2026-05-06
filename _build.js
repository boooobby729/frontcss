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
    iframeCategories.push({ id: catId, file, title: cleanTitle });
    totalEffects += 1;
    console.log(`◆ ${file}: iframe mode (${cleanTitle})`);
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
  ...sortedIframe.map(c => ({ id: c.id, file: c.file, title: c.title, count: 1, type: 'iframe' })),
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
.top-bar{position:fixed;top:0;left:0;right:0;z-index:100;padding:16px 24px;display:flex;align-items:center;gap:12px;background:rgba(17,17,17,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.back-btn{color:rgba(255,255,255,.5);font-size:.8rem;padding:6px 12px;border-radius:6px;background:rgba(255,255,255,.06);transition:all .15s}
.back-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.page-title{font-size:1rem;font-weight:600;color:rgba(255,255,255,.9);letter-spacing:-.02em}
.page-count{font-size:.7rem;color:rgba(255,255,255,.3);margin-left:4px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:57px}
.card{background:#111;cursor:pointer;transition:background .15s}
.card:hover{background:#161616}
.card:hover .card-visual,.card:hover .card-visual .stage{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px;background:#111 !important}
.card-info{padding:10px 14px 14px;background:#111}
.card-info h3{font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-info .tag{display:block;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:2px}
.effect-overlay{position:fixed;inset:0;z-index:9999;background:#111;display:none;flex-direction:column}
.effect-overlay.open{display:flex}
.effect-overlay iframe{width:100%;height:100%;border:none}
.effect-overlay-close{position:fixed;top:16px;right:20px;z-index:10000;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}
.effect-overlay-close:hover{background:rgba(255,255,255,.2)}
.effect-overlay-close svg{width:14px;height:14px;stroke:#fff;stroke-width:2}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr)}}
${cat.css}
</style>
</head>
<body>
<div class="top-bar">
  <a href="../index.html" class="back-btn">← 返回</a>
  <span class="page-title">${cat.title}</span>
  <span class="page-count">${cat.effects.length} 个效果</span>
</div>
<div class="card-grid">
${cards}</div>
<div class="effect-overlay" id="overlay">
  <button class="effect-overlay-close" id="overlayClose"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  <iframe id="overlayIframe" src="about:blank"></iframe>
</div>
<` + `script>
const overlay=document.getElementById('overlay');
const iframe=document.getElementById('overlayIframe');
document.getElementById('overlayClose').addEventListener('click',()=>{overlay.classList.remove('open');iframe.src='about:blank';});
document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.classList.remove('open'),iframe.src='about:blank';});
document.querySelectorAll('.card').forEach(card=>{
  card.addEventListener('click',()=>{
    const src=card.dataset.src;
    if(src){iframe.src=src;overlay.classList.add('open');}
  });
});
${cat.scripts.map(s => s).join('\n')}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, `${cat.id}.html`), catHtml);
}

// iframe 分类的集合页面（直接跳转原文件，不需要生成）
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
.top-bar{position:fixed;top:0;left:0;right:0;z-index:100;padding:16px 24px;display:flex;align-items:center;gap:12px;background:rgba(17,17,17,.85);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.06)}
.back-btn{color:rgba(255,255,255,.5);font-size:.8rem;padding:6px 12px;border-radius:6px;background:rgba(255,255,255,.06);transition:all .15s}
.back-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.page-title{font-size:1rem;font-weight:600;color:rgba(255,255,255,.9);letter-spacing:-.02em}
.page-count{font-size:.7rem;color:rgba(255,255,255,.3);margin-left:4px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:57px}
.card{background:#111;cursor:pointer;transition:background .15s}
.card:hover{background:#161616}
.card:hover .card-visual{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-info{padding:10px 14px 14px;background:#111}
.card-info h3{font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.effect-overlay{position:fixed;inset:0;z-index:9999;background:#111;display:none;flex-direction:column}
.effect-overlay.open{display:flex}
.effect-overlay iframe{width:100%;height:100%;border:none}
.effect-overlay-close{position:fixed;top:16px;right:20px;z-index:10000;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}
.effect-overlay-close:hover{background:rgba(255,255,255,.2)}
.effect-overlay-close svg{width:14px;height:14px;stroke:#fff;stroke-width:2}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="top-bar">
  <a href="../index.html" class="back-btn">← 返回</a>
  <span class="page-title">Collect</span>
  <span class="page-count">${sortedCollect.length} 个效果</span>
</div>
<div class="card-grid">
${collectCardsHtml}</div>
<div class="effect-overlay" id="overlay">
  <button class="effect-overlay-close" id="overlayClose"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  <iframe id="overlayIframe" src="about:blank"></iframe>
</div>
<` + `script>
const overlay=document.getElementById('overlay');
const iframe=document.getElementById('overlayIframe');
document.getElementById('overlayClose').addEventListener('click',()=>{overlay.classList.remove('open');iframe.src='about:blank';});
document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.classList.remove('open'),iframe.src='about:blank';});
document.querySelectorAll('.card').forEach(card=>{
  card.addEventListener('click',()=>{
    const src=card.dataset.src;
    if(src){iframe.src=src;overlay.classList.add('open');}
  });
});
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, 'collect.html'), collectHtml);
}

console.log(`📁 Generated ${sortedParsed.length + (sortedCollect.length > 0 ? 1 : 0)} category pages in _cat/`);

// ============================================================
// 生成首页 index.html（轻量：只有分类卡片 + 截图）
// ============================================================
let catCards = '';
for (const cat of allCategories) {
  const thumbFile = cat.type === 'collect' ? '46-collect.png' : `${cat.file?.replace('.html', '.png')}`;
  const thumbPath = path.join(dir, '_thumbs', thumbFile);
  const thumbExists = fs.existsSync(thumbPath);
  const href = cat.type === 'iframe' ? cat.file : `_cat/${cat.id}.html`;

  let visual;
  if (thumbExists) {
    visual = `<img src="_thumbs/${thumbFile}" alt="${cat.title}" loading="lazy">`;
  } else {
    // parsed 分类：用第一个效果的 stage 作为预览
    const parsed = sortedParsed.find(p => p.id === cat.id);
    if (parsed && parsed.effects.length > 0) {
      const eff = parsed.effects[0];
      const sc = eff.stageClass ? ` ${eff.stageClass}` : '';
      const sa = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
      visual = `<div class="stage${sc}"${sa}>${eff.stageHtml}</div>`;
    } else {
      visual = `<div class="placeholder">${cat.title.charAt(0)}</div>`;
    }
  }

  catCards += `    <a href="${href}" class="cat-card">
      <div class="cat-visual">${visual}</div>
      <div class="cat-info"><h3>${cat.title}</h3><span class="cat-count">${cat.count}</span></div>
    </a>\n`;
}

// 合并 parsed 分类的 CSS（首页预览用）
let previewCss = '';
for (const cat of sortedParsed) {
  previewCss += `\n/* ${cat.title} */\n${cat.css}\n`;
}

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
.page-header{padding:60px 32px 32px;text-align:center}
.page-title{font-size:2rem;font-weight:700;letter-spacing:-.03em;color:rgba(255,255,255,.9)}
.page-sub{font-size:.8rem;color:rgba(255,255,255,.3);margin-top:8px}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1px;background:rgba(255,255,255,.07);margin:0}
.cat-card{background:#111;display:flex;flex-direction:column;transition:background .15s}
.cat-card:hover{background:#161616}
.cat-card:hover .cat-visual,.cat-card:hover .cat-visual .stage{background:#161616 !important}
.cat-card:hover .cat-info{background:#161616}
.cat-visual{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.cat-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px;background:#111 !important}
.cat-visual img{width:100%;height:100%;object-fit:cover}
.cat-visual .placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.2);font-size:2rem;font-weight:700}
.cat-info{padding:12px 16px 16px;background:#111;display:flex;align-items:baseline;gap:8px}
.cat-info h3{font-size:.85rem;font-weight:500;color:rgba(255,255,255,.7);letter-spacing:-.01em}
.cat-count{font-size:.65rem;color:rgba(255,255,255,.25)}
@media(max-width:768px){.cat-grid{grid-template-columns:repeat(2,1fr)}}
${previewCss}
</style>
</head>
<body>
<header class="page-header">
  <h1 class="page-title">Bの宝库</h1>
  <p class="page-sub">${totalEffects} 个前端效果 · ${allCategories.length} 个分类</p>
</header>
<div class="cat-grid">
${catCards}</div>
</body>
</html>`;

fs.writeFileSync('index.html', indexHtml);
console.log(`\n📄 index.html: ${(Buffer.byteLength(indexHtml)/1024).toFixed(1)} KB`);