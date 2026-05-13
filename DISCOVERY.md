## 前端效果采集记录

## 2026-05-13 linear.app (Isometric Build Animation)
- Effect: Isometric Build Animation
- Description: SVG isometric geometry with layered build animation. Inspired by Linear FIG 0.2/0.3/0.4. 4 variants: stacked cube tower, block stacking with bounce, staircase expand, explode-reassemble.
- Tech: SVG path for isometric faces, stroke-dashoffset draw animation, CSS scaleY layer reveal, JS staggered timing
- Status: 已实现 → 92-isometric-build.html，已集成到 collect.html


## 2026-05-13 gsap.com (Magnetic Tile Ripple)
- 效果名称：磁性格子涟漪 (Magnetic Tile Ripple)
- 效果描述：由 NxN 网格格子组成的交互区域，鼠标移入时以鼠标为中心向外扩散涟漪——每个格子根据与鼠标的距离产生不同强度的"磁吸"上浮、缩放、发光效果，格子带有蓝/紫渐变色。包含 4 种变体：① 磁性上浮（translateY + scale，距离越近浮起越高）② 颜色涟漪（鼠标为原点，不同半径渲染不同色相，形成彩虹波纹）③ 翻转棋盘（格子 rotateY/X 翻转，背面是对比色，错落时序）④ 粒子爆炸（点击时以鼠标为中心向外爆发）。灵感来自 gsap.com 首页 UI Interactions 蓝色棋盘格演示 + 装饰元素的散射动画。
- 实现原理：JS 用二重循环生成 N×N div 格子，mousemove 事件计算鼠标到每个格子中心的欧氏距离，用 maxDist 归一化得到 0-1 强度值，再映射到 transform: translateY / scale / rotateY，CSS transition 控制平滑衰减；颜色涟漪用 hsl(distance*360/maxDist, 80%, 60%) 动态赋值；requestAnimationFrame 可选做自动波纹（sin波扫描）；点击爆炸用每格子单独的 setTimeout 延迟触发
- 状态：已实现 → `91-magnetic-tile-ripple.html`，已集成到 `_cat/collect.html`

## 2026-05-13 codepen.io / css-tricks.com (Flowing Neon Border)
- 效果名称：流动霓虹边框 (Flowing Neon Border / Animated CSS Border)
- 效果描述：元素边框沿轮廓流动的动态光效，融合了多种流动边框变体：① 行军蚂蚁边框（SVG stroke-dasharray offset 动画，虚线沿路径循环流动）② 渐变光晕流动（conic-gradient 旋转，外圈 glow 效果，模拟彗星掠过）③ 霓虹多彩流动（多段彩色光点依次绕边框运动）④ 跟随鼠标的边框高亮（鼠标靠近边框哪一侧，哪一侧发光）⑤ 全形状适配（矩形/圆形/卡片均可）。深色背景，卡片/按钮为载体，视觉冲击力强。
- 实现原理：① 行军蚂蚁：用 SVG rect/path 的 stroke-dasharray + stroke-dashoffset CSS animation 实现；② 渐变流动：::before/::after 伪元素 + conic-gradient + CSS @keyframes rotate + overflow:hidden + border-radius 裁剪；③ 霓虹彩光：多个绝对定位 span 模拟光点，用 JS/CSS animation 按延迟依次沿四边运动（top→right→bottom→left），配合 box-shadow 发光；④ 鼠标感知：mousemove 事件计算鼠标与边框各边的距离，动态修改 CSS 自定义属性控制各边发光强度
- 状态：已实现 → 90-flowing-neon-border.html，已集成到 index.html（Collect 数量 46→48）

## 2026-05-13 tympanus.net/codrops (SVG Blob Morph)
- 效果名称：SVG 有机形态变形 (SVG Organic Blob Morph)
- 效果描述：受 Codrops 文章「Reverse-Engineering Claude AI's Mascot Animations with SVG and GSAP」启发，实现 SVG 路径的有机形态变形动画。多个不规则 blob 形状在鼠标悬停/点击时流畅变形，配合颜色渐变和缩放，呈现出生命感十足的有机动态效果。包含 4 种变体：① 单色 blob 呼吸动画（自动循环变形）② 多 blob 鼠标追踪（跟随鼠标位置变形）③ 点击触发形态切换（多种预设形状间切换）④ 文字遮罩 blob（blob 形状作为文字的 clip-path 遮罩）
- 实现原理：SVG path 的 d 属性用 cubic bezier 曲线描述有机形状，JS 在多组预设路径数据之间用线性插值或 GSAP morphSVG 实现平滑过渡；呼吸动画用 CSS animation 或 requestAnimationFrame 驱动 scale/path 变化；鼠标追踪用 mousemove 事件计算偏移量驱动 translate；颜色渐变用 SVG linearGradient/radialGradient 动态修改 stop-color
- 状态：已实现 → 89-svg-blob-morph.html，已集成到 index.html

