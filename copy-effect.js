/**
 * Copy Effect for AI - 为每个效果添加"复制给 AI"按钮
 * 点击后将该效果的完整 HTML + CSS + JS 代码提取出来，
 * 附带 AI 友好的 prompt 前缀，复制到剪贴板。
 *
 * 支持两种页面结构:
 *   A) card-grid 页面: .card 在 .grid 内
 *   B) full-screen section 页面: .section 全屏展示
 */
;(function () {
  'use strict'

  /* ── 样式注入 ─────────────────────────────────── */
  const INJECTED_STYLE = document.createElement('style')
  INJECTED_STYLE.setAttribute('data-copy-effect', '1')
  INJECTED_STYLE.textContent = `
    .copy-btn{position:absolute;top:10px;right:10px;z-index:50;
      padding:5px 12px;border:none;border-radius:8px;
      background:rgba(255,255,255,.08);color:rgba(255,255,255,.45);
      font-size:.7rem;font-family:inherit;cursor:pointer;
      backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      transition:all .25s;display:flex;align-items:center;gap:5px;
      opacity:0;pointer-events:none;line-height:1}
    .card:hover .copy-btn,
    .section:hover .copy-btn,
    .copy-btn:focus{opacity:1;pointer-events:auto}
    .copy-btn:hover{background:rgba(102,126,234,.35);color:#fff}
    .copy-btn.copied{background:rgba(67,233,123,.25);color:#43e97b;opacity:1;pointer-events:auto}
    .copy-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .card,.section{position:relative}

    /* ── 参数面板 ── */
    .param-bar{display:flex;flex-wrap:wrap;gap:6px;width:100%;padding:0 4px;margin-top:auto;justify-content:center}
    .param-pill{display:inline-flex;align-items:center;gap:4px;
      font-size:.6rem;line-height:1;padding:3px 8px;border-radius:10px;
      background:rgba(255,255,255,.04);color:rgba(255,255,255,.45);
      border:1px solid rgba(255,255,255,.06);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
    .param-pill .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .param-pill .ico{width:10px;height:10px;flex-shrink:0;opacity:.6}
    .param-pill.c-color .dot{background:var(--swatch,#667eea)}
    .param-pill.c-size{color:rgba(56,249,215,.55);border-color:rgba(56,249,215,.1)}
    .param-pill.c-dur{color:rgba(240,147,251,.55);border-color:rgba(240,147,251,.1)}
    .param-pill.c-count{color:rgba(254,225,64,.55);border-color:rgba(254,225,64,.1)}
    .section .param-bar{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:10;
      max-width:90vw;justify-content:center;padding:10px 16px;
      background:rgba(0,0,0,.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:12px}
  `
  document.head.appendChild(INJECTED_STYLE)

  /* ── SVG 图标 ──────────────────────────────────── */
  const ICON_COPY = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const ICON_CHECK = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'

  /* ── 缓存 ──────────────────────────────────────── */
  let _cachedCSS = null
  let _cachedCSSBlocks = null

  /** 获取页面所有用户 <style> 文本（排除本脚本注入的） */
  function getFullCSS () {
    if (_cachedCSS) return _cachedCSS
    const parts = []
    document.querySelectorAll('style').forEach(s => {
      if (s.getAttribute('data-copy-effect')) return
      parts.push(s.textContent)
    })
    _cachedCSS = parts.join('\n')
    return _cachedCSS
  }

  /**
   * 将完整 CSS 拆分为带注释标记的块。
   * 每个块由一个 /* 注释标记开头 (如 /* 1. Bounce Ball *​/ 或 /* === NEUMORPHISM === *​/)
   * 返回 [{comment, css, index}]
   */
  function parseCSSBlocks () {
    if (_cachedCSSBlocks) return _cachedCSSBlocks
    const fullCSS = getFullCSS()
    // 匹配 CSS 注释: /* ... */
    // 将文本按 "以 /* 开头的行" 切分
    const blocks = []
    // 策略：逐行扫描，遇到包含 /* 且像是标题的行就开新块
    const lines = fullCSS.split('\n')
    let currentBlock = { comment: '', css: '', num: 0 }
    const titleRe = /\/\*\s*(?:={2,}\s*)?(\d+)[\.\)]\s*(.*?)\s*(?:={2,}\s*)?\*\//
    const sectionRe = /\/\*\s*={3,}\s*(.*?)\s*={3,}\s*\*\//

    for (const line of lines) {
      const titleMatch = line.match(titleRe)
      const sectionMatch = line.match(sectionRe)
      if (titleMatch) {
        if (currentBlock.css.trim()) blocks.push(currentBlock)
        currentBlock = {
          comment: titleMatch[0],
          num: parseInt(titleMatch[1]),
          name: titleMatch[2].trim(),
          css: line + '\n'
        }
      } else if (sectionMatch) {
        if (currentBlock.css.trim()) blocks.push(currentBlock)
        currentBlock = {
          comment: sectionMatch[0],
          num: 0,
          name: sectionMatch[1].trim(),
          css: line + '\n'
        }
      } else {
        currentBlock.css += line + '\n'
      }
    }
    if (currentBlock.css.trim()) blocks.push(currentBlock)
    _cachedCSSBlocks = blocks
    return blocks
  }

  /**
   * 根据效果序号从已解析的 CSS 块中找到对应的 CSS 代码。
   */
  function extractCSSForIndex (effectIndex) {
    const blocks = parseCSSBlocks()
    const block = blocks.find(b => b.num === effectIndex)
    return block ? block.css.trim() : ''
  }

  /**
   * 根据 HTML 中使用的 class 名，从完整 CSS 中提取相关规则（回退策略）。
   */
  function extractCSSByClasses (el) {
    const fullCSS = getFullCSS()
    // 收集元素及其子元素的所有 class
    const classes = new Set()
    const walk = node => {
      if (node.classList) {
        node.classList.forEach(c => {
          if (c !== 'copy-btn' && c !== 'visible' && c !== 'active' && c !== 'card' && c !== 'section' && c !== 'stage') {
            classes.add(c)
          }
        })
      }
      if (node.children) [...node.children].forEach(walk)
    }
    walk(el)

    if (classes.size === 0) return ''

    // 用正则从 CSS 中提取包含这些 class 的规则
    const rules = []
    for (const cls of classes) {
      // 匹配 .className { ... } 和 .className::before 等
      const re = new RegExp('(^|[\\s,}])(\\.(' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[^{]*\\{[^}]*\\})', 'gm')
      let m
      while ((m = re.exec(fullCSS)) !== null) {
        rules.push(m[2].trim())
      }
      // 也匹配 @keyframes
      const kfRe = new RegExp('@keyframes\\s+\\w*' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*\\s*\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\}', 'gi')
      while ((m = kfRe.exec(fullCSS)) !== null) {
        rules.push(m[0].trim())
      }
    }
    return [...new Set(rules)].join('\n\n')
  }

  /**
   * 从效果容器 DOM 中提取干净的 HTML 片段。
   */
  function extractHTML (el) {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('.copy-btn, .param-bar').forEach(b => b.remove())
    clone.classList.remove('visible', 'active')
    return clone.innerHTML.trim()
  }

  /**
   * 提取与某个效果关联的 JS 代码。
   * 通过元素 id 和 canvas id 在 <script> 标签中搜索。
   */
  function extractJS (el) {
    const ids = [el.id, ...([...el.querySelectorAll('canvas, [id]')].map(n => n.id))].filter(Boolean)
    if (ids.length === 0) return ''

    let result = ''
    document.querySelectorAll('script:not([src])').forEach(script => {
      const text = script.textContent
      if (!text.trim()) return
      for (const id of ids) {
        if (!text.includes(id)) continue
        // 尝试提取包含此 id 的 IIFE 或代码块
        const extracted = extractJSChunk(text, id)
        if (extracted) {
          result += (result ? '\n\n' : '') + extracted
        }
        break
      }
    })
    return result
  }

  /** 从脚本文本中提取包含 targetId 的代码块 */
  function extractJSChunk (text, targetId) {
    const lines = text.split('\n')
    let targetLine = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(targetId)) { targetLine = i; break }
    }
    if (targetLine === -1) return ''

    // 向上找 IIFE 或注释块开头
    let start = targetLine
    for (let j = targetLine; j >= 0; j--) {
      const l = lines[j].trim()
      if (l.startsWith('(function') || l.startsWith('// ') || l.startsWith('/* ')) {
        start = j
        break
      }
    }

    // 向下找 IIFE 结束或下一个注释块
    let end = lines.length - 1
    let depth = 0
    for (let j = start; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++
        if (ch === '}') depth--
      }
      if (j > targetLine && depth <= 0) {
        end = j
        break
      }
      if (j > targetLine + 3 && /^\s*\/\/\s*\d+[\.\)]/.test(lines[j])) {
        end = j - 1
        break
      }
    }
    return lines.slice(start, end + 1).join('\n').trim()
  }

  /** 获取效果名 */
  function getEffectName (el) {
    const h = el.querySelector('h3') || el.querySelector('h2') || el.querySelector('.section-title')
    return h ? h.textContent.trim() : '未命名效果'
  }

  /** 获取效果在同级中的序号 */
  function getEffectIndex (el) {
    const parent = el.parentElement
    if (!parent) return 1
    const cls = el.classList.contains('card') ? '.card' : '.section'
    const siblings = [...parent.querySelectorAll(':scope > ' + cls)]
    const idx = siblings.indexOf(el)
    return idx >= 0 ? idx + 1 : 1
  }

  /** 获取 tag 文本 */
  function getEffectTag (el) {
    const tag = el.querySelector('.tag')
    return tag ? tag.textContent.trim() : ''
  }

  /** 获取页面标题 */
  function getPageInfo () {
    const h1 = document.querySelector('h1')
    return h1 ? h1.textContent.trim() : document.title
  }

  /* ── 从代码中自动检测可定制参数 ────────────── */

  /**
   * 从 CSS + JS 源码中扫描出有意义的可配置值，
   * 按类别分组返回（颜色、尺寸、时间、数量等）。
   */
  function detectParams (css, js) {
    const params = { colors: [], sizes: [], durations: [], counts: [], others: [] }
    const seen = new Set()
    const add = (cat, v) => { if (!seen.has(v)) { seen.add(v); params[cat].push(v) } }

    // ── 颜色 ──
    const colorRe = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi
    const rgbRe = /rgba?\(\s*[\d.,\s%]+\)/gi
    const gradRe = /linear-gradient\([^)]+\)/gi
    const radRe = /radial-gradient\([^)]+\)/gi
    const src = css + '\n' + js
    let m
    // 渐变整体算一个颜色参数
    for (const re of [gradRe, radRe]) {
      while ((m = re.exec(src)) !== null) add('colors', m[0])
    }
    // 单独颜色值（排除渐变内已收录的、排除近黑/近白的通用色）
    while ((m = colorRe.exec(src)) !== null) {
      const v = m[0].toLowerCase()
      if (!/^#(0{3,6}|f{3,6}|fff|000|111|222|eee|ddd|ccc|aaa|888|555|666|999)$/i.test(v)) {
        add('colors', v)
      }
    }
    // rgba/rgb 颜色 → 转为 hex 去重（同 RGB 不同透明度只保留一个）
    while ((m = rgbRe.exec(src)) !== null) {
      const nums = m[0].match(/[\d.]+/g)
      if (!nums || nums.length < 3) continue
      const [r, g, b] = nums.map(n => Math.round(parseFloat(n)))
      // 跳过近黑/近白（阈值宽松些，避免背景色混入）
      if ((r + g + b) < 60 || (r + g + b) > 720) continue
      const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
      add('colors', hex)
    }

    // ── 尺寸（px / rem / % / vh / vw） ──
    // 剥离 @keyframes 块再提取尺寸，避免 keyframe 选择器百分比（0%、25%等）被误提取
    let cssNoKf = css
    {
      const kfRe2 = /@keyframes\s+[\w-]+\s*\{/g
      let km
      while ((km = kfRe2.exec(css)) !== null) {
        let depth = 1; let i = km.index + km[0].length
        for (; i < css.length; i++) {
          if (css[i] === '{') depth++
          else if (css[i] === '}') { depth--; if (depth === 0) { i++; break } }
        }
        // 用空格替换整个 @keyframes 块
        cssNoKf = cssNoKf.replace(css.substring(km.index, i), ' ')
      }
    }
    const sizeRe = /(\d+(?:\.\d+)?|\.\d+)(px|rem|em|vh|vw|%)/g
    while ((m = sizeRe.exec(cssNoKf)) !== null) {
      const val = parseFloat(m[1])
      const unit = m[2]
      // 过滤掉太小（1-3px border 等）和布局通用值
      if (unit === 'px' && val <= 3) continue
      if (unit === '%' && (val === 100 || val === 50 || val === 0)) continue
      // 过滤掉极小的 rem/em（字体等通用值）
      if ((unit === 'rem' || unit === 'em') && val < 1) continue
      add('sizes', m[0])
    }

    // ── 动画时长（s / ms） ──
    const durRe = /\b(\d+(?:\.\d+)?)(m?s)\b/g
    while ((m = durRe.exec(css)) !== null) {
      add('durations', m[0])
    }

    // ── JS 中的数量 / 配置项 ──
    if (js) {
      // 1) 变量声明: const count = 200
      const numVarRe = /(?:const|let|var)\s+(\w*(?:count|num|amount|total|max|min|size|speed|radius|width|height|opacity|density|length)\w*)\s*=\s*(\d+(?:\.\d+)?)/gi
      while ((m = numVarRe.exec(js)) !== null) {
        add('counts', m[1] + ' = ' + m[2])
      }
      // 2) 对象 key: { particles: 200, speed: 2 }
      const cfgRe = /(\w+)\s*[:=]\s*(\d+(?:\.\d+)?)\s*[,;\n]/g
      while ((m = cfgRe.exec(js)) !== null) {
        const k = m[1].toLowerCase()
        if (/count|num|particle|speed|radius|size|width|height|density|amount|max|min|gravity|friction|damping|force|mass|life/i.test(k)) {
          add('counts', m[1] + ' = ' + m[2])
        }
      }
      // 3) 循环上限: i < 120 → 粒子/元素数量
      const loopRe = /\bi\s*<\s*(\d+)\s*;/g
      while ((m = loopRe.exec(js)) !== null) {
        const v = parseInt(m[1])
        if (v >= 10) add('counts', '数量 ≈ ' + v)
      }
      // 4) 阈值/距离: dist < 150, * .8, Math.random() * 2 等模式
      const threshRe = /(?:dist|distance|range|threshold)\s*<\s*(\d+)/gi
      while ((m = threshRe.exec(js)) !== null) {
        add('counts', '交互半径 = ' + m[1])
      }
    }

    // 去重并限制数量，避免 prompt 过长
    params.colors = params.colors.slice(0, 6)
    params.sizes = params.sizes.slice(0, 8)
    params.durations = params.durations.slice(0, 4)
    params.counts = params.counts.slice(0, 6)
    return params
  }

  /** 把检测到的参数格式化为可读的列表文本（用于 prompt） */
  function formatParams (params) {
    const lines = []
    if (params.colors.length) lines.push('颜色: ' + params.colors.join(', '))
    if (params.sizes.length) lines.push('尺寸: ' + params.sizes.join(', '))
    if (params.durations.length) lines.push('动画时长: ' + params.durations.join(', '))
    if (params.counts.length) lines.push('数值参数: ' + params.counts.join(', '))
    return lines.join('\n')
  }

  /**
   * 从颜色字符串中提取第一个可用于 swatch 的 hex/rgb 颜色。
   * 如果是渐变，取其中第一个色值。
   */
  function firstColor (str) {
    const m = str.match(/#[0-9a-f]{3,6}/i) || str.match(/rgba?\([^)]+\)/i)
    return m ? m[0] : '#667eea'
  }

  /** 为一个效果容器生成参数面板 DOM（.param-bar） */
  function buildParamBar (el) {
    const index = getEffectIndex(el)
    const indexCSS = extractCSSForIndex(index)
    const fallbackCSS = indexCSS ? '' : extractCSSByClasses(el)
    const css = indexCSS || fallbackCSS
    const js = extractJS(el)
    const params = detectParams(css, js)

    // 如果 CSS 是回退提取的（没找到编号块），尺寸/时长可能来自全局样式，不可靠
    const hasOwnCSS = !!indexCSS
    // 面板最多显示的 pill 数量（避免卡片太挤）
    const MAX_PILLS = 8

    // 合并颜色：去掉渐变中已有的单色（减少冗余）
    const gradHexes = new Set()
    params.colors.forEach(c => {
      if (c.startsWith('linear-') || c.startsWith('radial-')) {
        const hexes = c.match(/#[0-9a-f]{3,6}/gi) || []
        hexes.forEach(h => gradHexes.add(h.toLowerCase()))
      }
    })
    const dedupedColors = params.colors.filter(c => {
      if (c.startsWith('linear-') || c.startsWith('radial-') || c.startsWith('rgb')) return true
      return !gradHexes.has(c.toLowerCase())
    })

    // 组装 pill 列表：[{type, text, swatch?, title?}]
    const pills = []

    dedupedColors.forEach(c => {
      const isGrad = c.startsWith('linear-') || c.startsWith('radial-')
      pills.push({ type: 'color', text: isGrad ? '渐变' : c, swatch: firstColor(c), title: c })
    })

    if (hasOwnCSS) {
      params.sizes.slice(0, 4).forEach(s => pills.push({ type: 'size', text: s }))
      params.durations.forEach(d => pills.push({ type: 'dur', text: '⏱ ' + d }))
    }

    params.counts.forEach(c => pills.push({ type: 'count', text: c }))

    if (pills.length === 0) return null

    const bar = document.createElement('div')
    bar.className = 'param-bar'

    pills.slice(0, MAX_PILLS).forEach(p => {
      const pill = document.createElement('span')
      pill.className = 'param-pill c-' + p.type
      if (p.swatch) {
        pill.innerHTML = '<span class="dot" style="--swatch:' + p.swatch + '"></span>' + p.text
      } else {
        pill.textContent = p.text
      }
      if (p.title) pill.title = p.title
      bar.appendChild(pill)
    })

    return bar
  }

  /* ── 生成 AI 友好的 Prompt ──────────────────── */
  function buildPrompt (name, tag, css, html, js, pageInfo) {
    const params = detectParams(css, js)
    const paramText = formatParams(params)

    let p = '我想在我的网站中使用以下前端效果。请帮我生成一个 **可配置的组件**，而不是直接硬编码。\n\n'
    p += '## 效果名称\n' + name + '\n\n'
    p += '## 来源\n' + pageInfo + '\n\n'
    if (tag) p += '## 技术要点\n' + tag + '\n\n'

    // 参数提示
    if (paramText) {
      p += '## 当前使用的可变参数（供参考）\n'
      p += paramText + '\n\n'
    }

    p += '## 参考实现代码\n\n'
    if (css) p += '### CSS\n```css\n' + css + '\n```\n\n'
    p += '### HTML\n```html\n' + html + '\n```\n\n'
    if (js) p += '### JavaScript\n```javascript\n' + js + '\n```\n\n'

    p += '## 要求\n'
    p += '1. **生成可配置组件**：将上面代码中的动态值（颜色、尺寸、动画时长、数量等）抽取为配置参数，'
    p += '提供一个清晰的配置对象或 CSS 变量方案，让我可以轻松定制。\n'
    p += '2. **适配我的项目**：调整 class 命名以避免冲突，配色和尺寸要方便对接我的设计系统。\n'
    p += '3. **零依赖**：纯 HTML/CSS/JS 实现，不引入任何框架或库。\n'
    p += '4. **响应式**：确保在不同屏幕尺寸下正常展示。\n'
    if (js) {
      p += '5. **可销毁**：提供 init() / destroy() 方法，方便在 SPA 中挂载和卸载。\n'
    }
    return p
  }

  /* ── 复制到剪贴板（同步 + 异步双保险） ─────── */
  function copyText (text, btn) {
    function onSuccess () {
      btn.innerHTML = ICON_CHECK + ' 已复制'
      btn.classList.add('copied')
      setTimeout(() => {
        btn.innerHTML = ICON_COPY + ' 复制给 AI'
        btn.classList.remove('copied')
      }, 2000)
    }

    // 方法 1: 现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        // 方法 2: fallback execCommand
        fallbackCopy(text, onSuccess)
      })
    } else {
      fallbackCopy(text, onSuccess)
    }
  }

  function fallbackCopy (text, cb) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try {
      document.execCommand('copy')
      cb()
    } catch (_) {
      // 最终回退：弹出文本供用户手动复制
      prompt('自动复制失败，请手动 Ctrl+A / Cmd+A 全选复制：', text.slice(0, 2000))
    }
    document.body.removeChild(ta)
  }

  /* ── 点击处理 ──────────────────────────────────── */
  function handleCopy (el, btn) {
    const name = getEffectName(el)
    const index = getEffectIndex(el)
    const tag = getEffectTag(el)
    const pageInfo = getPageInfo()

    // CSS 提取：先按序号，不行则按 class 名
    let css = extractCSSForIndex(index)
    if (!css) css = extractCSSByClasses(el)

    const html = extractHTML(el)
    const js = extractJS(el)
    const prompt = buildPrompt(name, tag, css, html, js, pageInfo)
    copyText(prompt, btn)
  }

  /* ── 注入按钮 + 参数面板 ─────────────────────── */
  function injectButtons () {
    // A) card-grid 页面
    const cards = document.querySelectorAll('.grid > .card')
    cards.forEach(card => {
      addButton(card, card)
      injectParamBar(card)
    })

    // B) full-screen section 页面（排除非效果区域）
    document.querySelectorAll('body > .section, body > div > .section').forEach(section => {
      if (section.classList.contains('hero') || section.classList.contains('grid-section')) return
      // 已有按钮跳过
      if (section.querySelector('.copy-btn')) return
      addButton(section, section)
      injectParamBar(section)
    })

    // C) 15-morphism 等有 .section > .demo-grid 的特殊结构
    document.querySelectorAll('.section').forEach(sec => {
      if (sec.querySelector('.demo-grid') && !sec.querySelector('.copy-btn')) {
        addButton(sec, sec)
        injectParamBar(sec)
      }
    })
  }

  /** 为容器注入参数面板 */
  function injectParamBar (el) {
    const bar = buildParamBar(el)
    if (bar) el.appendChild(bar)
  }

  function addButton (container, effectEl) {
    const btn = document.createElement('button')
    btn.className = 'copy-btn'
    btn.innerHTML = ICON_COPY + ' 复制给 AI'
    btn.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      handleCopy(effectEl, btn)
    })
    container.appendChild(btn)
  }

  /* ── 启动 ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectButtons)
  } else {
    // 延迟一帧确保其他脚本已执行完毕
    requestAnimationFrame(injectButtons)
  }
})()
