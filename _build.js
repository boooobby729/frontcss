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

  // 提取全局 style（在第一个效果区域之前的 style）
  let firstSectionIdx = html.search(/<section[\s>]/i);
  if (firstSectionIdx === -1) {
    // 尝试找第一个编号注释 <!-- N. xxx -->
    const firstCommentMatch = html.match(/<!--\s*\d+\.\s*/);
    if (firstCommentMatch) {
      firstSectionIdx = html.indexOf(firstCommentMatch[0]);
    }
  }
  if (firstSectionIdx === -1) {
    // 尝试找第一个 <div class="section
    const firstDivSection = html.search(/<div\s+class="section/i);
    if (firstDivSection !== -1) firstSectionIdx = firstDivSection;
  }
  let globalCss = '';
  if (firstSectionIdx > 0) {
    const headPart = html.slice(0, firstSectionIdx);
    const styleMatches = headPart.match(/<style>([\s\S]*?)<\/style>/g);
    if (styleMatches) {
      globalCss = styleMatches.map(s => s.replace(/<\/?style>/g, '')).join('\n');
    }
  }

  // 按 section 边界拆分：支持 <section>、<!-- N. xxx --> 注释分隔、<div class="section...">
  const sectionStarts = [];
  const sectionRegex = /<section[^>]*>/gi;
  let sm;
  while ((sm = sectionRegex.exec(html)) !== null) {
    sectionStarts.push(sm.index);
  }
  // 如果没有 <section>，尝试按 <!-- N. xxx --> 注释分割（这种格式在很多 iframe 页面中使用）
  if (sectionStarts.length === 0) {
    const commentRegex = /<!--\s*\d+\.\s*[^>]+-->/gi;
    while ((sm = commentRegex.exec(html)) !== null) {
      // 只取 body 内的注释
      if (sm.index > firstSectionIdx || firstSectionIdx === -1) {
        sectionStarts.push(sm.index);
      }
    }
  }
  // 最后尝试 <div class="section...">
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

    // 提取 demo 区域的 style 属性和 id
    const demoMatch = chunk.match(/<div class="demo"[^>]*style="([^"]*)"[^>]*>/);
    const demoStyle = demoMatch ? demoMatch[1] : '';
    const demoIdMatch = chunk.match(/<div class="demo"[^>]*id="([^"]*)"[^>]*>/);
    const demoId = demoIdMatch ? demoIdMatch[1] : '';

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

    // 提取展示区 HTML：优先找 .demo，否则取容器内容
    let demoHtml = '';
    const demoStartMatch = chunk.match(/<div class="demo"[^>]*>/);
    if (demoStartMatch) {
      const demoStartIdx = chunk.indexOf(demoStartMatch[0]);
      const demoResult = extractDivContent(chunk, demoStartIdx);
      if (demoResult) {
        demoHtml = demoResult.content;
      }
    } else {
      // 找 chunk 中第一个顶层 div/section 容器
      const containerMatch = chunk.match(/<(?:section|div)[^>]*>/);
      if (containerMatch) {
        const containerIdx = chunk.indexOf(containerMatch[0]);
        const containerResult = extractDivContent(chunk, containerIdx);
        if (containerResult) {
          demoHtml = containerResult.content;
        }
      }
      // 如果还是空的，取整个 chunk 去掉 script/style/注释/section-title
      if (!demoHtml) {
        demoHtml = chunk;
      }
      demoHtml = demoHtml
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, '')
        .replace(/<p class="desc"[^>]*>[\s\S]*?<\/p>/gi, '')
        .trim();
    }

    effects.push({
      id,
      name,
      demoStyle,
      demoId,
      demoHtml,
      localCss: localStyles.join('\n'),
      scripts: localScripts
    });
  }

  // 提取 section 之间/之后的共享 HTML 元素（如光标 div 等）
  // 策略：找到所有 section 之后的 HTML 元素（在 <script> 之前的 <div> 等元素）
  let sharedHtmlElements = '';
  if (sectionStarts.length > 0) {
    const lastSectionStart = sectionStarts[sectionStarts.length - 1];
    const afterContent = html.slice(lastSectionStart);
    // 找到第一个 <script> 标签的位置
    const scriptIdx = afterContent.search(/<script[\s>]/i);
    if (scriptIdx > 0) {
      const beforeScript = afterContent.slice(0, scriptIdx);
      // 提取所有独立的 <div id="...">...</div> 元素（不属于 section 内部的）
      // 找到 section 的第一个 </div>（section 级别的闭合标签）后面的内容
      // 通过匹配 <!-- 注释 --> 和 <div id="..."> 来提取共享元素
      const sharedDivs = [];
      const divRegex = /<div\s+id="[^"]+"\s+[^>]*>[\s\S]*?<\/div>/g;
      let dm;
      // 只在 section 闭合后查找：找到 section 的第一个闭合 </div>
      const sectionClose = beforeScript.indexOf('</div>');
      if (sectionClose > 0) {
        const afterSectionClose = beforeScript.slice(sectionClose + 6);
        while ((dm = divRegex.exec(afterSectionClose)) !== null) {
          sharedDivs.push(dm[0]);
        }
      }
      if (sharedDivs.length > 0) {
        sharedHtmlElements = sharedDivs.join('\n');
      }
    }
  }

  // 如果有效果缺少 script，尝试从文件的共享 script 块中智能分配
  const effectsWithoutScripts = effects.filter(e => e.scripts.length === 0);
  // 提取文件中所有非 src 的 script 内容（即使已有 script 的效果也需要，用于后续恢复）
  const allScriptRegex2 = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let allJsFull = '';
  let scriptMatch2;
  while ((scriptMatch2 = allScriptRegex2.exec(html)) !== null) {
    if (scriptMatch2[1].trim()) allJsFull += scriptMatch2[1] + '\n';
  }

  if (effectsWithoutScripts.length > 0) {
    // 提取文件中所有非 src 的 script 内容
    const allScriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
    let allJs = '';
    let scriptMatch;
    while ((scriptMatch = allScriptRegex.exec(html)) !== null) {
      if (scriptMatch[1].trim()) allJs += scriptMatch[1] + '\n';
    }

    if (allJs) {
      // 策略1：按 IIFE 边界拆分
      const iifes = [];
      const iifeRegex = /\(function\s*\([^)]*\)\s*\{/g;
      let iifeMatch;
      const iifeStarts = [];
      while ((iifeMatch = iifeRegex.exec(allJs)) !== null) {
        iifeStarts.push(iifeMatch.index);
      }
      for (let i = 0; i < iifeStarts.length; i++) {
        const start = iifeStarts[i];
        const end = i < iifeStarts.length - 1 ? iifeStarts[i + 1] : allJs.length;
        let block = allJs.slice(start, end).trim();
        block = block.replace(/\n\/\/\s*===.*$/s, '').trim();
        iifes.push(block);
      }

      // 策略2：按注释分隔符拆分（// N. xxx 或 // Generate xxx 或 // Xxx）
      function splitByComments(js) {
        const lines = js.split('\n');
        const blocks = [];
        let currentBlock = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // 检测顶层分隔注释（如 // 1. Xxx, // === Xxx ===, // Xxx, // Xxx xxx）
          const isSep = /^\s*\/\/\s*(\d+\.\s|===|[A-Z][a-z])/.test(line) && !/^\s*\/\/\s*(eslint|prettier|noinspection|ts-|@|if |else|return|const|let|var)/.test(line);
          if (isSep && currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [line];
          } else {
            currentBlock.push(line);
          }
        }
        if (currentBlock.length > 0) blocks.push(currentBlock.join('\n'));
        return blocks.filter(b => b.trim().length > 0);
      }

      // 辅助函数：从 JS 中提取所有 getElementById 的 ID
      function getJsIds(js) {
        const ids = [];
        const re = /getElementById\(['"]([^'"]+)['"]\)/g;
        let m2;
        while ((m2 = re.exec(js)) !== null) ids.push(m2[1]);
        return ids;
      }

      // 辅助函数：获取效果 HTML 中的所有 ID
      function getEffIds(eff2) {
        const ids = [];
        const re = /id="([^"]+)"/g;
        let m2;
        while ((m2 = re.exec(eff2.demoHtml)) !== null) ids.push(m2[1]);
        if (eff2.demoId) ids.push(eff2.demoId);
        if (eff2.id) ids.push(eff2.id);
        return ids;
      }

      // 如果有 IIFE，先用 IIFE 匹配
      if (iifes.length > 0) {
        for (const eff of effectsWithoutScripts) {
          const ids = getEffIds(eff);
          for (const iife of iifes) {
            for (const elemId of ids) {
              if (iife.includes(`'${elemId}'`) || iife.includes(`"${elemId}"`)) {
                eff.scripts.push(iife);
                break;
              }
            }
            if (eff.scripts.length > 0) break;
          }
        }
      }

      // 对于仍然没有 script 的效果，用注释块 + ID 匹配策略
      const stillWithout = effectsWithoutScripts.filter(e => e.scripts.length === 0);
      if (stillWithout.length > 0) {
        const commentBlocks = splitByComments(allJs);

        for (const eff of stillWithout) {
          const effIds = getEffIds(eff);
          // 提取效果 HTML 中 onclick 等调用的函数名
          const effFuncs = [];
          const funcCallRegex = /on\w+="([a-zA-Z_]\w*)\(/g;
          let fcm;
          while ((fcm = funcCallRegex.exec(eff.demoHtml)) !== null) {
            effFuncs.push(fcm[1]);
          }

          for (const block of commentBlocks) {
            const jsIds = getJsIds(block);
            // 提取该块定义的函数名
            const funcDefs = [];
            const fdRegex = /function\s+([a-zA-Z_]\w*)\s*\(/g;
            let fdm;
            while ((fdm = fdRegex.exec(block)) !== null) funcDefs.push(fdm[1]);

            const idMatch = jsIds.some(id => effIds.includes(id));
            const funcMatch = funcDefs.some(fn => effFuncs.includes(fn));
            if (idMatch || funcMatch) {
              eff.scripts.push(block);
            }
          }
        }
      }

      // 最终 fallback：如果效果仍然没有 JS，不再盲目分配整个 script
      // 纯 CSS 效果不需要 JS，让它们保持没有 script 即可
    }
  }

  // 对所有有 scripts 的效果，过滤掉不属于该效果的代码块
  // （处理最后一个 section 包含了共享 script 的情况）
  for (const eff of effects) {
    if (eff.scripts.length === 0) continue;
    const effIds = [];
    const idRe = /id="([^"]+)"/g;
    let idM;
    while ((idM = idRe.exec(eff.demoHtml)) !== null) effIds.push(idM[1]);
    if (eff.demoId) effIds.push(eff.demoId);
    if (eff.id) effIds.push(eff.id);
    // 提取效果 HTML 的 onclick 函数名
    const effFuncs = [];
    const fcRe = /on\w+="([a-zA-Z_]\w*)\(/g;
    let fcM;
    while ((fcM = fcRe.exec(eff.demoHtml)) !== null) effFuncs.push(fcM[1]);

    // 对每个 script，检查是否是一个大的"共享"代码块（包含多个效果的 ID）
    const filteredScripts = [];
    for (const script of eff.scripts) {
      // 检查该 script 中引用的所有 getElementById IDs
      const jsIds = [];
      const jsIdRe = /getElementById\(['"]([^'"]+)['"]\)/g;
      let jm;
      while ((jm = jsIdRe.exec(script)) !== null) jsIds.push(jm[1]);
      
      // 如果 JS 中引用的 ID 超过一半不在效果中，说明是共享代码块
      const missingIds = jsIds.filter(id => !effIds.includes(id));
      if (jsIds.length > 2 && missingIds.length > jsIds.length * 0.5) {
        // 这是一个共享代码块，需要按注释拆分并只保留相关部分
        const lines = script.split('\n');
        const blocks = [];
        let currentBlock = [];
        for (const line of lines) {
          const isSep = /^\s*\/\/\s*(\d+\.\s|===|[A-Z][a-z])/.test(line) && !/^\s*\/\/\s*(eslint|prettier|noinspection|ts-|@|if |else|return|const|let|var)/.test(line);
          if (isSep && currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
            currentBlock = [line];
          } else {
            currentBlock.push(line);
          }
        }
        if (currentBlock.length > 0) blocks.push(currentBlock.join('\n'));

        // 只保留与该效果相关的块
        for (const block of blocks) {
          const blockIds = [];
          const bIdRe = /getElementById\(['"]([^'"]+)['"]\)/g;
          let bm;
          while ((bm = bIdRe.exec(block)) !== null) blockIds.push(bm[1]);
          const blockFuncs = [];
          const bfRe = /function\s+([a-zA-Z_]\w*)\s*\(/g;
          let bfm;
          while ((bfm = bfRe.exec(block)) !== null) blockFuncs.push(bfm[1]);

          const idMatch = blockIds.some(id => effIds.includes(id));
          const funcMatch = blockFuncs.some(fn => effFuncs.includes(fn));
          if (idMatch || funcMatch) {
            filteredScripts.push(block);
          } else if (blockIds.length === 0 && blockFuncs.length === 0) {
            // 无引用的代码块（如变量声明），如果很短就保留
            if (block.trim().length < 200) filteredScripts.push(block);
          }
        }
      } else {
        // 该 script 的引用基本都在效果中，保留原样
        filteredScripts.push(script);
      }
    }
    eff.scripts = filteredScripts;
  }

  // 恢复机制：检测"统一脚本"模式
  // 如果共享脚本中包含 currentSection 或 data-effect 模式，说明这是一个
  // 统一的事件循环架构，每个独立效果页面都需要完整脚本
  if (allJsFull && allJsFull.includes('currentSection')) {
    const hasInteractivity = (scripts) => {
      const joined = scripts.join('\n');
      return joined.includes('addEventListener') || 
             joined.includes('requestAnimationFrame') || 
             joined.includes('setInterval') ||
             joined.includes('setTimeout') ||
             joined.includes('.onmouse') ||
             joined.includes('.onclick') ||
             joined.includes('querySelectorAll');
    };

    // 提取脚本中的 data-effect 到 currentSection 赋值模式
    const csAssignRegex = /currentSection\s*=\s*sec\s*\?\s*sec\.dataset\.effect\s*:\s*''/;
    const hasCsPattern = csAssignRegex.test(allJsFull);

    for (const eff of effects) {
      // 需要恢复的条件：效果没有交互能力（过滤掉了核心逻辑，或从未获得脚本）
      const needsRestore = (eff.scripts.length > 0 && !hasInteractivity(eff.scripts)) ||
                           (eff.scripts.length === 0);
      
      if (needsRestore) {
        // 从原始 section 的 data-effect 属性获取效果标识
        // 在 extractIframeEffects 中 eff.id 是 section 的 id 属性
        // 需要从原始 HTML 获取 data-effect
        const sectionMatch = html.match(new RegExp(`<div[^>]*id="${eff.id}"[^>]*data-effect="([^"]+)"`));
        const dataEffect = sectionMatch ? sectionMatch[1] : eff.id;
        
        // 恢复完整脚本，并硬编码 currentSection
        let restoredScript = allJsFull;
        if (hasCsPattern) {
          restoredScript = restoredScript.replace(
            /currentSection\s*=\s*sec\s*\?\s*sec\.dataset\.effect\s*:\s*''/g,
            `currentSection = '${dataEffect}'`
          );
          // 移除 elementFromPoint 检测（独立页面整个页面就是一个效果）
          restoredScript = restoredScript.replace(
            /const\s+el\s*=\s*document\.elementFromPoint\([^)]+\);\s*\n\s*const\s+sec\s*=\s*el\s*\?\s*el\.closest\(['"]\.section['"]\)\s*:\s*null;/g,
            ''
          );
        }
        // 对不存在的 DOM 元素添加 null 保护：
        // 将 getElementById(...).getContext(...) 改为 getElementById(...)?.getContext(...)
        restoredScript = restoredScript.replace(
          /document\.getElementById\(([^)]+)\)\.getContext/g,
          'document.getElementById($1)?.getContext'
        );
        // 将 getElementById(...).parentElement 改为 getElementById(...)?.parentElement
        restoredScript = restoredScript.replace(
          /document\.getElementById\(([^)]+)\)\.(parentElement|getBoundingClientRect|addEventListener|style|width|height|offsetWidth|offsetHeight)/g,
          'document.getElementById($1)?.$2'
        );
        // 包裹整个恢复脚本在 try-catch 中避免初始化崩溃
        restoredScript = `try {\n${restoredScript}\n} catch(_e) { console.warn('Effect init partial:', _e.message); }`;
        eff.scripts = [restoredScript];
        // 标记需要注入共享 HTML 元素
        eff._needsSharedHtml = true;
      }
    }
  }

  return { effects, globalCss, sharedHtmlElements };
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
// JS/CSS 分析：为 iframe 类型效果提取可控参数
// ============================================================
function extractIframeControls(scripts, localCss, demoHtml) {
  const controls = [];
  const allJs = scripts.join('\n');
  const allCode = allJs + '\n' + (localCss || '');

  // --- 1. 动画速度控制（几乎所有效果都适用）---
  const hasAnimation = /requestAnimationFrame|setInterval|setTimeout|@keyframes|animation/.test(allCode);
  if (hasAnimation) {
    controls.push({
      type: 'range', id: 'time-speed', label: '速度',
      min: 0.1, max: 5, step: 0.1, value: 1, unit: 'x',
      action: 'timeScale'
    });
  }

  // --- 2. 从 JS 代码中提取数量常量 ---
  const countPatterns = [
    { regex: /(?:const|let|var)\s+(num\w*|count\w*|total\w*|NUM_\w+|PARTICLE_?COUNT|MAX_\w+)\s*=\s*(\d+)/gi, label: '数量' },
    { regex: /(?:const|let|var)\s+(\w*(?:particles|points|stars|dots|circles|lines|spikes|segments|rings|waves)\w*)\s*=\s*(\d+)/gi, label: '数量' },
  ];
  const usedIds = new Set();
  for (const pat of countPatterns) {
    let m;
    while ((m = pat.regex.exec(allJs)) !== null) {
      const varName = m[1];
      const val = parseInt(m[2]);
      if (val >= 3 && val <= 10000 && !usedIds.has(varName)) {
        usedIds.add(varName);
        controls.push({
          type: 'range', id: `js-${varName}`, label: pat.label,
          min: Math.max(1, Math.round(val * 0.1)), max: Math.round(val * 3),
          step: val > 100 ? 10 : 1, value: val, unit: '',
          action: 'jsVar', varName
        });
      }
    }
  }

  // --- 3. 从 JS 代码中提取速度/半径/尺寸常量 ---
  const sizePatterns = [
    { regex: /(?:const|let|var)\s+(\w*(?:radius|size|scale|speed|velocity|amplitude|frequency|thickness|blur|opacity|strength|intensity)\w*)\s*=\s*(\d+\.?\d*)/gi, labelMap: {
      radius: '半径', size: '尺寸', scale: '缩放', speed: '速度',
      velocity: '速度', amplitude: '振幅', frequency: '频率',
      thickness: '粗细', blur: '模糊', opacity: '透明度',
      strength: '强度', intensity: '强度'
    }},
  ];
  for (const pat of sizePatterns) {
    let m;
    while ((m = pat.regex.exec(allJs)) !== null) {
      const varName = m[1];
      const val = parseFloat(m[2]);
      if (val > 0 && !usedIds.has(varName)) {
        usedIds.add(varName);
        const matchedKey = Object.keys(pat.labelMap).find(k => varName.toLowerCase().includes(k));
        const label = matchedKey ? pat.labelMap[matchedKey] : '参数';
        controls.push({
          type: 'range', id: `js-${varName}`, label,
          min: Math.round(val * 0.1 * 100) / 100, max: Math.round(val * 4 * 100) / 100,
          step: val >= 10 ? 1 : 0.01, value: val, unit: '',
          action: 'jsVar', varName
        });
      }
    }
  }

  // --- 4. 从 CSS 中提取动画时长 ---
  const durationMatch = (localCss || '').match(/animation[^:]*:\s*[^;]*?(\d+\.?\d*)s/);
  if (durationMatch) {
    const dur = parseFloat(durationMatch[1]);
    if (dur > 0) {
      controls.push({
        type: 'range', id: 'css-duration', label: '动画时长',
        min: Math.round(dur * 0.2 * 10) / 10, max: Math.round(dur * 5 * 10) / 10,
        step: 0.1, value: dur, unit: 's',
        action: 'cssDuration'
      });
    }
  }

  // --- 5. 从 CSS 中提取颜色 ---
  const colorPatterns = [
    /(?:background|color|border-color|box-shadow|text-shadow)[^;]*?(#[0-9a-fA-F]{3,8})/g,
  ];
  let colorCount = 0;
  for (const pat of colorPatterns) {
    let cm;
    while ((cm = pat.exec(localCss || '')) !== null && colorCount < 3) {
      let hex = cm[1];
      if (hex.startsWith('#')) {
        hex = expandHex(hex);
        // 只接受 6 位 hex（#RRGGBB），截断 8 位的 alpha 通道
        if (hex.length > 7) hex = hex.slice(0, 7);
        if (hex.length === 7 && !isNearBlack(hex) && hex !== '#ffffff' && hex !== '#111111') {
          controls.push({
            type: 'color', id: `css-color-${colorCount}`, label: colorCount === 0 ? '主色' : '副色',
            value: hex, action: 'cssColor', index: colorCount
          });
          colorCount++;
        }
      }
    }
  }

  // --- 6. 从 JS 的 Shader 代码中提取 vec3 颜色值 ---
  const vec3Regex = /vec3\s*\(\s*(0?\.\d+|1\.0)\s*,\s*(0?\.\d+|1\.0)\s*,\s*(0?\.\d+|1\.0)\s*\)/g;
  let shaderColorCount = 0;
  let vm;
  while ((vm = vec3Regex.exec(allJs)) !== null && shaderColorCount < 3) {
    const r = Math.round(parseFloat(vm[1]) * 255);
    const g = Math.round(parseFloat(vm[2]) * 255);
    const b = Math.round(parseFloat(vm[3]) * 255);
    // 跳过接近黑色/白色/灰色的
    if (r + g + b > 60 && r + g + b < 700 && !(Math.abs(r - g) < 20 && Math.abs(g - b) < 20)) {
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      controls.push({
        type: 'color', id: `shader-color-${shaderColorCount}`,
        label: shaderColorCount === 0 ? '主色' : shaderColorCount === 1 ? '副色' : '辅助色',
        value: hex, action: 'shaderColor', index: shaderColorCount
      });
      shaderColorCount++;
    }
  }

  // --- 7. 鼠标影响力（如果效果有鼠标交互）---
  if (/mouse|clientX|clientY|mousemove/.test(allJs)) {
    controls.push({
      type: 'range', id: 'mouse-influence', label: '鼠标影响',
      min: 0, max: 3, step: 0.1, value: 1, unit: 'x',
      action: 'mouseScale'
    });
  }

  // --- 8. CSS transition 速度（如果没有其他动画控制但有 transition）---
  if (controls.length === 0 || (!controls.find(c => c.action === 'timeScale') && !controls.find(c => c.action === 'cssDuration'))) {
    const transMatch = (localCss || '').match(/transition[^;]*?(\d+\.?\d*)s/);
    if (transMatch) {
      const dur = parseFloat(transMatch[1]);
      if (dur > 0.05 && dur < 30) {
        controls.push({
          type: 'range', id: 'transition-speed', label: '过渡速度',
          min: Math.round(dur * 0.2 * 10) / 10, max: Math.round(dur * 5 * 10) / 10,
          step: 0.1, value: dur, unit: 's',
          action: 'transitionDuration'
        });
      }
    }
  }

  // --- 9. 从 HTML/CSS 中提取 border-radius ---
  const brMatch = (localCss || '').match(/border-radius\s*:\s*(\d+)(px|%)/);
  if (brMatch && controls.length < 8) {
    const val = parseInt(brMatch[1]);
    const unit = brMatch[2];
    if (val > 0 && val < 200) {
      controls.push({
        type: 'range', id: 'css-border-radius', label: '圆角',
        min: 0, max: unit === '%' ? 50 : Math.max(100, val * 3),
        step: 1, value: val, unit: unit,
        action: 'cssBorderRadius'
      });
    }
  }

  return controls.slice(0, 10);
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
    iframeCategories.push({ id: catId, file, title: cleanTitle, effects: iframeResult.effects, globalCss: iframeResult.globalCss, sharedHtmlElements: iframeResult.sharedHtmlElements || '' });
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
.site-nav{position:fixed;top:0;left:0;right:0;z-index:200;background:rgba(255,255,255,.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid #f0f0f0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.nav-inner{display:flex;align-items:center;height:56px;padding:0 24px;gap:12px;max-width:1400px;margin:0 auto}
.nav-logo{font-size:1rem;font-weight:800;color:#0d0c22;white-space:nowrap;letter-spacing:-.03em;flex-shrink:0;text-decoration:none}
.nav-scroll-wrap{position:relative;flex:1;overflow:hidden;margin:0 8px}
.nav-scroll{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;scroll-behavior:smooth;padding:6px 0}
.nav-scroll::-webkit-scrollbar{display:none}
.nav-item{padding:6px 14px;border-radius:8px;font-size:.8rem;color:#6e6d7a;white-space:nowrap;transition:all .2s;text-decoration:none;flex-shrink:0;font-weight:500}
.nav-item:hover{color:#0d0c22;background:#f3f3f4}
.nav-item.active{color:#0d0c22;background:#f3f3f4;font-weight:600}
.nav-arrow{width:32px;height:32px;border-radius:50%;background:#f3f3f4;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .2s;color:#6e6d7a}
.nav-arrow:hover{background:#e8e8ea;color:#0d0c22}
.nav-arrow svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.5;fill:none}
.nav-expand-btn{width:32px;height:32px;border-radius:50%;background:#f3f3f4;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .2s;color:#6e6d7a}
.nav-expand-btn:hover{background:#e8e8ea;color:#0d0c22}
.nav-expand-btn svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.5;fill:none;transition:transform .2s}
.nav-expand-btn.open svg{transform:rotate(180deg)}
.nav-dropdown{position:fixed;top:56px;left:0;right:0;z-index:199;background:rgba(255,255,255,.98);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid #f0f0f0;padding:20px 24px;display:none;flex-wrap:wrap;gap:8px;max-height:60vh;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.08)}
.nav-dropdown.open{display:flex}
.nav-dropdown .nav-item{padding:10px 18px;font-size:.82rem}
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
    <a href="${pathPrefix}_fav.html" class="nav-fav-link"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span class="fav-count" style="display:none">0</span></a>
    <button class="nav-expand-btn" id="navExpand"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></button>
  </div>
</nav>
<div class="nav-dropdown" id="navDropdown">${items}</div>`;
}

// ============================================================
// 控制面板样式
// ============================================================
const ctrlCss = `
.ctrl-sidebar{width:280px;flex-shrink:0;background:#fff;border-left:1px solid #f0f0f0;display:flex;flex-direction:column;gap:8px;padding:72px 16px 16px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#e0e0e0 transparent}
.ctrl-sidebar::-webkit-scrollbar{width:4px}
.ctrl-sidebar::-webkit-scrollbar-thumb{background:#e0e0e0;border-radius:2px}
.ctrl-sidebar .ctrl-title{font-size:.75rem;color:#6e6d7a;font-weight:600;padding:0 4px 8px;border-bottom:1px solid #f0f0f0;margin-bottom:4px}
.ctrl-sidebar .ctrl-empty{font-size:.7rem;color:#9e9ea7;text-align:center;padding:24px 0}
.ctrl-card{background:#f8f8f9;border:1px solid #ebebed;border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.ctrl-card .ctrl-prop{display:flex;align-items:center;gap:8px;padding:4px 0}
.ctrl-card .ctrl-prop-label{font-size:.68rem;color:#6e6d7a;min-width:56px;flex-shrink:0;font-weight:500}
.ctrl-card .ctrl-prop input[type="range"]{flex:1;height:4px;-webkit-appearance:none;appearance:none;background:#e0e0e0;border-radius:2px;outline:none}
.ctrl-card .ctrl-prop input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#ea4c89;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.15)}
.ctrl-card .ctrl-prop input[type="color"]{width:30px;height:30px;border:2px solid #ebebed;border-radius:8px;cursor:pointer;padding:0;background:none;-webkit-appearance:none;flex-shrink:0}
.ctrl-card .ctrl-prop input[type="color"]::-webkit-color-swatch-wrapper{padding:2px}
.ctrl-card .ctrl-prop input[type="color"]::-webkit-color-swatch{border-radius:4px;border:none}
.ctrl-card .ctrl-prop-val{font-size:.65rem;color:#9e9ea7;min-width:36px;text-align:right;flex-shrink:0;font-weight:500}
.ctrl-reset-btn{padding:10px 14px;border-radius:10px;background:#f3f3f4;border:1px solid #ebebed;color:#6e6d7a;font-size:.72rem;cursor:pointer;transition:all .2s;text-align:center;margin-top:4px;font-weight:500}
.ctrl-reset-btn:hover{background:#e8e8ea;color:#0d0c22}
.back-btn{position:fixed;top:66px;left:20px;z-index:201;padding:8px 16px;border-radius:10px;background:#fff;border:1px solid #ebebed;color:#6e6d7a;font-size:.78rem;cursor:pointer;transition:all .2s;text-decoration:none;display:flex;align-items:center;gap:6px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.back-btn:hover{background:#f3f3f4;color:#0d0c22;box-shadow:0 4px 12px rgba(0,0,0,.1)}
.back-btn svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.5;fill:none}
@media(max-width:768px){.ctrl-sidebar{position:fixed;bottom:0;left:0;right:0;width:100%;max-height:200px;border-left:none;border-top:1px solid #f0f0f0;padding:12px;flex-direction:row;flex-wrap:wrap;z-index:100;box-shadow:0 -4px 16px rgba(0,0,0,.08)}.effect-page{padding-bottom:200px}}
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
// iframe 效果的时间缩放前置脚本（必须在效果脚本之前加载）
// ============================================================
const timeScalePreludeJs = `
(function(){
  // Hook performance.now for time scaling
  var _origNow = performance.now.bind(performance);
  var _timeScale = 1;
  var _timeBase = _origNow();
  var _virtualTime = _timeBase;
  var _lastReal = _timeBase;
  window.__getTimeScale = function(){ return _timeScale; };
  window.__setTimeScale = function(v){ _timeScale = v; };
  Object.defineProperty(performance, 'now', { value: function() {
    var real = _origNow();
    var delta = real - _lastReal;
    _lastReal = real;
    _virtualTime += delta * _timeScale;
    return _virtualTime;
  }, writable: true, configurable: true });
  // Also hook Date.now for setInterval-based effects
  var _origDateNow = Date.now;
  var _dateBase = _origDateNow();
  var _virtualDate = _dateBase;
  var _lastRealDate = _dateBase;
  Date.now = function() {
    var real = _origDateNow();
    var delta = real - _lastRealDate;
    _lastRealDate = real;
    _virtualDate += delta * _timeScale;
    return Math.floor(_virtualDate);
  };
})();`;

// ============================================================
// iframe 效果的控制面板运行时 JS
// ============================================================
const iframeCtrlPanelJs = `
(function(){
  var controls = window.__EFFECT_CONTROLS__;
  var sidebar = document.getElementById('ctrlSidebar');
  if (!controls || controls.length === 0) {
    sidebar.innerHTML += '<div class="ctrl-empty">该效果无可调属性</div>';
    return;
  }
  var card = document.createElement('div');
  card.className = 'ctrl-card';

  // CSS duration control
  var _origDurations = null;
  function getAllAnimatedEls() {
    var stage = document.querySelector('.stage');
    if (!stage) return [];
    return [stage].concat(Array.prototype.slice.call(stage.querySelectorAll('*')));
  }
  function cacheDurations() {
    if (_origDurations) return;
    _origDurations = new Map();
    getAllAnimatedEls().forEach(function(el) {
      var cs = getComputedStyle(el);
      if (cs.animationDuration && cs.animationDuration !== '0s') {
        _origDurations.set(el, parseFloat(cs.animationDuration));
      }
    });
  }

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
          if (c.action === 'timeScale') {
            vs.textContent = v.toFixed(1) + 'x';
            window.__setTimeScale(v);
            // Also scale CSS animations
            cacheDurations();
            _origDurations.forEach(function(origDur, el) {
              el.style.animationDuration = (origDur / v) + 's';
            });
          } else if (c.action === 'cssDuration') {
            vs.textContent = v.toFixed(1) + 's';
            cacheDurations();
            _origDurations.forEach(function(origDur, el) {
              el.style.animationDuration = v + 's';
            });
          } else if (c.action === 'mouseScale') {
            vs.textContent = v.toFixed(1) + 'x';
            window.__MOUSE_SCALE__ = v;
          } else if (c.action === 'jsVar') {
            vs.textContent = v + (c.unit || '');
            window['__ctrl_' + c.varName] = v;
            // Trigger resize to recalc layout-dependent vars (e.g. columns/drops for fontSize)
            window.dispatchEvent(new Event('resize'));
            // Also trigger custom event for effects without rAF loop
            window.dispatchEvent(new Event('__jsVarChanged'));
          } else if (c.action === 'transitionDuration') {
            vs.textContent = v.toFixed(1) + 's';
            var stage = document.querySelector('.stage');
            if (stage) {
              var allEls = [stage].concat(Array.prototype.slice.call(stage.querySelectorAll('*')));
              allEls.forEach(function(el) {
                var cs = getComputedStyle(el);
                if (cs.transitionDuration && cs.transitionDuration !== '0s') {
                  el.style.transitionDuration = v + 's';
                }
              });
            }
          } else if (c.action === 'cssBorderRadius') {
            vs.textContent = v + (c.unit || 'px');
            var stage = document.querySelector('.stage');
            if (stage) {
              var allEls = Array.prototype.slice.call(stage.querySelectorAll('*'));
              allEls.forEach(function(el) {
                var cs = getComputedStyle(el);
                if (cs.borderRadius && cs.borderRadius !== '0px') {
                  el.style.borderRadius = v + (c.unit || 'px');
                }
              });
            }
          }
        });
      })(ctrl, input, valSpan);
    } else if (ctrl.type === 'color') {
      row.innerHTML = '<span class="ctrl-prop-label">' + ctrl.label + '</span><input type="color" value="' + ctrl.value + '"><span class="ctrl-prop-val">' + ctrl.value.slice(0,7) + '</span>';
      var input = row.querySelector('input');
      var valSpan = row.querySelector('.ctrl-prop-val');

      (function(c, inp, vs) {
        inp.addEventListener('input', function() {
          vs.textContent = inp.value;
          if (c.action === 'cssColor') {
            var stage = document.querySelector('.stage');
            if (stage) {
              var allEls = [stage].concat(Array.prototype.slice.call(stage.querySelectorAll('*')));
              allEls.forEach(function(el) {
                if (c.index === 0) {
                  el.style.setProperty('--ctrl-color-0', inp.value);
                  if (el.style.color && el.style.color !== 'inherit') el.style.color = inp.value;
                }
              });
            }
            document.documentElement.style.setProperty('--ctrl-color-' + c.index, inp.value);
          } else if (c.action === 'shaderColor') {
            window['__shaderColor' + c.index] = inp.value;
          }
        });
      })(ctrl, input, valSpan);
    }
    card.appendChild(row);
  });

  sidebar.appendChild(card);

  var resetBtn = document.createElement('button');
  resetBtn.className = 'ctrl-reset-btn';
  resetBtn.textContent = '重置全部';
  resetBtn.addEventListener('click', function() { location.reload(); });
  sidebar.appendChild(resetBtn);
})();`;

// ============================================================
// 复制给 AI 按钮 - CSS + JS（注入到 _effects/ 和 _cat/ 页面）
// ============================================================
const copyBtnCss = `
.copy-ai-btn{position:fixed;top:64px;right:16px;z-index:201;padding:8px 16px;border-radius:8px;background:rgba(234,76,137,.08);border:1px solid rgba(234,76,137,.2);color:#ea4c89;font-size:.75rem;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.copy-ai-btn:hover{background:rgba(234,76,137,.15);color:#d63b78;border-color:rgba(234,76,137,.4)}
.copy-ai-btn.copied{background:rgba(67,233,123,.1);border-color:rgba(67,233,123,.3);color:#2dba5e}
.copy-ai-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`;

// 为 _cat/ 分类页面的卡片添加复制按钮的 CSS
const catCopyBtnCss = `
.card{position:relative}
.card .card-copy-btn{position:absolute;top:8px;right:8px;z-index:10;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.08);color:#6e6d7a;font-size:.6rem;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:4px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.card:hover .card-copy-btn{opacity:1;pointer-events:auto}
.card .card-copy-btn:hover{background:#ea4c89;color:#fff;border-color:#ea4c89}
.card .card-copy-btn.copied{background:rgba(67,233,123,.15);border-color:rgba(67,233,123,.3);color:#2dba5e;opacity:1;pointer-events:auto}
.card .card-copy-btn svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`;

// ============================================================
// 收藏功能 - CSS + JS
// ============================================================
const favBtnCss = `
.fav-btn{position:absolute;top:8px;left:8px;z-index:10;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.85);border:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;opacity:0;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.card:hover .fav-btn{opacity:1;pointer-events:auto}
.fav-btn:hover{background:#fff;transform:scale(1.1);box-shadow:0 4px 12px rgba(0,0,0,.15)}
.fav-btn.is-fav{opacity:1;pointer-events:auto;background:rgba(234,76,137,.1);border-color:rgba(234,76,137,.2)}
.fav-btn svg{width:16px;height:16px;stroke:#9e9ea7;stroke-width:2;fill:none;transition:all .2s}
.fav-btn:hover svg{stroke:#ea4c89}
.fav-btn.is-fav svg{stroke:#ea4c89;fill:#ea4c89}
.fav-btn-detail{position:fixed;top:64px;left:80px;z-index:201;width:36px;height:36px;border-radius:50%;background:#fff;border:1px solid #ebebed;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.fav-btn-detail:hover{background:#fef0f5;border-color:rgba(234,76,137,.3);transform:scale(1.1)}
.fav-btn-detail.is-fav{background:rgba(234,76,137,.1);border-color:rgba(234,76,137,.3)}
.fav-btn-detail svg{width:18px;height:18px;stroke:#9e9ea7;stroke-width:2;fill:none;transition:all .2s}
.fav-btn-detail:hover svg{stroke:#ea4c89}
.fav-btn-detail.is-fav svg{stroke:#ea4c89;fill:#ea4c89}
.nav-fav-link{display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;font-size:.8rem;color:#6e6d7a;white-space:nowrap;transition:all .2s;text-decoration:none;flex-shrink:0;font-weight:500}
.nav-fav-link:hover{color:#ea4c89;background:rgba(234,76,137,.06)}
.nav-fav-link svg{width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none}
.nav-fav-link .fav-count{font-size:.65rem;background:#ea4c89;color:#fff;border-radius:10px;padding:1px 6px;min-width:18px;text-align:center;font-weight:600}
`;

const favHeartSvg = '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

// 卡片上的收藏按钮 JS（用于 _cat/ 页面）
const favCardJs = `
// Favorites system
(function(){
  var FAV_KEY='bfx_favorites';
  function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch(e){return[];}}
  function setFavs(arr){localStorage.setItem(FAV_KEY,JSON.stringify(arr));}
  function isFav(id){return getFavs().some(function(f){return f.id===id;});}
  function toggleFav(id,name,cat,catId,file){
    var favs=getFavs();
    var idx=favs.findIndex(function(f){return f.id===id;});
    if(idx>-1){favs.splice(idx,1);}
    else{favs.push({id:id,name:name,cat:cat,catId:catId,file:file,ts:Date.now()});}
    setFavs(favs);
    return idx===-1;
  }
  // Init card fav buttons
  document.querySelectorAll('.fav-btn[data-fav-id]').forEach(function(btn){
    var id=btn.getAttribute('data-fav-id');
    if(isFav(id))btn.classList.add('is-fav');
    btn.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      var name=btn.getAttribute('data-fav-name')||'';
      var cat=btn.getAttribute('data-fav-cat')||'';
      var catId=btn.getAttribute('data-fav-catid')||'';
      var file=btn.getAttribute('data-fav-file')||'';
      var added=toggleFav(id,name,cat,catId,file);
      btn.classList.toggle('is-fav',added);
    });
  });
  // Update nav fav count
  var countEl=document.querySelector('.fav-count');
  if(countEl){var n=getFavs().length;countEl.textContent=n;countEl.style.display=n?'':'none';}
})();
`;

// 详情页的收藏按钮 JS
const favDetailJs = `
// Favorites system - detail page
(function(){
  var FAV_KEY='bfx_favorites';
  function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch(e){return[];}}
  function setFavs(arr){localStorage.setItem(FAV_KEY,JSON.stringify(arr));}
  var btn=document.getElementById('favDetailBtn');
  if(!btn)return;
  var id=btn.getAttribute('data-fav-id');
  var name=btn.getAttribute('data-fav-name')||'';
  var cat=btn.getAttribute('data-fav-cat')||'';
  var catId=btn.getAttribute('data-fav-catid')||'';
  var file=btn.getAttribute('data-fav-file')||'';
  var favs=getFavs();
  if(favs.some(function(f){return f.id===id;}))btn.classList.add('is-fav');
  btn.addEventListener('click',function(){
    var favs=getFavs();
    var idx=favs.findIndex(function(f){return f.id===id;});
    if(idx>-1){favs.splice(idx,1);btn.classList.remove('is-fav');}
    else{favs.push({id:id,name:name,cat:cat,catId:catId,file:file,ts:Date.now()});btn.classList.add('is-fav');}
    setFavs(favs);
    var countEl=document.querySelector('.fav-count');
    if(countEl){var n=favs.length;countEl.textContent=n;countEl.style.display=n?'':'none';}
  });
  var countEl=document.querySelector('.fav-count');
  if(countEl){var n=favs.length;countEl.textContent=n;countEl.style.display=n?'':'none';}
})();
`;

// ============================================================
// 生成独立效果详情页（_effects/） - 带专属控制面板
// ============================================================
const effectsDir = path.join(dir, '_effects');
if (fs.existsSync(effectsDir)) fs.rmSync(effectsDir, { recursive: true });
fs.mkdirSync(effectsDir);

// ============================================================
// 预处理：为 parsedCategories 的每个效果智能分配 JS
// ============================================================
function splitScriptIntoBlocks(scriptContent) {
  // 按顶层注释分割代码块
  // 支持格式：// N. xxx, // === xxx ===, // Xxx xxx (首字母大写的注释)
  const lines = scriptContent.split('\n');
  const blocks = [];
  let currentBlock = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 检测是否是顶层分隔注释（如 // 1. Xxx, // === Xxx ===, // Xxx, // Xxx xxx）
    const isSeparator = /^\s*\/\/\s*(\d+\.\s|===|[A-Z][a-z])/.test(line) && !/^\s*\/\/\s*(eslint|prettier|noinspection|ts-|@|if |else|return|const|let|var)/.test(line);
    if (isSeparator && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }
  return blocks.filter(b => b.trim().length > 0);
}

function extractIdsFromHtml(html) {
  const ids = [];
  const idRegex = /id="([^"]+)"/g;
  let m;
  while ((m = idRegex.exec(html)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

function extractIdsFromJs(js) {
  const ids = [];
  const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
  let m;
  while ((m = regex.exec(js)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

function extractFunctionCallsFromHtml(html) {
  // 提取 onclick="funcName(this)" 等事件处理函数名
  const funcs = [];
  const regex = /on\w+="([a-zA-Z_]\w*)\(/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    funcs.push(m[1]);
  }
  return funcs;
}

function assignScriptsToEffects(cat) {
  if (!cat.scripts || cat.scripts.length === 0) return;

  const allJs = cat.scripts.join('\n');
  // 按顶层注释分隔符分割成代码块
  const blocks = splitScriptIntoBlocks(allJs);

  // 为每个效果收集它的 HTML 中的 ID 和调用的函数名
  for (const eff of cat.effects) {
    eff._assignedJs = [];
    eff._htmlIds = extractIdsFromHtml(eff.stageHtml);
    eff._htmlFuncs = extractFunctionCallsFromHtml(eff.stageHtml);
  }

  // 对每个代码块，找出它属于哪个效果
  for (const block of blocks) {
    const jsIds = extractIdsFromJs(block);
    // 提取该块定义的函数名
    const funcDefs = [];
    const funcRegex = /function\s+([a-zA-Z_]\w*)\s*\(/g;
    let fm;
    while ((fm = funcRegex.exec(block)) !== null) {
      funcDefs.push(fm[1]);
    }

    let assigned = false;
    for (const eff of cat.effects) {
      // 通过 ID 匹配：JS 中 getElementById 的 ID 出现在效果的 HTML 中
      const idMatch = jsIds.some(id => eff._htmlIds.includes(id));
      // 通过函数名匹配：效果 HTML 的 onclick 等调用的函数在这个块中定义
      const funcMatch = funcDefs.some(fn => eff._htmlFuncs.includes(fn));

      if (idMatch || funcMatch) {
        eff._assignedJs.push(block);
        assigned = true;
        // 不 break，可能多个效果共享同一个代码块（如果多个效果都引用了同一 ID）
      }
    }

    // 如果没有效果匹配（可能是工具函数），不分配给任何效果（避免崩溃）
    // 但如果只有一个效果没有任何分配的 JS，可能这个块是它的
    if (!assigned) {
      // 这是一个没有 getElementById 调用的代码块（如工具函数或变量声明）
      // 只分配给需要它的效果（通过看它引用的变量/选择器）
      // 安全策略：不分配，避免崩溃
    }
  }

  // 对于没有分配到任何 JS 的效果，如果该效果确实是纯 CSS 的，就不需要 JS
  // 无需特殊处理
}

for (const cat of sortedParsed) {
  assignScriptsToEffects(cat);
}

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

    // 使用智能分配的 JS（而非整个分类的 scripts）
    const effectScripts = eff._assignedJs && eff._assignedJs.length > 0
      ? eff._assignedJs.map(s => `<script>${s}<\/script>`).join('\n')
      : '';

    // 构建复制给 AI 的数据
    const copyData = {
      name: eff.name,
      tag: eff.tag || '',
      css: effectPageCss.trim(),
      html: eff.stageHtml,
      js: (eff._assignedJs || []).join('\n\n')
    };

    const effectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${eff.name} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh;display:flex;flex-direction:row}
${navCss}
${ctrlCss}
${copyBtnCss}
${favBtnCss}
.effect-main{flex:1;display:flex;align-items:center;justify-content:center;min-height:100vh;padding-top:56px;position:relative;overflow:hidden}
.stage{width:100%;height:calc(100vh - 56px);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
${effectPageCss}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<a href="../_cat/${cat.id}.html" class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>返回</a>
<button class="fav-btn-detail" id="favDetailBtn" data-fav-id="${fileName.replace('.html','')}" data-fav-name="${eff.name.replace(/"/g, '&quot;')}" data-fav-cat="${cat.title.replace(/"/g, '&quot;')}" data-fav-catid="${cat.id}" data-fav-file="_effects/${fileName}">${favHeartSvg}</button>
<button class="copy-ai-btn" id="copyAiBtn"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制给 AI</button>
<div class="effect-main">
<div class="${stageClass.trim()}"${stageAttrs}>${eff.stageHtml}</div>
</div>
<div class="ctrl-sidebar" id="ctrlSidebar">
<div class="ctrl-title">${eff.name}</div>
</div>
${effectScripts}
<` + `script>
window.__EFFECT_CONTROLS__ = ${JSON.stringify(controls)};
window.__COPY_DATA__ = ${JSON.stringify(copyData)};
${ctrlPanelJs}
${navJs}

// 复制给 AI 按钮逻辑
(function(){
  var btn = document.getElementById('copyAiBtn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var d = window.__COPY_DATA__;
    var text = '请帮我实现以下前端动效，生成可直接使用的代码：\\n\\n';
    text += '## 效果名称\\n' + d.name + '\\n\\n';
    if (d.tag) text += '## 技术标签\\n' + d.tag + '\\n\\n';
    text += '## 参考代码\\n\\n';
    if (d.css) text += '### CSS\\n\`\`\`css\\n' + d.css + '\\n\`\`\`\\n\\n';
    if (d.html) text += '### HTML\\n\`\`\`html\\n' + d.html + '\\n\`\`\`\\n\\n';
    if (d.js) text += '### JavaScript\\n\`\`\`javascript\\n' + d.js + '\\n\`\`\`\\n\\n';
    text += '## 要求\\n';
    text += '1. 将颜色、尺寸、动画时长等参数抽取为 CSS 变量或配置对象，方便定制\\n';
    text += '2. 调整 class 命名避免冲突，适配我的项目\\n';
    text += '3. 纯 HTML/CSS/JS 实现，零依赖\\n';
    text += '4. 响应式适配\\n';
    if (d.js) text += '5. 提供 init()/destroy() 方法，方便 SPA 挂载卸载\\n';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ showCopied(btn); }).catch(function(){ fallbackCopy(text, btn); });
    } else { fallbackCopy(text, btn); }
  });
  function showCopied(b) {
    b.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>已复制';
    b.classList.add('copied');
    setTimeout(function(){ b.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制给 AI'; b.classList.remove('copied'); }, 2000);
  }
  function fallbackCopy(text, b) {
    var ta = document.createElement('textarea'); ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopied(b); } catch(e) { alert('复制失败，请手动复制'); }
    document.body.removeChild(ta);
  }
})();
${favDetailJs}
<` + `/script>
</body>
</html>`;
    fs.writeFileSync(path.join(effectsDir, fileName), effectHtml);
    eff._file = `_effects/${fileName}`;
  }
}
// 为 iframe 类型生成独立效果页（带智能控制面板）
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
    const stageId = eff.demoId ? ` id="${eff.demoId}"` : (eff.id ? ` id="${eff.id}"` : '');

    // 提取该效果的控制项（传入完整 CSS = 全局 + 本地）
    const iframeControls = extractIframeControls(eff.scripts, allCss, eff.demoHtml);

    // 对效果脚本做代码变换：将被控制的 jsVar 变量改为每次读取时动态获取全局覆盖值
    const jsVarControls = iframeControls.filter(c => c.action === 'jsVar');
    const patchedScripts = eff.scripts.map(s => {
      let patched = s;
      for (const ctrl of jsVarControls) {
        const vn = ctrl.varName;
        const val = ctrl.value;
        // 将 const/let/var varName = value 替换为 let varName = (window.__ctrl_xxx ?? defaultValue)
        // 匹配整数和浮点数值
        const declRegex = new RegExp(
          `(const|let|var)(\\s+${vn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*)${String(val).replace('.', '\\.')}\\b`,
          'g'
        );
        patched = patched.replace(declRegex, `let$2(window.__ctrl_${vn} !== undefined ? window.__ctrl_${vn} : ${val})`);
      }

      // 第二步：注入 jsVar 同步机制
      if (jsVarControls.length > 0) {
        // 生成重新读取代码（用于注入到函数体内）
        const rereadLines = jsVarControls.map(ctrl => {
          const vn = ctrl.varName;
          return `${vn} = (window.__ctrl_${vn} !== undefined ? window.__ctrl_${vn} : ${vn});`;
        }).join(' ');
        const rereadComment = `/* __jsVar_sync__ */ try { ${rereadLines} } catch(e) {}`;

        // 策略 A：在 requestAnimationFrame 动画函数体开头注入重新读取（try-catch 避免 TDZ）
        const rafMatches = [...patched.matchAll(/requestAnimationFrame\(\s*(\w+)\s*\)/g)];
        const animFuncNames = [...new Set(rafMatches.map(m => m[1]))];

        for (const fnName of animFuncNames) {
          const funcStartRegex = new RegExp(
            `(function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{)`,
            'g'
          );
          patched = patched.replace(funcStartRegex, `$1\n    ${rereadComment}`);

          const arrowRegex = new RegExp(
            `((?:const|let|var)\\s+${fnName}\\s*=\\s*(?:\\([^)]*\\)|\\w+)\\s*=>\\s*\\{)`,
            'g'
          );
          patched = patched.replace(arrowRegex, `$1\n    ${rereadComment}`);
        }

        // 策略 B：在 resize handler 中注入 sync（用 try-catch 包裹避免 TDZ 错误）
        const rereadSafe = `/* __jsVar_sync__ */ try { ${rereadLines} } catch(e) {}`;
        patched = patched.replace(
          /(function\s+resize\s*\([^)]*\)\s*\{)/g,
          `$1\n    ${rereadSafe}`
        );

        // 策略 B2：如果有 init 函数，注入 __jsVarChanged listener 来调用它（仅在 jsVar 变化时重建）
        const initFuncMatch = patched.match(/function\s+(init\w*)\s*\(\s*\)/);
        if (initFuncMatch) {
          const initFuncName = initFuncMatch[1];
          // 在 resize 调用之后注入 __jsVarChanged 监听器
          const initListenerCode = `\nwindow.addEventListener('__jsVarChanged', function() { ${rereadLines} ${initFuncName}(); });\n`;
          // 插入到 initFunc 调用之后（通常是 `initParticles();` 后面）
          const initCallPattern = new RegExp(`(${initFuncName}\\(\\);)`);
          if (initCallPattern.test(patched)) {
            patched = patched.replace(initCallPattern, `$1${initListenerCode}`);
          }
        }

        // 策略 C：对于没有 rAF 动画循环的效果，注入一个事件监听器
        // 当 __jsVarChanged 事件触发时重新赋值所有变量
        if (animFuncNames.length === 0) {
          const listenerCode = `\nwindow.addEventListener('__jsVarChanged', function() { ${rereadLines} });\n`;
          // 在最后一个 __ctrl_ 声明之后插入
          const lastCtrlIdx = patched.lastIndexOf('window.__ctrl_');
          if (lastCtrlIdx >= 0) {
            const insertPos = patched.indexOf('\n', lastCtrlIdx);
            if (insertPos >= 0) {
              patched = patched.slice(0, insertPos) + listenerCode + patched.slice(insertPos);
            }
          }
        }
      }

      return patched;
    });

    // 构建复制给 AI 的数据（iframe 类型）
    const iframeCopyData = {
      name: eff.name,
      tag: '',
      css: allCss.trim(),
      html: eff.demoHtml,
      js: eff.scripts.join('\n\n')
    };

    const iframeEffectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${eff.name} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh;display:flex;flex-direction:row}
${navCss}
${ctrlCss}
${copyBtnCss}
${favBtnCss}
.effect-main{flex:1;display:flex;align-items:center;justify-content:center;min-height:100vh;padding-top:56px;position:relative;overflow:hidden}
.stage{width:100%;height:calc(100vh - 56px);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;${bgStyle}}
.stage canvas{position:absolute;inset:0;width:100%;height:100%}
${allCss}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<a href="../_cat/${cat.id}.html" class="back-btn"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>返回</a>
<button class="fav-btn-detail" id="favDetailBtn" data-fav-id="${fileName.replace('.html','')}" data-fav-name="${eff.name.replace(/"/g, '&quot;')}" data-fav-cat="${cat.title.replace(/"/g, '&quot;')}" data-fav-catid="${cat.id}" data-fav-file="_effects/${fileName}">${favHeartSvg}</button>
<button class="copy-ai-btn" id="copyAiBtn"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制给 AI</button>
<div class="effect-main">
<div class="stage"${stageId}>${eff.demoHtml}</div>
</div>
${eff._needsSharedHtml && cat.sharedHtmlElements ? cat.sharedHtmlElements : ''}
<div class="ctrl-sidebar" id="ctrlSidebar">
<div class="ctrl-title">${eff.name}</div>
</div>
<` + `script>${timeScalePreludeJs}<` + `/script>
${patchedScripts.map(s => `<` + `script>${s}<` + `/script>`).join('\n')}
<` + `script>
window.__EFFECT_CONTROLS__ = ${JSON.stringify(iframeControls)};
window.__COPY_DATA__ = ${JSON.stringify(iframeCopyData)};
${iframeCtrlPanelJs}
${navJs}

// 复制给 AI 按钮逻辑
(function(){
  var btn = document.getElementById('copyAiBtn');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var d = window.__COPY_DATA__;
    var text = '请帮我实现以下前端动效，生成可直接使用的代码：\\n\\n';
    text += '## 效果名称\\n' + d.name + '\\n\\n';
    if (d.tag) text += '## 技术标签\\n' + d.tag + '\\n\\n';
    text += '## 参考代码\\n\\n';
    if (d.css) text += '### CSS\\n\`\`\`css\\n' + d.css + '\\n\`\`\`\\n\\n';
    if (d.html) text += '### HTML\\n\`\`\`html\\n' + d.html + '\\n\`\`\`\\n\\n';
    if (d.js) text += '### JavaScript\\n\`\`\`javascript\\n' + d.js + '\\n\`\`\`\\n\\n';
    text += '## 要求\\n';
    text += '1. 将颜色、尺寸、动画时长等参数抽取为 CSS 变量或配置对象，方便定制\\n';
    text += '2. 调整 class 命名避免冲突，适配我的项目\\n';
    text += '3. 纯 HTML/CSS/JS 实现，零依赖\\n';
    text += '4. 响应式适配\\n';
    if (d.js) text += '5. 提供 init()/destroy() 方法，方便 SPA 挂载卸载\\n';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function(){ showCopied(btn); }).catch(function(){ fallbackCopy(text, btn); });
    } else { fallbackCopy(text, btn); }
  });
  function showCopied(b) {
    b.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>已复制';
    b.classList.add('copied');
    setTimeout(function(){ b.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>复制给 AI'; b.classList.remove('copied'); }, 2000);
  }
  function fallbackCopy(text, b) {
    var ta = document.createElement('textarea'); ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopied(b); } catch(e) { alert('复制失败，请手动复制'); }
    document.body.removeChild(ta);
  }
})();
${favDetailJs}
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
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;margin-top:76px;padding:0 24px 40px;max-width:1400px;margin-left:auto;margin-right:auto}
.card{background:#fff;cursor:pointer;transition:transform .25s ease,box-shadow .25s ease;text-decoration:none;display:block;position:relative;border-radius:16px;overflow:hidden}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(0,0,0,.12)}
.card-visual{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#1a1a2e;border-radius:16px 16px 0 0}
.card-visual .stage{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:16px;background:#1a1a2e}
.card-visual .stage,.card-visual .stage *{animation-play-state:paused !important}
.card.is-playing .card-visual .stage,.card.is-playing .card-visual .stage *{animation-play-state:running !important}
.card-info{padding:14px 16px 16px;background:#fff}
.card-info h3{font-size:.85rem;font-weight:600;color:#0d0c22;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-info .tag{display:block;font-size:.7rem;color:#9e9ea7;margin-top:4px}
.card .play-hint{position:absolute;top:12px;left:12px;z-index:10;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;pointer-events:none}
.card .play-hint svg{width:12px;height:12px;fill:#fff;margin-left:1px}
.card:hover .play-hint{opacity:1}
.card.is-playing .play-hint{opacity:0}
.card.is-playing .card-visual{box-shadow:inset 0 0 0 2px rgba(234,76,137,.4)}
.card-thumb .card-visual{background:#f3f3f4}
.card-thumb:hover .card-visual img{transform:scale(1.05);filter:brightness(1.05)}
.card-thumb .play-hint{background:rgba(0,0,0,.6)}
@media(max-width:768px){.card-grid{grid-template-columns:repeat(2,1fr);gap:12px;padding:0 12px 24px;margin-top:68px}}
@media(max-width:480px){.card-grid{grid-template-columns:1fr;gap:16px}}
`;

const lazyAnimJs = `
// Hover-to-play animation system with IntersectionObserver guard
(function(){
  var cards=document.querySelectorAll('.card');
  if(!cards.length)return;
  var visibleCards=new Set();
  var activeCard=null;
  var longPressTimer=null;

  // IntersectionObserver: track which cards are in viewport (performance guard)
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){visibleCards.add(e.target);}
        else{visibleCards.delete(e.target);e.target.classList.remove('is-playing');}
      });
    },{rootMargin:'100px 0px'});
    cards.forEach(function(c){io.observe(c);});
  }else{
    cards.forEach(function(c){visibleCards.add(c);});
  }

  // Desktop: hover to play
  cards.forEach(function(card){
    card.addEventListener('mouseenter',function(){
      if(!visibleCards.has(card))return;
      if(activeCard&&activeCard!==card)activeCard.classList.remove('is-playing');
      card.classList.add('is-playing');
      activeCard=card;
    });
    card.addEventListener('mouseleave',function(){
      card.classList.remove('is-playing');
      if(activeCard===card)activeCard=null;
    });
  });

  // Mobile: long-press to preview (400ms threshold)
  var isTouchActive=false;
  cards.forEach(function(card){
    card.addEventListener('touchstart',function(){
      isTouchActive=true;
      longPressTimer=setTimeout(function(){
        if(!isTouchActive)return;
        if(activeCard&&activeCard!==card)activeCard.classList.remove('is-playing');
        card.classList.add('is-playing');
        activeCard=card;
      },400);
    });
    card.addEventListener('touchend',function(){
      isTouchActive=false;
      clearTimeout(longPressTimer);
      setTimeout(function(){card.classList.remove('is-playing');if(activeCard===card)activeCard=null;},1500);
    });
    card.addEventListener('touchmove',function(){
      isTouchActive=false;
      clearTimeout(longPressTimer);
    });
  });
})();
`;

// ============================================================
// 生成每个 parsed 分类的集合页面（点击卡片跳转到效果详情页）
// ============================================================
const catPagesDir = path.join(dir, '_cat');
if (fs.existsSync(catPagesDir)) fs.rmSync(catPagesDir, { recursive: true });
fs.mkdirSync(catPagesDir);

for (const cat of sortedParsed) {
  let cards = '';
  const catCopyDataArr = [];
  for (let ei = 0; ei < cat.effects.length; ei++) {
    const eff = cat.effects[ei];
    const stageAttrs = eff.stageAttrs ? ` ${eff.stageAttrs}` : '';
    const stageClass = eff.stageClass ? ` ${eff.stageClass}` : '';
    const favId = eff._file.replace('_effects/', '').replace('.html', '');
    cards += `    <a href="../${eff._file}" class="card" data-idx="${ei}">
      <button class="fav-btn" data-fav-id="${favId}" data-fav-name="${eff.name.replace(/"/g, '&quot;')}" data-fav-cat="${cat.title.replace(/"/g, '&quot;')}" data-fav-catid="${cat.id}" data-fav-file="${eff._file}">${favHeartSvg}</button>
      <div class="play-hint"><svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg></div>
      <div class="card-visual"><div class="stage${stageClass}"${stageAttrs}>${eff.stageHtml}</div></div>
      <div class="card-info"><h3>${eff.name}</h3>${eff.tag ? `<span class="tag">${eff.tag}</span>` : ''}</div>
    </a>\n`;
    catCopyDataArr.push({
      name: eff.name,
      tag: eff.tag || '',
      css: cleanCssForEffectPage(cat.css).trim(),
      html: eff.stageHtml,
      js: (eff._assignedJs || []).join('\n\n')
    });
  }

  const catHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${cat.title} - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
${cardGridCss}
${catCopyBtnCss}
${favBtnCss}
${cat.css}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<div class="card-grid">
${cards}</div>
<` + `script>
${navJs}
${lazyAnimJs}
${favCardJs}
${cat.scripts.map(s => s).join('\n')}

// 复制给 AI - 卡片按钮
(function(){
  var copyDataArr = ${JSON.stringify(catCopyDataArr)};
  var ICON_COPY = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  document.querySelectorAll('.card[data-idx]').forEach(function(card) {
    var idx = parseInt(card.getAttribute('data-idx'));
    var btn = document.createElement('button');
    btn.className = 'card-copy-btn';
    btn.innerHTML = ICON_COPY + '复制';
    btn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      var d = copyDataArr[idx];
      if (!d) return;
      var text = '请帮我实现以下前端动效，生成可直接使用的代码：\\n\\n';
      text += '## 效果名称\\n' + d.name + '\\n\\n';
      if (d.tag) text += '## 技术标签\\n' + d.tag + '\\n\\n';
      text += '## 参考代码\\n\\n';
      if (d.css) text += '### CSS\\n\`\`\`css\\n' + d.css + '\\n\`\`\`\\n\\n';
      if (d.html) text += '### HTML\\n\`\`\`html\\n' + d.html + '\\n\`\`\`\\n\\n';
      if (d.js) text += '### JavaScript\\n\`\`\`javascript\\n' + d.js + '\\n\`\`\`\\n\\n';
      text += '## 要求\\n';
      text += '1. 将颜色、尺寸、动画时长等参数抽取为 CSS 变量或配置对象，方便定制\\n';
      text += '2. 调整 class 命名避免冲突，适配我的项目\\n';
      text += '3. 纯 HTML/CSS/JS 实现，零依赖\\n';
      text += '4. 响应式适配\\n';
      if (d.js) text += '5. 提供 init()/destroy() 方法，方便 SPA 挂载卸载\\n';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ showCopied(btn); }).catch(function(){ fallbackCopy(text, btn); });
      } else { fallbackCopy(text, btn); }
    });
    card.appendChild(btn);
  });
  function showCopied(b) {
    b.innerHTML = ICON_CHECK + '已复制';
    b.classList.add('copied');
    setTimeout(function(){ b.innerHTML = ICON_COPY + '复制'; b.classList.remove('copied'); }, 2000);
  }
  function fallbackCopy(text, b) {
    var ta = document.createElement('textarea'); ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopied(b); } catch(e) {}
    document.body.removeChild(ta);
  }
})();
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
      const thumbFile = `${cat.id}_${i}.webp`;
      const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
      const visual = thumbExists
        ? `<img src="../_thumbs/${thumbFile}" alt="${eff.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .3s,filter .3s">`
        : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:.8rem;text-align:center;padding:8px">${eff.name}</div>`;
      const favId = eff._file.replace('_effects/', '').replace('.html', '');
      cards += `    <a href="../${eff._file}" class="card card-thumb">
      <button class="fav-btn" data-fav-id="${favId}" data-fav-name="${eff.name.replace(/"/g, '&quot;')}" data-fav-cat="${cat.title.replace(/"/g, '&quot;')}" data-fav-catid="${cat.id}" data-fav-file="${eff._file}">${favHeartSvg}</button>
      <div class="play-hint"><svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg></div>
      <div class="card-visual">${visual}</div>
      <div class="card-info"><h3>${eff.name}</h3></div>
    </a>\n`;
    }
  } else {
    const thumbFile = `${cat.file.replace('.html', '.webp')}`;
    const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));
    const visual = thumbExists
      ? `<img src="../_thumbs/${thumbFile}" alt="${cat.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .3s,filter .3s">`
      : `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:1.5rem;font-weight:700">${cat.title.charAt(0)}</div>`;
    const favId = cat.id;
    cards += `    <a href="../${cat.file}" class="card card-thumb">
      <button class="fav-btn" data-fav-id="${favId}" data-fav-name="${cat.title.replace(/"/g, '&quot;')}" data-fav-cat="${cat.title.replace(/"/g, '&quot;')}" data-fav-catid="${cat.id}" data-fav-file="${cat.file}">${favHeartSvg}</button>
      <div class="play-hint"><svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg></div>
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
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
${cardGridCss}
${favBtnCss}
</style>
</head>
<body>
${generateNavBar(cat.id, '../')}
<div class="card-grid">
${cards}</div>
<` + `script>
${navJs}
${favCardJs}
<` + `/script>
</body>
</html>`;
  fs.writeFileSync(path.join(catPagesDir, `${cat.id}.html`), iframeCatHtml);
}

// collect 分类的集合页面
if (sortedCollect.length > 0) {
  let collectCardsHtml = '';
  const collectCopyDataArr = [];
  for (let ci = 0; ci < sortedCollect.length; ci++) {
    const item = sortedCollect[ci];
    const thumbFile = item.file.replace('.html', '.webp');
    const thumbExists = fs.existsSync(path.join(dir, '_thumbs', thumbFile));

    // 自定义预览 map：key 为文件名，value 为 card-visual 内部 HTML + 可选的 card-visual style
    const customVisuals = {
      '88-terminal-text-decode.html': {
        style: ' style="background:#0a1a08 !important"',
        html: `<div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:10px 12px;font-family:'Courier New',monospace;overflow:hidden">
          <div style="font-size:6px;color:#2a4020;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #2a4020;padding-bottom:3px;margin-bottom:5px">VOLCANIC ERUPTIONS</div>
          <div style="display:flex;gap:6px;font-size:6.5px;color:#7ec86a;text-transform:uppercase;padding:2px 0;border-bottom:1px solid rgba(100,180,80,.1)"><span style="color:#5aaa46;min-width:12px">01</span><span style="flex:1">MOUNT VESPERA</span><span>2157-03-14</span></div>
          <div style="display:flex;gap:6px;font-size:6.5px;color:#7ec86a;text-transform:uppercase;padding:2px 0;border-bottom:1px solid rgba(100,180,80,.1)"><span style="color:#5aaa46;min-width:12px">02</span><span style="flex:1">KRAXION</span><span>2243-11-09</span></div>
          <div style="display:flex;gap:6px;font-size:6.5px;color:#7ec86a;text-transform:uppercase;padding:2px 0;border-bottom:1px solid rgba(100,180,80,.1)"><span style="color:#5aaa46;min-width:12px">03</span><span style="flex:1">HELION PEAK</span><span>2180-05-18</span></div>
          <div style="display:flex;gap:6px;font-size:6.5px;color:#7ec86a;text-transform:uppercase;padding:2px 0;border-bottom:1px solid rgba(100,180,80,.1)"><span style="color:#5aaa46;min-width:12px">04</span><span style="flex:1">PYROSPHERE</span><span>2291-06-15</span></div>
          <div style="display:flex;gap:6px;font-size:6.5px;color:#7ec86a;text-transform:uppercase;padding:2px 0"><span style="color:#5aaa46;min-width:12px">05</span><span style="flex:1">VULCANUS</span><span>2312-08-22</span></div>
        </div>`
      },
      '97-radial-network.html': {
        style: ' style="background:#0d1830 !important"',
        html: `<canvas id="radial-prev" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
<script>(function(){
  var c=document.getElementById('radial-prev');
  if(!c)return;
  function init(){
    var dpr=Math.min(window.devicePixelRatio||1,2);
    var W=c.offsetWidth||180,H=c.offsetHeight||120;
    c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);
    var ctx=c.getContext('2d');ctx.scale(dpr,dpr);
    var rays=[];
    for(var i=0;i<38;i++){
      var tv=i/37,sp=(-95+tv*190)*Math.PI/180,ang=-Math.PI/2+sp;
      var nds=[];var nc=1+Math.floor(Math.abs(Math.sin(i*2.3))*2);
      for(var n=0;n<nc;n++)nds.push({t:.3+(n+1)*.5/(nc+1),ph:Math.random()*6.28,sp:.6+Math.random()*.9,sz:1.2+Math.random()*1.8});
      rays.push({a:ang,len:.45+.55*Math.abs(Math.sin(i*1.37)),ph:Math.random()*6.28,sp:.3+Math.random()*.4,cv:(Math.random()-.5)*.07,w:.35+Math.random()*.6,nodes:nds});
    }
    function draw(ts){
      var t=ts*.001;
      ctx.clearRect(0,0,W,H);
      var bg=ctx.createRadialGradient(W*.5,H,0,W*.5,H*.3,W*.85);
      bg.addColorStop(0,'#1a0e2e');bg.addColorStop(.4,'#0d1830');bg.addColorStop(1,'#060c1a');
      ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
      var gw=ctx.createRadialGradient(W*.5,H,0,W*.5,H*.5,H*.6);
      gw.addColorStop(0,'rgba(255,140,60,.6)');gw.addColorStop(.3,'rgba(160,80,220,.25)');gw.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gw;ctx.fillRect(0,0,W,H);
      var ox=W*.5,oy=H*1.0;
      rays.forEach(function(ray){
        var br=.9+.1*Math.sin(t*ray.sp+ray.ph);
        var ml=Math.sqrt(W*W+H*H)*.62*ray.len*br;
        var ex=ox+Math.cos(ray.a)*ml,ey=oy+Math.sin(ray.a)*ml;
        var mx=(ox+ex)*.5+Math.sin(ray.a+Math.PI/2)*ml*ray.cv;
        var my=(oy+ey)*.5+Math.cos(ray.a+Math.PI/2)*ml*ray.cv;
        var gr=ctx.createLinearGradient(ox,oy,ex,ey);
        gr.addColorStop(0,'rgba(255,200,100,1)');gr.addColorStop(.3,'rgba(180,100,255,.8)');gr.addColorStop(.7,'rgba(80,160,255,.5)');gr.addColorStop(1,'rgba(80,160,255,0)');
        ctx.beginPath();ctx.moveTo(ox,oy);ctx.quadraticCurveTo(mx,my,ex,ey);
        ctx.strokeStyle=gr;ctx.lineWidth=ray.w*.7;ctx.stroke();
        ray.nodes.forEach(function(nd){
          var np=nd.t,bx=(1-np)*(1-np)*ox+2*(1-np)*np*mx+np*np*ex,by=(1-np)*(1-np)*oy+2*(1-np)*np*my+np*np*ey;
          var pulse=.75+.25*Math.sin(t*nd.sp*2+nd.ph),r=nd.sz*pulse;
          ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);
          ctx.fillStyle=nd.t<.45?'rgba(255,200,100,.9)':'rgba(140,200,255,.9)';ctx.fill();
        });
      });
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }
  if(c.offsetWidth>0){init();}else{setTimeout(init,100);}
})();<\/script>`
      }
    };

    let visual, cardVisualStyle = '';
    if (customVisuals[item.file]) {
      cardVisualStyle = customVisuals[item.file].style;
      visual = customVisuals[item.file].html;
    } else if (thumbExists) {
      visual = `<img src="../_thumbs/${thumbFile}" alt="${item.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;transition:transform .3s,filter .3s">`;
    } else {
      visual = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:1.5rem;font-weight:700">${item.title.charAt(0)}</div>`;
    }

    const collectFavId = `collect_${ci}`;
    collectCardsHtml += `    <a href="../${item.file}" class="card card-thumb" data-idx="${ci}">
      <button class="fav-btn" data-fav-id="${collectFavId}" data-fav-name="${item.title.replace(/"/g, '&quot;')}" data-fav-cat="Collect" data-fav-catid="collect" data-fav-file="${item.file}">${favHeartSvg}</button>
      <div class="play-hint"><svg viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg></div>
      <div class="card-visual"${cardVisualStyle}>${visual}</div>
      <div class="card-info"><h3>${item.title}</h3></div>
    </a>\n`;

    // 读取源文件提取 CSS/HTML/JS 用于复制
    try {
      const srcContent = fs.readFileSync(path.join(dir, item.file), 'utf-8');
      const styleMatch = srcContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
      const scriptMatch = srcContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      const bodyMatch = srcContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let cssCode = '';
      if (styleMatch) {
        cssCode = styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '').trim()).join('\n\n');
      }
      let jsCode = '';
      if (scriptMatch) {
        jsCode = scriptMatch.map(s => s.replace(/<\/?script[^>]*>/gi, '').trim()).join('\n\n');
      }
      let htmlCode = '';
      if (bodyMatch) {
        htmlCode = bodyMatch[1]
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .trim();
      }
      collectCopyDataArr.push({ name: item.title, css: cssCode, html: htmlCode, js: jsCode });
    } catch (e) {
      collectCopyDataArr.push({ name: item.title, css: '', html: '', js: '' });
    }
  }

  const collectHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Collect - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
${cardGridCss}
${catCopyBtnCss}
${favBtnCss}
</style>
</head>
<body>
${generateNavBar('collect', '../')}
<div class="card-grid">
${collectCardsHtml}</div>
<` + `script>
${navJs}
${favCardJs}

// 复制给 AI - 卡片按钮
(function(){
  var copyDataArr = ${JSON.stringify(collectCopyDataArr)};
  var ICON_COPY = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_CHECK = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  document.querySelectorAll('.card[data-idx]').forEach(function(card) {
    var idx = parseInt(card.getAttribute('data-idx'));
    var btn = document.createElement('button');
    btn.className = 'card-copy-btn';
    btn.innerHTML = ICON_COPY + '复制';
    btn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      var d = copyDataArr[idx];
      if (!d) return;
      var text = '请帮我实现以下前端动效，生成可直接使用的代码：\\n\\n';
      text += '## 效果名称\\n' + d.name + '\\n\\n';
      text += '## 参考代码\\n\\n';
      if (d.css) text += '### CSS\\n\`\`\`css\\n' + d.css + '\\n\`\`\`\\n\\n';
      if (d.html) text += '### HTML\\n\`\`\`html\\n' + d.html + '\\n\`\`\`\\n\\n';
      if (d.js) text += '### JavaScript\\n\`\`\`javascript\\n' + d.js + '\\n\`\`\`\\n\\n';
      text += '## 要求\\n';
      text += '1. 将颜色、尺寸、动画时长等参数抽取为 CSS 变量或配置对象，方便定制\\n';
      text += '2. 调整 class 命名避免冲突，适配我的项目\\n';
      text += '3. 纯 HTML/CSS/JS 实现，零依赖\\n';
      text += '4. 响应式适配\\n';
      if (d.js) text += '5. 提供 init()/destroy() 方法，方便 SPA 挂载卸载\\n';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ showCopied(btn); }).catch(function(){ fallbackCopy(text, btn); });
      } else { fallbackCopy(text, btn); }
    });
    card.appendChild(btn);
  });
  function showCopied(b) {
    b.innerHTML = ICON_CHECK + '已复制';
    b.classList.add('copied');
    setTimeout(function(){ b.innerHTML = ICON_COPY + '复制'; b.classList.remove('copied'); }, 2000);
  }
  function fallbackCopy(text, b) {
    var ta = document.createElement('textarea'); ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showCopied(b); } catch(e) {}
    document.body.removeChild(ta);
  }
})();
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
  const thumbFile = cat.type === 'collect' ? '46-collect.webp' : `${cat.file?.replace('.html', '.webp')}`;
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
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
${favBtnCss}
.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px;padding:24px;margin-top:56px}
.cat-card{background:#fff;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:transform .2s,box-shadow .2s}
.cat-card:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(0,0,0,.12)}
.cat-visual{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#1a1a2e !important}
.cat-visual img{width:100%;height:100%;object-fit:cover}
.cat-visual .placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.3);font-size:2rem;font-weight:700}
.cat-info{padding:14px 16px 16px;display:flex;align-items:baseline;gap:8px}
.cat-info h3{font-size:.85rem;font-weight:500;color:#0d0c22;letter-spacing:-.01em}
.cat-count{font-size:.65rem;color:#6e6d7a}
@media(max-width:768px){.cat-grid{grid-template-columns:repeat(2,1fr);gap:12px;padding:12px}}
</style>
</head>
<body>
${generateNavBar('', '')}
<div class="cat-grid">
${catCards}</div>
<` + `script>
${navJs}
// Init fav count in nav
(function(){var c=document.querySelector('.fav-count');if(c){try{var n=JSON.parse(localStorage.getItem('bfx_favorites')||'[]').length;c.textContent=n;c.style.display=n?'':'none';}catch(e){}}})();
<` + `/script>
</body>
</html>`;

fs.writeFileSync('index.html', indexHtml);
console.log(`\n📄 index.html: ${(Buffer.byteLength(indexHtml)/1024).toFixed(1)} KB`);

// ============================================================
// 收藏页面 (_fav.html) - 纯客户端渲染
// ============================================================
const favPageHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>我的收藏 - Bの宝库</title>
<style>
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:#f8f7f4;color:#0d0c22;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;min-height:100vh}
a{text-decoration:none;color:inherit}
${navCss}
${favBtnCss}
.fav-header{margin-top:76px;padding:0 24px;max-width:1400px;margin-left:auto;margin-right:auto;display:flex;align-items:center;gap:12px}
.fav-header h1{font-size:1.3rem;font-weight:700;color:#0d0c22}
.fav-header .fav-total{font-size:.8rem;color:#9e9ea7;font-weight:500}
.fav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;padding:24px;max-width:1400px;margin:16px auto 0}
.fav-card{background:#fff;cursor:pointer;transition:transform .25s ease,box-shadow .25s ease;text-decoration:none;display:block;position:relative;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.fav-card:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(0,0,0,.12)}
.fav-card-visual{width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;background:#1a1a2e}
.fav-card-visual .fav-placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:rgba(255,255,255,.4);font-size:2.5rem;font-weight:800}
.fav-card-info{padding:14px 16px 16px}
.fav-card-info h3{font-size:.85rem;font-weight:600;color:#0d0c22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fav-card-info .fav-card-cat{font-size:.7rem;color:#9e9ea7;margin-top:4px}
.fav-remove{position:absolute;top:8px;right:8px;z-index:10;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;opacity:0;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.1)}
.fav-card:hover .fav-remove{opacity:1;pointer-events:auto}
.fav-remove:hover{background:#fee2e2;border-color:#fca5a5}
.fav-remove svg{width:14px;height:14px;stroke:#ef4444;stroke-width:2.5;fill:none}
.fav-empty{text-align:center;padding:80px 24px;color:#9e9ea7}
.fav-empty svg{width:64px;height:64px;stroke:#e0e0e0;stroke-width:1.5;fill:none;margin-bottom:16px}
.fav-empty h2{font-size:1.1rem;color:#6e6d7a;font-weight:600;margin-bottom:8px}
.fav-empty p{font-size:.85rem;color:#9e9ea7}
@media(max-width:768px){.fav-grid{grid-template-columns:repeat(2,1fr);gap:12px;padding:12px}.fav-header{margin-top:68px;padding:0 12px}}
</style>
</head>
<body>
${generateNavBar('', '')}
<div class="fav-header">
  <h1>我的收藏</h1>
  <span class="fav-total" id="favTotal"></span>
</div>
<div class="fav-grid" id="favGrid"></div>
<div class="fav-empty" id="favEmpty" style="display:none">
  <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  <h2>还没有收藏</h2>
  <p>浏览效果时点击心形按钮即可收藏</p>
</div>
<` + `script>
${navJs}
// Favorites page renderer
(function(){
  var FAV_KEY='bfx_favorites';
  function getFavs(){try{return JSON.parse(localStorage.getItem(FAV_KEY))||[];}catch(e){return[];}}
  function setFavs(arr){localStorage.setItem(FAV_KEY,JSON.stringify(arr));}
  function render(){
    var favs=getFavs();
    var grid=document.getElementById('favGrid');
    var empty=document.getElementById('favEmpty');
    var total=document.getElementById('favTotal');
    var countEl=document.querySelector('.fav-count');
    total.textContent=favs.length?favs.length+' 个效果':'';
    if(countEl){countEl.textContent=favs.length;countEl.style.display=favs.length?'':'none';}
    if(!favs.length){grid.innerHTML='';empty.style.display='';return;}
    empty.style.display='none';
    grid.innerHTML=favs.map(function(f,i){
      return '<a href="'+f.file+'" class="fav-card">'
        +'<button class="fav-remove" data-idx="'+i+'"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
        +'<div class="fav-card-visual"><div class="fav-placeholder">'+f.name.charAt(0)+'</div></div>'
        +'<div class="fav-card-info"><h3>'+f.name+'</h3><div class="fav-card-cat">'+f.cat+'</div></div>'
        +'</a>';
    }).join('');
    // Bind remove buttons
    grid.querySelectorAll('.fav-remove').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.preventDefault();e.stopPropagation();
        var idx=parseInt(btn.getAttribute('data-idx'));
        var favs=getFavs();
        favs.splice(idx,1);
        setFavs(favs);
        render();
      });
    });
  }
  render();
})();
<` + `/script>
</body>
</html>`;

fs.writeFileSync('_fav.html', favPageHtml);
console.log(`📄 _fav.html: ${(Buffer.byteLength(favPageHtml)/1024).toFixed(1)} KB`);
