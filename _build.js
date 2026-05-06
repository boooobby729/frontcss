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

// 为效果详情页清理 CSS：移除 .stage 的 width/height/display 等布局属性（由详情页自行定义）
function cleanCssForEffectPage(css) {
  return css
    .replace(/\.stage\s*\{[^}]*\}/g, '')
    .replace(/\.stage\s*\.[^{]*\{([^}]*)\}/g, function(match, block) {
      // 保留 .stage.xxx 变体，但移除其中的 width/height/display 属性
      const cleaned = block
        .replace(/\b(?:width|height|display|align-items|justify-content|position|overflow)\s*:[^;]+;?/g, '');
      return cleaned.trim() ? match.replace(block, cleaned) : '';
    });
}

// ============================================================
// 提取 iframe 分类中的子效果（完整拆分：HTML + CSS + JS）
// ============================================================
function extractIframeEffects(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const effects = [];

  function cleanH2(raw) {
    return raw.replace(/<[^>]+>/g, '').replace(/^\d+\.\s*/, '').trim();
  }

  // 提取全局 style（在第一个 section 之前的 style）
  const firstSectionIdx = html.search(/<section[\s>]/i);
  let globalCss = '';
  if (firstSectionIdx > 0) {
    const headPart = html.slice(0, firstSectionIdx);
    const styleMatches = headPart.match(/<style>([\s\S]*?)<\/style>/g);
    if (styleMatches) {
      globalCss = styleMatches.map(s => s.replace(/<\/?style>/g, '')).join('\n');
    }
  }

  // 按 section 边界拆分：支持 <section> 和 <div class="section...">
  const sectionStarts = [];
  const sectionRegex = /<section[^>]*>/gi;
  let sm;
  while ((sm = sectionRegex.exec(html)) !== null) {
    sectionStarts.push(sm.index);
  }
  // 如果没有 <section>，尝试 <div class="section...">
  if (sectionStarts.length === 0) {
    const divSectionRegex = /<div\s+class="section[^"]*"[^>]*>/gi;
    while ((sm = divSectionRegex.exec(html)) !== null) {
      sectionStarts.push(sm.index);
    }
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const end = i < sectionStarts.length - 1 ? sectionStarts[i + 1] : html.length;
    let chunk = html.slice(start, end);

    // 移除末尾的 copy-effect.js 引用和 </body></html>
    chunk = chunk.replace(/<script\s+src="copy-effect\.js"[^>]*><\/script>/g, '');
    chunk = chunk.replace(/<\/body>\s*<\/html>\s*$/i, '');

    // 提取 id（支持 <section id="..."> 和 <div class="section" id="...">）
    const idMatch = chunk.match(/<(?:section|div)[^>]*id="([^"]*)"/);
    const h2Match = chunk.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const name = h2Match ? cleanH2(h2Match[1]) : `效果 ${i + 1}`;
    const id = idMatch ? idMatch[1] : '';

    // 提取 demo 区域的 style 属性（背景色等）
    const demoMatch = chunk.match(/<div class="demo"[^>]*style="([^"]*)"[^>]*>/);
    const demoStyle = demoMatch ? demoMatch[1] : '';

    // 提取该 chunk 内的所有 <style> 块
    const localStyles = [];
    const styleBlockRegex = /<style>([\s\S]*?)<\/style>/g;
    let stm;
    while ((stm = styleBlockRegex.exec(chunk)) !== null) {
      localStyles.push(stm[1]);
    }

    // 提取该 chunk 内的所有 <script> 块（非 src 引用）
    const localScripts = [];
    const scriptBlockRegex = /<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/g;
    let scm;
    while ((scm = scriptBlockRegex.exec(chunk)) !== null) {
      if (scm[2].trim()) localScripts.push(scm[2]);
    }

    // 提取展示区 HTML：优先找 .demo，否则取整个容器的 innerHTML
    let demoHtml = '';
    const demoStartMatch = chunk.match(/<div class="demo"[^>]*>/);
    if (demoStartMatch) {
      const demoStartIdx = chunk.indexOf(demoStartMatch[0]);
      const demoResult = extractDivContent(chunk, demoStartIdx);
      if (demoResult) {
        demoHtml = demoResult.content;
      }
    } else {
      // 取容器的 innerHTML（移除 script/style 标签后）
      const containerMatch = chunk.match(/^<(?:section|div)[^>]*>/);
      if (containerMatch) {
        const innerStart = containerMatch[0].length;
        // 找对应的关闭标签
        const containerResult = extractDivContent(chunk, 0);
        if (containerResult) {
          demoHtml = containerResult.content
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '');
        } else {
          demoHtml = chunk.slice(innerStart)
            .replace(/<\/(?:section|div)>\s*$/i, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '');
        }
      }
    }

    effects.push({
      id,
      name,
      demoStyle,
      demoHtml,
      localCss: localStyles.join('\n'),
      scripts: localScripts
    });
  }

  return { effects, globalCss };
}