## 2026-05-13 tympanus.net/codrops (On-Scroll Layout Formations)
- 效果名称：滚动布局变形 (On-Scroll Layout Formations)
- 效果描述：页面滚动时，网格/列表布局在多种排列方式之间流畅切换（如从单列变为多列网格、从网格变为全屏轮播等），每种布局有独特的进入/退出动画。
- 实现原理：IntersectionObserver 监听滚动位置，GSAP 驱动元素的 position/size/opacity 过渡，CSS Grid/Flexbox 布局切换
- 状态：已实现 → 86-scroll-layout-formations.html，已集成

## 2026-05-13 tympanus.net/codrops (3D Stack Motion)
- 效果名称：滚动 3D 堆叠运动 (Scroll 3D Stack Motion)
- 效果描述：滚动时卡片以 3D 堆叠方式运动，形成景深感强烈的视差效果。
- 实现原理：CSS perspective + translateZ，滚动驱动 rotateX/Y 和 translateZ 变化
- 状态：已实现 → 87-scroll-3d-stack-motion.html，已集成

## 2026-05-13 tympanus.net/codrops (Repeating Image Transition)
- 效果名称：重复图像帧过渡 (Repeating Image Transition)
- 效果描述：点击网格中的图片时，在图片原始位置和目标面板之间生成多个"中间帧"（mover 元素），每帧依次用 clip-path inset 动画出现/消失，形成图像沿路径"飞行"的视觉效果。支持 linear/sine 路径、随机旋转、wobble 抖动等参数。整体呈现出电影胶片/画廊网格的高级质感。
- 实现原理：JS 计算起点（grid item）和终点（panel）的 BoundingRect，在两者之间线性插值生成 N 个 mover div，每个 mover 用 GSAP timeline 依次执行 clip-path: inset(hide→reveal→from) 动画，stepInterval 控制每帧延迟，形成连续的"帧飞行"效果；最终 panel 用 clip-path reveal 展开；纯 CSS clip-path + GSAP，无需 Canvas/WebGL
- 状态：已实现 → 84-repeating-image-transition.html

## 2026-05-13 linear.app (Spirograph)
- 效果名称：Spirograph 万花筒几何图形 (Spirograph Mathematical Curves)
- 效果描述：基于滚圆（hypotrochoid）数学公式生成的螺旋花瓣图案，从简单圆形演化到复杂密集花瓣。包含 4 个变体：① 演化序列（Circle→Loops→Star→Petals→Dense 5阶段展示）② 交互式参数控制（实时调节 R/r/d/花瓣数）③ 12种图案画廊（网格展示不同参数组合）④ 逐笔绘制动画（实时描绘螺旋轨迹，自动切换图案）
- 实现原理：hypotrochoid 公式 x=(R-r)cos(t)+d·cos((R-r)/r·t)，y=(R-r)sin(t)-d·sin((R-r)/r·t)；Canvas 2D 绘制；总角度用 lcm(R-r, r)/r × 2π 计算确保闭合；动画版用 requestAnimationFrame 逐步绘制，每帧批量绘制多段线
- 状态：已实现 → 83-spirograph.html，已集成

## 2026-05-07 tympanus.net/codrops (RepeatingImageTransition)
- 效果名称：图片帧重复过渡 (Repeating Image Frame Transition)
- 效果描述：点击网格中的图片卡片时，触发一种独特的"帧动画"过渡效果：系统在起点（网格项）和终点（展开面板）之间生成多个中间帧（mover 元素），这些帧沿路径依次飞过，每个帧都有 clip-path 入场/出场动画，形成连续的帧重复视觉效果，最终图片"落入"展开的详情面板。支持多种 clip-path 方向（上下/左右）、路径运动（线性/正弦波）、旋转抖动等变体。
- 实现原理：JS 计算起点和终点的 getBoundingClientRect()，在两点之间线性插值生成 N 个中间位置（steps=6），每个位置创建一个 div.mover 元素，设置相同的背景图片和对应的 fixed 定位，用 CSS clip-path inset() 做入场（从隐藏到全显）和出场（从全显到隐藏）动画，每个 mover 有 stepInterval 的延迟错开，形成帧动画效果；同时其他网格项淡出，最终面板用 clip-path 展开
- 状态：已实现 → 68-repeating-image-transition.html，已集成到 collect.html