// ============================================================
// CSS 分析：提取动效专属控制属性
// ============================================================
function extractEffectControls(css, stageHtml) {
  const controls = [];

  // 提取所有 @keyframes 名称
  const keyframeNames = [];
  const kfRegex = /@keyframes\s+([\w-]+)/g;
  let kfm;
  while ((kfm = kfRegex.exec(css)) !== null) {
    keyframeNames.push(kfm[1]);
  }

  // 从 stageHtml 中提取动效相关的 class
  const classesInStage = [];
  const classRegex = /class="([^"]+)"/g;
  let cm;
  while ((cm = classRegex.exec(stageHtml)) !== null) {
    cm[1].split(/\s+/).forEach(c => {
      if (c && c !== 'stage') classesInStage.push(c);
    });
  }

  // 分析有动画的元素
  let hasAnimation = false;
  for (const cls of classesInStage) {
    const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const clsRegex = new RegExp(`\\.${escapedCls}[^{]*\\{[^}]*animation[^}]*\\}`, 'g');
    if (clsRegex.test(css)) {
      hasAnimation = true;
      break;
    }
  }

  // 如果有动画，添加动画速度控制
  if (hasAnimation || keyframeNames.length > 0) {
    controls.push({
      type: 'range', id: 'anim-speed', label: '动画速度',
      min: 0.1, max: 5, step: 0.1, value: 1, unit: 'x',
      action: 'speed'
    });
  }

  // 从 CSS 中提取各 class 的属性
  for (const cls of classesInStage) {
    const escapedCls = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const clsBlockRegex = new RegExp(`\\.${escapedCls}\\s*\\{([^}]*)\\}`, 'g');
    let clsMatch;
    while ((clsMatch = clsBlockRegex.exec(css)) !== null) {
      const block = clsMatch[1];

      // 提取 width（动效元素尺寸）
      const widthMatch = block.match(/(?:^|;\s*)width\s*:\s*(\d+)px/);
      if (widthMatch && !controls.find(c => c.id === `${cls}-size`)) {
        const val = parseInt(widthMatch[1]);
        if (val > 0 && val <= 400) {
          controls.push({
            type: 'range', id: `${cls}-size`, label: '尺寸',
            min: Math.max(4, Math.round(val * 0.2)), max: Math.round(val * 3),
            step: 1, value: val, unit: 'px',
            action: 'css', target: `.${cls}`, props: ['width', 'height']
          });
        }
      }

      // 提取 border-radius
      const brMatch = block.match(/border-radius\s*:\s*(\d+)px/);
      if (brMatch && !controls.find(c => c.id === `${cls}-radius`)) {
        const val = parseInt(brMatch[1]);
        if (val > 0) {
          controls.push({
            type: 'range', id: `${cls}-radius`, label: '圆角',
            min: 0, max: Math.max(100, val * 3), step: 1, value: val, unit: 'px',
            action: 'css', target: `.${cls}`, props: ['borderRadius']
          });
        }
      }

      // 提取 font-size
      const fsMatch = block.match(/font-size\s*:\s*(\d+\.?\d*)(rem|px|em)/);
      if (fsMatch && !controls.find(c => c.id === `${cls}-fontsize`)) {
        const val = parseFloat(fsMatch[1]);
        const unit = fsMatch[2];
        controls.push({
          type: 'range', id: `${cls}-fontsize`, label: '字号',
          min: unit === 'px' ? 8 : 0.5, max: unit === 'px' ? 120 : 8,
          step: unit === 'px' ? 1 : 0.1, value: val, unit: unit,
          action: 'css', target: `.${cls}`, props: ['fontSize']
        });
      }

      // 提取渐变颜色
      const gradMatch = block.match(/linear-gradient\(\s*[^,]+,\s*(#[0-9a-fA-F]{3,8})\s*(?:,\s*|\)\s*)(#[0-9a-fA-F]{3,8})?/);
      if (gradMatch && !controls.find(c => c.id === `${cls}-color1`)) {
        const c1 = expandHex(gradMatch[1]);
        controls.push({
          type: 'color', id: `${cls}-color1`, label: '主色',
          value: c1, action: 'gradient', target: `.${cls}`, index: 0
        });
        if (gradMatch[2]) {
          controls.push({
            type: 'color', id: `${cls}-color2`, label: '副色',
            value: expandHex(gradMatch[2]), action: 'gradient', target: `.${cls}`, index: 1
          });
        }
      }

      // 纯色 background
      if (!gradMatch) {
        const bgMatch = block.match(/background\s*:\s*(#[0-9a-fA-F]{3,8})/);
        if (bgMatch && !controls.find(c => c.id === `${cls}-bgcolor`)) {
          const hex = expandHex(bgMatch[1]);
          if (!isNearBlack(hex)) {
            controls.push({
              type: 'color', id: `${cls}-bgcolor`, label: '颜色',
              value: hex, action: 'css', target: `.${cls}`, props: ['background']
            });
          }
        }
      }

      // gap
      const gapMatch = block.match(/gap\s*:\s*(\d+)px/);
      if (gapMatch && !controls.find(c => c.id === `${cls}-gap`)) {
        const val = parseInt(gapMatch[1]);
        controls.push({
          type: 'range', id: `${cls}-gap`, label: '间距',
          min: 0, max: Math.max(40, val * 4), step: 1, value: val, unit: 'px',
          action: 'css', target: `.${cls}`, props: ['gap']
        });
      }
    }
  }

  return controls.slice(0, 8);
}

function expandHex(hex) {
  if (hex.length === 4) return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  return hex;
}

function isNearBlack(hex) {
  if (hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return r < 40 && g < 40 && b < 40;
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
      id: catId, file, title: cleanTitle,
      css: cleanCss(result.css),
      effects: result.effects,
      scripts: result.scripts,
      structure: result.structure
    });
    totalEffects += result.effects.length;
    console.log(`✓ ${file}: ${result.effects.length} effects (${result.structure})`);
  } else {
    const iframeResult = extractIframeEffects(path.join(dir, file));
    iframeCategories.push({ id: catId, file, title: cleanTitle, effects: iframeResult.effects, globalCss: iframeResult.globalCss });
    totalEffects += Math.max(iframeResult.effects.length, 1);
    console.log(`◆ ${file}: iframe mode (${cleanTitle}) - ${iframeResult.effects.length} sub-effects`);
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

const allCategories = [
  ...sortedParsed.map(c => ({ id: c.id, file: c.file, title: c.title, count: c.effects.length, type: 'parsed' })),
  ...sortedIframe.map(c => ({ id: c.id, file: c.file, title: c.title, count: c.effects.length, type: 'iframe' })),
];
if (sortedCollect.length > 0) {
  allCategories.push({ id: 'collect', file: null, title: 'Collect', count: sortedCollect.length, type: 'collect' });
}

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
// 控制面板样式
// ============================================================
const ctrlCss = `
.ctrl-sidebar{width:260px;flex-shrink:0;background:rgba(17,17,17,.97);border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:6px;padding:56px 14px 14px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
.ctrl-sidebar::-webkit-scrollbar{width:4px}
.ctrl-sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.ctrl-sidebar .ctrl-title{font-size:.7rem;color:rgba(255,255,255,.6);font-weight:600;padding:0 4px 4px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:2px}
.ctrl-sidebar .ctrl-empty{font-size:.65rem;color:rgba(255,255,255,.25);text-align:center;padding:20px 0}
.ctrl-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.ctrl-card .ctrl-prop{display:flex;align-items:center;gap:8px;padding:3px 0}
.ctrl-card .ctrl-prop-label{font-size:.6rem;color:rgba(255,255,255,.35);min-width:52px;flex-shrink:0}
.ctrl-card .ctrl-prop input[type="range"]{flex:1;height:3px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.1);border-radius:2px;outline:none}
.ctrl-card .ctrl-prop input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#667eea;cursor:pointer;border:2px solid rgba(255,255,255,.2)}
.ctrl-card .ctrl-prop input[type="color"]{width:28px;height:28px;border:2px solid rgba(255,255,255,.08);border-radius:6px;cursor:pointer;padding:0;background:none;-webkit-appearance:none;flex-shrink:0}
.ctrl-card .ctrl-prop input[type="color"]::-webkit-color-swatch-wrapper{padding:2px}
.ctrl-card .ctrl-prop input[type="color"]::-webkit-color-swatch{border-radius:3px;border:none}
.ctrl-card .ctrl-prop-val{font-size:.58rem;color:rgba(255,255,255,.3);min-width:32px;text-align:right;flex-shrink:0}
.ctrl-reset-btn{padding:8px 12px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.4);font-size:.65rem;cursor:pointer;transition:all .15s;text-align:center;margin-top:4px}
.ctrl-reset-btn:hover{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
.back-btn{position:fixed;top:56px;left:16px;z-index:201;padding:6px 14px;border-radius:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.5);font-size:.7rem;cursor:pointer;transition:all .15s;text-decoration:none;display:flex;align-items:center;gap:4px}
.back-btn:hover{background:rgba(255,255,255,.12);color:#fff}
.back-btn svg{width:12px;height:12px;stroke:currentColor;stroke-width:2;fill:none}
@media(max-width:768px){.ctrl-sidebar{position:fixed;bottom:0;left:0;right:0;width:100%;max-height:200px;border-left:none;border-top:1px solid rgba(255,255,255,.06);padding:12px;flex-direction:row;flex-wrap:wrap;z-index:100}.effect-page{padding-bottom:200px}}
`;

// ============================================================
// 控制面板 JS（内嵌在效果详情页中）
// ============================================================
const ctrlPanelJs = `
(function(){
  var controls = window.__EFFECT_CONTROLS__;
  var sidebar = document.getElementById('ctrlSidebar');
  if (!controls || controls.length === 0) {
    sidebar.innerHTML += '<div class="ctrl-empty">该效果无可调属性</div>';
    return;
  }
  var card = document.createElement('div');
  card.className = 'ctrl-card';
  var origDurations = new Map();

  controls.forEach(function(ctrl) {
    var row = document.createElement('div');
    row.className = 'ctrl-prop';

    if (ctrl.type === 'range') {
      var displayVal = ctrl.unit === 'x' ? ctrl.value + 'x' : ctrl.value + (ctrl.unit || '');
      row.innerHTML = '<span class="ctrl-prop-label">' + ctrl.label + '</span><input type="range" min="' + ctrl.min + '" max="' + ctrl.max + '" step="' + ctrl.step + '" value="' + ctrl.value + '"><span class="ctrl-prop-val">' + displayVal + '</span>';
      var input = row.querySelector('input');
      var valSpan = row.querySelector('.ctrl-prop-val');

      (function(c, inp, vs) {
        inp.addEventListener('input', function() {
          var v = parseFloat(inp.value);
          if (c.action === 'speed') {
            vs.textContent = v.toFixed(1) + 'x';
            var stage = document.querySelector('.stage');
            if (!stage) return;
            var allEls = [stage].concat(Array.prototype.slice.call(stage.querySelectorAll('*')));
            allEls.forEach(function(el) {
              var cs = getComputedStyle(el);
              if (cs.animationName && cs.animationName !== 'none') {
                var key = el.className + '|' + cs.animationName;
                if (!origDurations.has(key)) {
                  origDurations.set(key, parseFloat(cs.animationDuration));
                }
                var orig = origDurations.get(key);
                el.style.animationDuration = (orig / v) + 's';
              }
            });
          } else if (c.action === 'css') {
            vs.textContent = Math.round(v * 10) / 10 + (c.unit || '');
            var targets = document.querySelectorAll(c.target);
            targets.forEach(function(el) {
              c.props.forEach(function(prop) {
                el.style[prop] = v + (c.unit || '');
              });
            });
          }
        });
      })(ctrl, input, valSpan);
    } else if (ctrl.type === 'color') {
      row.innerHTML = '<span class="ctrl-prop-label">' + ctrl.label + '</span><input type="color" value="' + ctrl.value + '"><span class="ctrl-prop-val">' + ctrl.value + '</span>';
      var input = row.querySelector('input');
      var valSpan = row.querySelector('.ctrl-prop-val');

      (function(c, inp, vs) {
        inp.addEventListener('input', function() {
          vs.textContent = inp.value;
          var targets = document.querySelectorAll(c.target);
          targets.forEach(function(el) {
            if (c.action === 'gradient') {
              var cs = getComputedStyle(el);
              var bgImg = cs.backgroundImage || '';
              if (bgImg.includes('linear-gradient')) {
                var colors = bgImg.match(/rgb[a]?\\([^)]+\\)/g) || [];
                if (colors.length >= 2) {
                  colors[c.index] = inp.value;
                  el.style.background = 'linear-gradient(135deg, ' + colors[0] + ', ' + colors[1] + ')';
                }
              } else {
                el.style.background = inp.value;
              }
            } else if (c.action === 'css') {
              c.props.forEach(function(prop) {
                el.style[prop] = inp.value;
              });
            }
          });
        });
      })(ctrl, input, valSpan);
    }
    card.appendChild(row);
  });

  sidebar.appendChild(card);

  // 重置按钮
  var resetBtn = document.createElement('button');
  resetBtn.className = 'ctrl-reset-btn';
  resetBtn.textContent = '重置全部';
  resetBtn.addEventListener('click', function() { location.reload(); });
  sidebar.appendChild(resetBtn);
})();`;

// ============================================================
// 生成独立效果详情页（_effects/） - 带专属控制面板
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

    // 提取该效果的专属控制项
    const controls = extractEffectControls(cat.css, eff.stageHtml);
    const effectPageCss = cleanCssForEffectPage(cat.css);

    const effectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${eff.name} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh;display:flex;flex-direction:row}
${navCss}
${ctrlCss}
.effect-main{flex:1;display:flex;align-items:center;justify-content:center;min-height:100vh;padding-top:48px;position:relative;overflow:hidden}
.stage{width:100%;height:calc(100vh - 48px);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
${effectPageCss}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<a href="../_cat/${cat.id}.html" class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>返回</a>
<div class="effect-main">
<div class="${stageClass.trim()}"${stageAttrs}>${eff.stageHtml}</div>
</div>
<div class="ctrl-sidebar" id="ctrlSidebar">
<div class="ctrl-title">${eff.name}</div>
</div>
${cat.scripts.map(s => `<script>${s}<\/script>`).join('\n')}
<` + `script>
window.__EFFECT_CONTROLS__ = ${JSON.stringify(controls)};
${ctrlPanelJs}
${navJs}
<` + `/script>
</body>
</html>`;
    fs.writeFileSync(path.join(effectsDir, fileName), effectHtml);
    eff._file = `_effects/${fileName}`;
  }
}
// 为 iframe 类型生成独立效果页
for (const cat of sortedIframe) {
  for (const eff of cat.effects) {
    effectIndex++;
    const fileName = `${String(effectIndex).padStart(3, '0')}.html`;

    // 清理全局 CSS（移除 body/通配符/布局相关）
    const iframeCssClean = (cat.globalCss || '')
      .replace(/\s*\*[\s,]*\*::before[\s\S]*?\}/g, '')
      .replace(/\s*body\s*\{[^}]*\}/g, '')
      .replace(/\s*\.nav\s*\{[^}]*\}/g, '')
      .replace(/\s*\.nav\s+a\s*\{[^}]*\}/g, '')
      .replace(/\s*\.effect-section\s*\{[^}]*\}/g, '')
      .replace(/\s*\.effect-section\s+h2\s*\{[^}]*\}/g, '')
      .replace(/\s*\.effect-section\s+\.desc\s*\{[^}]*\}/g, '')
      .replace(/\s*\.demo\s*\{[^}]*\}/g, '');

    const allCss = iframeCssClean + '\n' + (eff.localCss || '');
    const bgStyle = eff.demoStyle || 'background:#111';

    const iframeEffectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${eff.name} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh;display:flex;flex-direction:row}
${navCss}
${ctrlCss}
.effect-main{flex:1;display:flex;align-items:center;justify-content:center;min-height:100vh;padding-top:48px;position:relative;overflow:hidden}
.stage{width:100%;height:calc(100vh - 48px);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;${bgStyle}}
.stage canvas{position:absolute;inset:0;width:100%;height:100%}
${allCss}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<a href="../_cat/${cat.id}.html" class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>返回</a>
<div class="effect-main">
<div class="stage">${eff.demoHtml}</div>
</div>
<div class="ctrl-sidebar" id="ctrlSidebar">
<div class="ctrl-title">${eff.name}</div>
<div class="ctrl-empty">沉浸式体验</div>
</div>
${eff.scripts.map(s => `<` + `script>${s}<` + `/script>`).join('\n')}
<` + `script>
${navJs}
<` + `/script>
</body>
</html>`;
    fs.writeFileSync(path.join(effectsDir, fileName), iframeEffectHtml);
    eff._file = `_effects/${fileName}`;
  }
}

console.log(`📁 Generated ${effectIndex} standalone effect files in _effects/`);

// ============================================================
// 分类页面共用样式（卡片网格，点击跳转到效果详情页）
// ============================================================
const cardGridCss = `
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:rgba(255,255,255,.07);margin-top:48px}
.card{background:#111;cursor:pointer;transition:background .15s;text-decoration:none;display:block}
.card:hover{background:#161616}
.card:hover .card-visual,.card:hover .card-visual .stage{background:#161616 !important}
.card:hover .card-info{background:#161616}
.card-visual{width:100%;aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#111 !important}
.card-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px;background:#111 !important}
.card-info{padding:10px 14px 14px;background:#111}
.card-info h3{font-size:.75rem;font-weight:500;color:rgba(255,255,255,.6);letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-info .tag{display:block;font-size:.62rem;color:rgba(255,255,255,.25);margin-top:2px}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr)}}
`;

// ============================================================
// 生成每个 parsed 分类的集合页面（点击卡片跳转到效果详情页）
// ============================================================
const catPagesDir = path.join(dir, '_cat');
if (fs.existsSync(catPagesDir)) fs.rmSync(catPagesDir, { recursive: true });
fs.mkdirSync(catPagesDir);

for (const cat of sortedParsed) {
  let cards = '';
  for (const eff of cat.effects) {
    const stageAttrs = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
    const stageClass = eff.stageClass ? ` ${eff.stageClass}` : '';
    cards += `    <a href="../${eff._file}" class="card">
      <div class="card-visual"><div class="stage${stageClass}"${stageAttrs}>${eff.stageHtml}</div></div>
      <div class="card-info"><h3>${eff.name}</h3>${eff.tag ? `<span class="tag">${eff.tag}</span>` : ''}</div>
    </a>\n`;
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
${cardGridCss}
${cat.css}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<div class="card-grid">
${cards}</div>
<` + `script>
${navJs}
${cat.scripts.map(s => s).join('\n')}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, `${cat.id}.html`), catHtml);
}

// iframe 分类的集合页面（卡片点击跳转到独立效果页）
for (const cat of sortedIframe) {
  let cards = '';
  if (cat.effects.length > 0) {
    for (let i = 0; i < cat.effects.length; i++) {
      const eff = cat.effects[i];
      const thumbFile = `${cat.id}_${i}.png`;
      const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
      const visual = thumbExists
        ? `<img src="../_thumbs/${thumbFile}" alt="${eff.name}" style="width:100%;height:100%;object-fit:cover">`
        : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:.8rem;text-align:center;padding:8px">${eff.name}</div>`;
      cards += `    <a href="../${eff._file}" class="card">
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${eff.name}</h3></div>
    </a>\n`;
    }
  } else {
    const thumbFile = `${cat.file.replace('.html', '.png')}`;
    const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
    const visual = thumbExists
      ? `<img src="../_thumbs/${thumbFile}" alt="${cat.title}" style="width:100%;height:100%;object-fit:cover">`
      : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:1.5rem;font-weight:700">${cat.title.charAt(0)}</div>`;
    cards += `    <a href="../${cat.file}" class="card">
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${cat.title}</h3></div>
    </a>\n`;
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
${cardGridCss}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<div class="card-grid">
${cards}</div>
<` + `script>
${navJs}
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
    collectCardsHtml += `    <a href="../${item.file}" class="card">
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${item.title}</h3></div>
    </a>\n`;
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
${cardGridCss}
</style>
</head>
<body>
${generateNavBar('collect', '../')}
<div class="card-grid">
${collectCardsHtml}</div>
<` + `script>
${navJs}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, 'collect.html'), collectHtml);
}

console.log(`📁 Generated ${sortedParsed.length + sortedIframe.length + (sortedCollect.length > 0 ? 1 : 0)} category pages in _cat/`);

// ============================================================
// 生成首页 index.html（分类卡片 + 截图）
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