## 2026-05-07 codrops / awwwards.com (Clip-Path Wipes)
- 效果名称：Clip-Path 过渡擦除 (Clip-Path Transition Wipes)
- 效果描述：用 clip-path 实现多种视觉震撼的内容切换过渡效果。包含 6 种擦除变体：① 对角线擦除（从左上到右下的斜切过渡）② 圆形展开（从中心向外扩散的圆形遮罩）③ 多边形变形（多边形 clip-path 从一种形状变形到另一种）④ 文字遮罩擦除（大号文字轮廓作为 clip-path 遮罩，内容从文字形状中显现）⑤ 百叶窗擦除（多条水平/垂直条带依次展开）⑥ 液态波浪擦除（SVG path 驱动的有机曲线擦除）。点击或滚动触发，配合 CSS transition 或 GSAP 实现流畅过渡。
- 实现原理：CSS clip-path polygon/circle/inset 属性动画，JS 控制触发时机，SVG clipPath 用于复杂形状，CSS transition cubic-bezier 控制缓动
- 状态：已实现 → 69-clip-path-wipes.html，已集成到 collect.html

## 2026-05-07 tympanus.net/codrops (Clip Menu)
- 效果名称：方向感知 Clip-Path 菜单 (Direction-Aware Clip Menu)
- 效果描述：导航菜单项悬停时，根据鼠标进入方向（上/下/左/右）动态调整 clip-path 动画起始状态，产生方向感知的展开效果。离开时用 easeReverse（先快后慢）收起，与进入方向相反。
- 实现原理：CSS clip-path polygon/circle 属性动画，JS mousemove 检测鼠标进入方向（上/下/左/右），根据方向设置 clip-path 起始状态，CSS transition 或 GSAP 驱动展开动画，离开时用 easeReverse（先快后慢）收起，配合 transform 轻微位移增强立体感
- 状态：已实现

## 2026-05-05 stripe.com / framer.com (Magnetic Interaction)
- 效果名称：磁力吸附按钮 (Magnetic Button)
- 效果描述：鼠标靠近按钮时，按钮被"磁力"吸引，弹性跟随鼠标位置微微偏移（最大 20-30px）；鼠标移出时按钮用弹性动画 (spring) 回弹到原位。按钮内部的文字标签也以更大幅度独立跟随鼠标（视差差分），产生 3D 沉浸感。支持多个磁力按钮组合展示，包括圆形按钮、圆角矩形按钮、发光边框按钮。
- 实现原理：JS mousemove 事件计算鼠标相对按钮中心的偏移量，用距离阈值判断是否激活磁力区，translate(x, y) 驱动按钮位移，CSS transition cubic-bezier 或 spring 物理参数模拟弹性，按钮内文字用稍大倍数的偏移量实现视差，mouseLeave 时归零触发回弹动画
- 状态：已实现 → 59-magnetic-button.html，已集成到 collect.html

## 2026-05-05 vercel.com (Hero Background)
- 效果名称：彩色等高线光晕背景 (Conic Gradient Contour Lines)
- 效果描述：页面 hero 区域有一个震撼的视觉效果：底层是 conic-gradient 彩色光晕（黄/红/蓝/绿渐变，从中心向外辐射），上层叠加密集的 SVG 等高线（大量 line 元素从三角形顶点向两侧延伸，opacity 从 1 逐渐降低），三角形内部用白色 polygon 遮罩，形成镂空等高线效果。鼠标移动时光晕跟随偏移，整体呈现出地形图般的科技感。
- 实现原理：底层 div 用 conic-gradient(from 180deg at 50% 70%, ...) 实现彩色光晕；SVG 层用 JS 动态生成大量 line 元素，从三角形顶点出发，按等差间距向底边延伸，每条线 opacity 按距离衰减；三角形遮罩用 polygon fill 背景色覆盖内部；mousemove 事件驱动 conic-gradient 的中心点偏移，实现光晕跟随效果
- 状态：已实现 → 60-conic-contour.html，已集成到 collect.html

## 2026-05-05 framer.com (Performance Section)
- 效果名称：圆形进度评分卡 (Circular Score Cards)
- 效果描述：多个圆形进度指示器（SVG stroke-dasharray 动画），每个圆环代表一项指标评分（如 SEO 99、Performance 100、Accessibility 98）。页面滚动到可见区域时触发 IntersectionObserver，圆环从 0 动画到目标值，同时中心数字用 requestAnimationFrame 计数递增。悬停卡片时圆环高亮、数字跳动。支持多组评分主题：性能指标、用户评分、数据仪表盘等。
- 实现原理：SVG circle 元素用 stroke-dasharray/stroke-dashoffset 控制圆弧长度，circumference = 2πr，dashoffset 从 circumference（空）到 circumference*(1-score/100)（目标值），CSS transition 或 JS requestAnimationFrame 驱动动画，IntersectionObserver 监听入场触发，数字计数用 easeOutQuart 插值
- 状态：已实现 → 61-circular-score-cards.html，已集成到 collect.html

## 2026-05-05 tympanus.net/codrops (Playground)
- 效果名称：SVG 滤镜文字扭曲 (SVG Filter Text Distortion)
- 效果描述：大号标题文字在鼠标悬停或滚动时，通过 SVG feTurbulence + feDisplacementMap 滤镜产生液态扭曲、故障撕裂、溶解消散等视觉效果。多个变体展示不同滤镜组合：① 液态融化（turbulence 频率渐变）② 故障撕裂（feColorMatrix 通道分离 + 位移）③ 像素溶解（feMorphology + feBlend）④ 霓虹发光扭曲（feGaussianBlur + feComposite）。深色背景，大号白色/彩色文字，鼠标悬停触发动画。
- 实现原理：SVG defs 中定义 filter 元素，feTurbulence 的 baseFrequency 和 seed 属性用 JS 动态修改驱动动画，feDisplacementMap 的 scale 属性控制扭曲强度，CSS filter: url(#filterId) 应用到文字元素，mousemove/scroll 事件驱动参数变化，requestAnimationFrame 平滑插值
- 状态：已实现 → 62-svg-filter-text.html，已集成到 collect.html

## 2026-05-07 awwwards.com / css-tricks.com (Glitch Text)
- 效果名称：故障文字效果 (Glitch Text Effect)
- 效果描述：文字出现随机的数字故障/赛博朋克风格动画效果。包含 4 种变体：① RGB 色差分离（chromatic aberration）—— 文字的红/绿/蓝通道各自随机偏移，产生彩色重影；② 文字切片故障（slice glitch）—— 文字被随机水平切片，每片独立位移，模拟信号干扰；③ 数字雨解码（matrix decode）—— 文字从随机字符逐渐"解码"为真实内容，每个字母独立随机替换；④ 扫描线故障（scanline glitch）—— 文字上叠加动态扫描线 + 随机闪烁，配合 clip-path 切片位移。深色背景，霓虹色文字，鼠标悬停触发 + 自动随机触发。
- 实现原理：① CSS text-shadow 多层叠加（红/绿/蓝各一层），JS 定时随机修改偏移量；② 多个绝对定位文字副本 + CSS clip-path inset() 切割 + translateX 随机位移；③ JS 定时器逐字符替换为随机字符集（ASCII/日文/数字），达到目标字符后停止；④ CSS animation + pseudo-element 扫描线叠加
- 状态：已实现 → `72-glitch-text.html`，集成至 `_cat/collect.html`

## 2026-05-13 tympanus.net/codrops (Terminal Typography Hover)
- 效果名称：终端文字解码悬停 (Terminal Text Decode Hover)
- 效果描述：等宽字体数据表格布局，鼠标悬停整行时，每列文字的每个字符依次被随机字符替换 3 次后恢复原始内容，形成"解码/扫描"视觉效果。包含 4 种变体：① 白底黑字经典终端风格（字符解码 + 光标方块闪烁）② 深蓝暗色主题（字符解码 + 行背景扫描高亮）③ 深绿终端主题（字符解码 + 从南向北背景扫描）④ 噪点纹理背景（大字号 + 毛玻璃背景扫描）。每行包含编号、名称、位置、日期、数值等多列数据，悬停时所有列同步触发动画，错开延迟形成波浪感。
- 实现原理：JS 将每个文字元素的字符拆分为独立 span，悬停时对每个 span 用 setInterval 随机替换 innerHTML 为随机字符集，替换 3 次后恢复原始字符；每个字符有基于位置的延迟（position * 70ms）形成从左到右的波浪；背景扫描效果用 CSS scaleX 动画实现
- 状态：已实现 → `88-terminal-text-decode.html`，集成至 `_cat/collect.html`（自定义预览已写入 `_build.js` customVisuals）
