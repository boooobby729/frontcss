## 前端效果采集记录

## 2026-05-13 tympanus.net/codrops (Context-Aware Animation for Fixed Elements)
- 效果名称：上下文感知固定元素动画 (Context-Aware Animation for Fixed Elements)
- 效果描述：页面中有固定定位的标题/Logo，当滚动内容块与固定元素发生"碰撞"时，固定元素根据当前内容块的主题触发不同的隐藏/变形动画（共7种变体）：① scale 缩小消失 ② blur 模糊消失 ③ slideUp 向上推出 ④ charsScatter 字符逐个散开 ⑤ rotate+xPercent 旋转移出 ⑥ move away 平移消失 ⑦ chars shuffle 字符乱码后复原。内容块离开时固定元素以对应的反向动画恢复原位。整体呈现出内容与固定UI元素之间的"感知"互动感。
- 实现原理：IntersectionObserver 检测固定元素与各内容块的重叠状态，根据内容块索引选择对应动画效果；每种效果定义 onEnter/onLeave 回调，用 CSS transition 或 Web Animations API 驱动；字符散开效果将文本拆分为单个 span，逐字符做 opacity/transform 动画；零依赖纯 JS + CSS，无需 GSAP/ScrollTrigger
- 状态：已实现 → `85-context-aware-animation.html`，已集成到 `index.html`

## 2026-05-13 tympanus.net/codrops (Repeating Image Transition)
- 效果名称：重复图像帧过渡 (Repeating Image Transition)
- 效果描述：点击网格中的图片时，在图片原始位置和目标面板之间生成多个"中间帧"（mover 元素），每帧依次用 clip-path inset 动画出现/消失，形成图像沿路径"飞行"的视觉效果。支持 linear/sine 路径、随机旋转、wobble 抖动等参数。整体呈现出电影胶片/画廊网格的高级质感。
- 实现原理：JS 计算起点（grid item）和终点（panel）的 BoundingRect，在两者之间线性插值生成 N 个 mover div，每个 mover 用 GSAP timeline 依次执行 clip-path: inset(hide→reveal→from) 动画，stepInterval 控制每帧延迟，形成连续的"帧飞行"效果；最终 panel 用 clip-path reveal 展开；纯 CSS clip-path + GSAP，无需 Canvas/WebGL
- 状态：已实现 → 84-repeating-image-transition.html

## 2026-05-13 linear.app (Spirograph)
- 效果名称：Spirograph 万花筒几何图形 (Spirograph Mathematical Curves)
- 效果描述：基于滚圆（hypotrochoid）数学公式生成的螺旋花瓣图案，从简单圆形演化到复杂密集花瓣。包含 4 个变体：① 演化序列（Circle→Loops→Star→Petals→Dense 5阶段展示）② 交互式参数控制（实时调节 R/r/d/花瓣数）③ 12种图案画廊（网格展示不同参数组合）④ 逐笔绘制动画（实时描绘螺旋轨迹，自动切换图案）
- 实现原理：hypotrochoid 公式 x=(R-r)cos(t)+d·cos((R-r)/r·t)，y=(R-r)sin(t)-d·sin((R-r)/r·t)；Canvas 2D 绘制；总角度用 lcm(R-r, r)/r × 2π 计算确保闭合；动画版用 requestAnimationFrame 逐步绘制，每帧批量绘制多段线
- 状态：已实现 → `83-spirograph.html`，已集成到 `index.html`

## 2026-05-13 linear.app (Isometric Wireframe Geometry)
- 效果名称：等距线框几何体 (Isometric Wireframe Geometry)
- 效果描述：以等距视角（isometric projection）展示多种纯线框 3D 几何体——层叠立方体、模块堆叠、层叠面板、旋转正方体。所有几何体用 CSS transform + SVG 线条实现，无需 WebGL。悬停时几何体做旋转/展开动画，页面加载时逐层构建动画（每条边依次从 0 到全长绘制）。4-6 种变体：① 层叠立方体塔（cubic stack）② 分解爆炸视图（exploded view）③ 旋转线框正方体（rotating wireframe）④ 网格平面（grid plane）⑤ 层叠面板（stacked panels）
- 实现原理：等距投影用 CSS `transform: rotateX(54.7deg) rotateZ(45deg)` 实现标准等距视角，立方体三个面用绝对定位 + 不同旋转构建，线框用 SVG `<line>` 或 CSS border 绘制，入场动画用 SVG `stroke-dashoffset` 从全长到 0 模拟描边效果，悬停旋转用 CSS transition 驱动，整体深色背景配细白线，呈现 Linear 风格的精密感
- 状态：已实现 → `82-isometric-wireframe.html`，已集成到 `index.html`

## 2026-05-13 tympanus.net/codrops (Scroll Image Reveal Grid)
- 效果名称：滚动图片网格揭示 (Scroll Image Reveal Grid)
- 效果描述：一组图片以紧凑网格排列，滚动时每张图片依次通过 clip-path 从遮罩状态"揭开"，同时配合 scale + translate 产生景深感。支持 4 种变体：① 从中心展开（clip-path: inset 从四周收缩到 0）② 横向百叶窗（多条竖向条带依次从上往下消失，露出图片）③ 网格碎片揭示（图片被分成 NxM 小格，小格随机延迟 clip-path 消失）④ 文字遮罩揭示（大号粗体文字作为 clip-path mask，图片通过文字形状"透出"）。深色背景，配合滚动进度指示线，整体有强烈的编辑风格质感。
- 实现原理：CSS scroll-driven animations（animation-timeline: scroll() + animation-range），配合 @keyframes 修改 clip-path 值；网格碎片版用 JS 动态生成子元素并设置不同 animation-delay；文字遮罩版用 CSS mix-blend-mode: multiply 或 SVG clipPath 文字路径实现；零依赖纯原生实现
- 状态：已实现 → `81-scroll-image-reveal.html`，已集成到 `index.html`

## 2026-05-12 tympanus.net/codrops (Scroll-based SVG Filter Text)
- 效果名称：滚动驱动 SVG 滤镜文字扭曲 (Scroll-driven SVG Filter Text Distortion)
- 效果描述：大号文字随滚动进度动态变形——通过 SVG feTurbulence + feDisplacementMap 滤镜，文字边缘随滚动从清晰逐渐扭曲成液态/故障/溶解效果。灵感来自 EDITORA 网站（Garden Eight / MisatoDaiq 创作）。支持 4 个变体：① 液态熔化（文字边缘随滚动像熔岩融化，feTurbulence baseFrequency 从 0 增至 0.04）② 故障撕裂（feDisplacementMap scale 增大，文字水平撕裂错位，配合 RGB 色差分离）③ 溶解消散（文字像素随滚动逐渐溶解成噪点，结合 feColorMatrix 降低对比度）④ 冻结重生（滚动到顶时文字清晰，中段完全扭曲，底部重新凝固成不同字词——循环意象）。深色背景，大号白色粗体文字，整体氛围黑暗艺术感。
- 实现原理：SVG defs 中定义 filter（feTurbulence → feDisplacementMap → feComposite），JS 监听 scroll 事件计算 scrollProgress（0→1），用 lerp 插值动态修改 feTurbulence 的 baseFrequency 和 seed 属性、feDisplacementMap 的 scale 属性；CSS filter: url(#filterID) 应用到文字元素；故障版用 CSS ::before/::after 伪元素复制文字做 RGB 色差偏移；不需要 GSAP，纯原生 JS + SVG 实现
- 状态：已实现 → 80-scroll-svg-filter-text.html，已集成到 index.html

## 2026-05-12 gsap.com + codrops (Physics Particle Playground)
- 效果名称：物理弹跳粒子乐园 (Physics Particle Playground)
- 效果描述：受 GSAP Physics2D 插件启发，用纯 JS 模拟真实物理世界的粒子系统。鼠标点击屏幕任意位置，爆炸散射出一批彩色粒子，每个粒子有独立的初速度、重力加速度、空气阻力、弹性系数。粒子碰到边界时真实弹跳（速度乘以弹性系数反向），随时间逐渐减速并透明消散。支持 4 个变体：① 基础重力弹跳（粒子受重力下落，碰底弹起）② 零重力爆炸（粒子向四周均匀扩散，碰壁反弹，像台球）③ 烟花模式（粒子上升后在顶部二次爆炸，拖尾效果）④ 连锁反应（粒子碰撞时触发新的小爆炸，雪崩效应）。深色背景，粒子颜色从亮色渐变到透明，拖尾轨迹增强速度感。
- 实现原理：Canvas 2D API；每个粒子对象有 {x, y, vx, vy, radius, color, alpha, life}；每帧 requestAnimationFrame 更新：vy += gravity，vx *= friction，vy *= friction，x += vx，y += vy；边界检测：x < r 或 x > W-r 时 vx *= -bounce，y > H-r 时 vy *= -bounce；alpha 随 life 递减；粒子 life 归零时从数组移除；拖尾用 ctx.globalAlpha = 0.15 的半透明黑色矩形覆盖实现
- 状态：已实现 → 79-physics-particles.html

## 2026-05-12 gsap.com + css-tricks.com (SVG Shape Morph)
- 效果名称：SVG 形状变形 (SVG Shape Morph)
- 效果描述：多个 SVG 形状之间流畅地相互变形——圆形→星形→心形→水滴→多边形，形状边缘像液体一样平滑过渡。支持 4 个变体：① 基础形状循环变形（圆→方→三角→星→心形，自动循环）② 鼠标悬停触发变形（hover 时形状融化变形）③ 多形状同步变形舞台（多个形状同时以不同节奏变形）④ 文字轮廓变形（"A"→"B"→"C" 字母轮廓之间变形）。深色背景，彩色渐变填充，变形过程中颜色同步渐变。
- 实现原理：纯 JS 插值 SVG path 的 d 属性；将每个形状的路径分解为等数量的控制点坐标数组，用 lerp 线性插值（或 cubic-bezier 缓动）在两组坐标之间过渡；requestAnimationFrame 驱动动画；颜色用 HSL 插值同步渐变；所有形状预先统一为相同数量的路径点（如 64 个点），确保变形平滑
- 状态：已实现 → 78-svg-morph.html

## 2026-05-12 framer.com (Holo Shader)
- 效果名称：全息光折射着色器 (Holo Shader)
- 效果描述：液态全息流动背景，模拟光线在全息表面分裂成彩虹的视觉效果。青色/绿色/紫色/蓝色的丝绸质感液态波纹，颜色不是直接指定而是由数学函数控制，通过 sin/cos 噪声场驱动色相（hue）在全色域循环，配合扭曲变形产生流动感。白色圆角形状漂浮在全息背景上，形成强烈的材质对比。整体呈现出高端产品发布页的震撼视觉效果。包含 4 个变体：① 纯全息背景（可作为 hero 背景）② 全息卡片（白色圆角内容卡片浮于其上）③ 全息文字遮罩（全息效果应用于大字标题）④ 鼠标交互版（鼠标位置影响光晕中心和扭曲强度）
- 实现原理：WebGL fragment shader（或 Canvas 2D 多层 sin 函数模拟）；核心是用 3-4 层 fBm（分形布朗运动）叠加生成流体噪声场，将噪声值映射到 HSL 色相（hue = noise * 360 + time * 30），saturation 保持 90-100%，lightness 55-75%；time uniform 随 requestAnimationFrame 递增驱动流动；鼠标位置作为额外扰动中心叠加进噪声场；白色遮罩元素用 mix-blend-mode: overlay 或 screen 与下层全息混合
- 状态：已实现 → 77-holo-shader.html，已集成到 collect.html

## 2026-05-12 linear.app (Scroll Step Navigator)
- 效果名称：滚动步骤导航 (Scroll Step Navigator)
- 效果描述：页面左侧固定一列章节编号（1.0 Intake / 2.0 Plan / 3.0 Build / 4.0 Diffs / 5.0 Monitor），右侧是对应的内容区块。随着用户向下滚动，左侧当前激活的编号高亮（白色 + 发光），其余编号变暗；右侧内容区块平滑淡入/上移进入视野。编号之间有细线连接，激活时连接线从上到下动画填充（像进度条）。每个内容区块有标题、描述文字和一个模拟产品截图（用 CSS 绘制的 UI 卡片）。整体风格极简黑色，字体大、间距宽，有强烈的高端产品感。
- 实现原理：IntersectionObserver 监听各内容区块的可见性，触发时更新左侧导航的激活状态；CSS custom property + transition 驱动连接线高度动画；内容区块用 opacity + translateY 实现淡入上移；左侧导航用 position: sticky 固定在视口中央；模拟 UI 截图用纯 CSS 绘制（圆角卡片 + 色块 + 文字）
- 状态：已实现 → 76-scroll-step-nav.html

## 2026-05-12 stripe.com (Squeezy Carousel)
- 效果名称：挤压轮播 (Squeezy Carousel)
- 效果描述：多张内容卡片横向排列，主卡片全宽展示，右侧的卡片依次被「挤压」成越来越窄的竖条切片（像被从右侧压扁），最右侧只剩一条细线。点击右侧任意切片后，当前主卡片从全宽动画压缩成切片，目标卡片从切片动画展开成全宽，同时底部文字/按钮对应切换（translateX 滑入）。整体呈现出强烈的透视压缩感和空间层次感，深色和彩色卡片背景（渐变/图片）交替出现。
- 实现原理：Canvas 2D API 绘制整个轮播区域；每张卡片有目标宽度比例（主卡片~65%，其余共享剩余35%等比分配），动画时用 lerp 插值从当前宽度过渡到目标宽度；drawImage 配合 clipRect 将每张卡片的图片/渐变内容裁切到对应宽度区间内绘制；文字内容区用独立 div + CSS translateX 动画覆盖在 canvas 上方；鼠标 hover 时高亮对应切片，click 触发激活动画；requestAnimationFrame 驱动宽度插值动画
- 状态：已实现 → 75-squeezy-carousel.html

## 2026-05-12 tympanus.net/codrops + stripe.com (Fluid Text Morph)
- 效果名称：液态文字变形 (Fluid Text Morph)
- 效果描述：多个单词/短语之间用 SVG feTurbulence + feBlend 滤镜实现液态融合变形过渡。文字像液体一样在不同词语之间流动变形——两个文字同时存在时，通过高斯模糊 + 对比度滤镜（gooey effect）让文字边缘产生液态粘连感，然后一个词"融化"消失，另一个词从液态中"凝固"出现。支持多个变体：① 单行标题词语循环变形（如 Design → Build → Ship → Launch）② 多行段落中关键词高亮变形 ③ 鼠标悬停触发单词液化 ④ 彩色液态变形（不同词用不同颜色）。深色背景，大号白色/彩色文字，视觉冲击力极强。
- 实现原理：SVG filter 中 feGaussianBlur（stdDeviation=8）+ feColorMatrix（contrast 矩阵，将模糊边缘锐化为液态边界）组合实现 gooey effect；两个文字层叠加，用 CSS opacity + transform scale 控制出场/入场，过渡期间两层同时可见，gooey filter 让边缘产生液态粘连；JS 定时器循环切换词语，transition 驱动 opacity/scale 变化；彩色版用 feFlood + feComposite 给液态区域染色
- 状态：已实现 → 74-fluid-text-morph.html，已集成到 collect.html

## 2026-05-12 tympanus.net/codrops (On-Scroll 3D Carousel)
- 效果名称：滚动驱动 3D 圆柱轮播 (On-Scroll 3D Carousel)
- 效果描述：多张图片卡片以圆柱形排列在 3D 空间中（rotateY + translateZ），随页面滚动整个圆柱从 rotationY:0 旋转到 rotationY:-180，中间卡片正面朝向观众，两侧卡片向后折叠，形成极具透视感的 3D 轮播效果。同时伴随 rotationX/Z 的微妙倾斜（±3°）和卡片亮度从 250% 降至 80% 的光影变化，营造出真实的 3D 空间感。支持多个变体：① 时尚摄影风格（暖色调背景）② 深色科技风格 ③ 自动播放版（无需滚动）④ 鼠标拖拽旋转版
- 实现原理：N 个卡片用 CSS transform: rotateY(i*360/N deg) translateZ(radius px) 均匀排列成圆柱；父元素 .carousel 用 CSS perspective 开启 3D 透视；JS 监听 scroll 事件计算滚动进度（0→1），用 lerp 插值驱动 carousel 的 rotateY 从 0 到 -180deg；同时插值 rotateX/Z（±3°）和每张卡片的 filter:brightness；requestAnimationFrame 保证流畅；无需 GSAP，纯原生 JS 实现
- 状态：已实现 → 73-scroll-3d-carousel.html，已集成到 collect.html

## 2026-05-07 tympanus.net/codrops (Clip Menu)
- 效果名称：Clip-Path 菜单展开动效 (Clip-Path Reveal Menu)
- 效果描述：导航菜单中每个菜单项悬停时，用 clip-path 从不同方向（左→右、上→下、圆形扩散等）展开一个背景色块或图片预览，鼠标离开时以反向缓动（先快后慢）收起，产生极具弹性和趣味感的交互体验。支持多种变体：① 横向 clip 展开背景色 ② 纵向 clip 展开图片预览 ③ 圆形 clip 扩散 ④ 对角线 clip 切割
- 实现原理：CSS clip-path polygon/circle 属性动画，JS mousemove 检测鼠标进入方向（上/下/左/右），根据方向设置 clip-path 起始状态，CSS transition 或 GSAP 驱动展开动画，离开时用 easeReverse（先快后慢）收起，配合 transform 轻微位移增强立体感
- 状态：已实现 → 71-clip-reveal-menu.html，已集成到 collect.html

## 2026-05-07 gsap.com (Hero Letter Animation)
- 效果名称：字母多态入场 Hero 动画 (Multi-Style Letter Entrance Hero)
- 效果描述：大号标题文字"Animate Anything"中每个字母以完全不同的方式入场：A 从下方 clip 滑入、n 做 rotateY 翻转、i 从上方滑入、m 从左侧滑入、a 从下方滑入、t 从下方滑入后切换为数字"100"再切回、e 从下方滑入；第二行"anything"中字母同样各有独特入场方式（rotateX 翻转、scale 从零放大、旋转消失等）。字母之间穿插 SVG 装饰图标（风车/四叶草、星星、闪电、蠕虫），这些图标也有独立的入场动画（旋转、scale 放大、路径绘制）。整体形成一种充满活力、每个字母都有个性的 Hero 标题动画，视觉冲击力极强。支持多个变体：① 原版多态入场 ② 纯字母版（无装饰图标）③ 循环播放版 ④ 鼠标悬停触发版
- 实现原理：每个字母包裹在独立 span 中，用 CSS clip（overflow:hidden）+ transform 控制入场方向，不同字母用不同 transform 起始态：translateY(100%) 从下、translateY(-100%) 从上、translateX(-100%) 从左、rotateX(-180deg) 翻转、rotateY(-180deg) 翻转、scale(0,0) 从零放大、rotate(-120deg)+opacity:0 旋转消失；JS 用 setTimeout/requestAnimationFrame 或 GSAP timeline 控制每个字母的入场时序（stagger），transition 或 GSAP tween 驱动 transform 归零；SVG 装饰图标用 stroke-dasharray 路径绘制动画 + scale/rotate 入场
- 状态：已实现 → 70-hero-letter-entrance.html，已集成到 collect.html

## 2026-05-07 tympanus.net/codrops (Staggered 3D Grid)
- 效果名称：滚动驱动 3D 透视网格 (Scroll-Driven 3D Perspective Grid)
- 效果描述：页面滚动时，网格中的图片/卡片以错开的（staggered）延迟进行 3D 透视动画：列之间形成圆柱弯曲效果（perspective + rotateX 错位），每列随滚动进度逐步从折叠态展开；同时支持纯文字版的错落动画（每个字母/单词独立触发 3D 翻转）、网格项随滚动缩放/淡入版、以及鼠标悬停时局部倾斜的倾斜卡片版。整体呈现一种机械感十足的空间错落美学。
- 实现原理：JS 用 IntersectionObserver 或 scroll 事件计算每个网格项相对视口的位置，根据列号和行号计算 rotateX/rotateY 偏移量（perspective 在父元素上），stagger 通过 CSS --delay 变量 + transition-delay 实现，每列的透视值不同制造圆柱弯曲感；文字版用 CSS transform perspective + rotateX 从 90deg（折叠）到 0deg（展开），opacity 同步变化
- 状态：已实现 → 69-scroll-3d-grid.html，已集成到 collect.html

## 2026-05-07 tympanus.net/codrops (RepeatingImageTransition)
- 效果名称：图片帧重复过渡 (Repeating Image Frame Transition)
- 效果描述：点击网格中的图片卡片时，触发一种独特的"帧动画"过渡效果：系统在起点（网格项）和终点（展开面板）之间生成多个中间帧（mover 元素），这些帧沿路径依次飞过，每个帧都有 clip-path 入场/出场动画，形成连续的帧重复视觉效果，最终图片"落入"展开的详情面板。支持多种 clip-path 方向（上下/左右）、路径运动（线性/正弦波）、旋转抖动等变体。
- 实现原理：JS 计算起点和终点的 getBoundingClientRect()，在两点之间线性插值生成 N 个中间位置（steps=6），每个位置创建一个 div.mover 元素，设置相同的背景图片和对应的 fixed 定位，用 CSS clip-path inset() 做入场（从隐藏到全显）和出场（从全显到隐藏）动画，每个 mover 有 stepInterval 的延迟错开，形成帧动画效果；同时其他网格项淡出，最终面板用 clip-path 展开
- 状态：已实现 → 68-repeating-image-transition.html，已集成到 collect.html

## 2026-05-07 codrops / awwwards.com (Clip-Path Wipes)
- 效果名称：Clip-Path 过渡擦除 (Clip-Path Transition Wipes)
- 效果描述：用 clip-path 实现多种视觉震撼的内容切换过渡效果。包含 6 种擦除变体：① 对角线擦除（从左上到右下的斜切过渡）② 圆形展开（从中心向外扩散的圆形遮罩）③ 多边形变形（多边形 clip-path 从一种形状变形到另一种）④ 文字遮罩擦除（大号文字轮廓作为 clip-path 遮罩，内容从文字形状中显现）⑤ 百叶窗擦除（多条水平/垂直条带依次展开）⑥ 液态波浪擦除（SVG path 驱动的有机曲线擦除）。点击或滚动触发，配合 CSS transition 或 GSAP 实现流畅过渡。
- 实现原理：CSS clip-path 属性支持 polygon()、circle()、ellipse()、path() 等形状，通过 CSS transition 或 JS 动态修改 clip-path 值实现过渡动画；文字遮罩用 SVG clipPath + text 元素；百叶窗用多个 div 各自独立 clip-path 动画 + stagger 延迟；液态波浪用 SVG path 的 d 属性动画（SMIL 或 JS 插值）
- 状态：已实现 → 67-clip-path-wipes.html，已集成到 collect.html

## 2026-05-06 raycast.com (Feature Wall)
- 效果名称：滚动驱动文字高亮墙 (Scroll-driven Feature Wall)
- 效果描述：一段功能描述文字，每个功能短语是独立的可交互 span，默认呈深灰色（#434345），随滚动进度依次高亮为白色。右侧同步展示对应功能的 UI 预览截图。整体形成"文字墙"效果——大量功能词密集排列，滚动时像扫光一样逐一点亮，视觉冲击力极强。支持鼠标悬停单独高亮。
- 实现原理：每个功能短语包裹在 `<span role="button">` 中，IntersectionObserver 监听每个 span 进入视口中心区域时添加 active 类，active 状态 color 变为 white，transition: color 0.3s 平滑过渡。右侧预览区用 sticky 定位固定，根据当前 active 的 span 索引切换对应的预览内容（opacity/transform 过渡）。扩展变体：① 纯文字高亮墙（无右侧预览）② 带右侧 UI 预览的双栏布局 ③ 彩色高亮版（不同类别用不同颜色）④ 打字机逐词高亮版
- 状态：已实现 → 64-scroll-highlight-text.html，已集成到 collect.html

## 2026-05-06 linear.app (Feature Cards)
- 效果名称：等轴测线框几何体 (Isometric Wireframe Geometry)
- 效果描述：三组精美的等轴测线框图（FIG 0.2/0.3/0.4），分别展示层叠圆盘体、积木方块组合、扇形层叠板。纯 SVG path 绘制，深色背景 #08090A，细线描边（0.5px），亮色轮廓线 #D0D6E0 与暗色内部线 #3E3E44 形成层次感，feGaussianBlur 阴影滤镜增加深度。鼠标悬停时几何体有发光描边动画，整体有缓慢浮动效果。
- 实现原理：SVG path 手工绘制等轴测几何体（菱形顶面 + 平行四边形侧面），stroke 描边控制线条粗细，feDropShadow/feGaussianBlur 滤镜增加发光感，CSS animation 驱动 translateY 浮动，hover 时 filter: drop-shadow 增强发光，多个变体展示不同几何形态
- 状态：已实现 → 63-isometric-wireframe.html，已集成到 collect.html

## 2026-05-06 framer.com (Holo Shader)
- 效果名称：全息液态光泽背景 (Holographic Liquid Shader)
- 效果描述：流动的全息彩虹渐变背景，青色/紫色/绿色/粉色的液态光泽感，像光线在全息膜上折射产生的彩虹效果。颜色随时间缓慢流动变化，鼠标移动时光泽跟随偏移，产生真实的全息材质感。可作为卡片背景、hero 背景、按钮背景等多种用途。
- 实现原理：Canvas 2D + 多层 sin/cos 函数叠加生成流动噪声场，将噪声值映射到 HSL 色相（hue 0-360 循环），叠加产生液态流动感，requestAnimationFrame 驱动 time 动画，鼠标位置影响扭曲中心偏移
- 状态：已实现 → 65-holographic-liquid.html，已集成到 collect.html

## 2026-05-06 vercel.com (Hero Section)
- 效果名称：嵌套三角形光晕背景 (Nested Triangle Glow Hero)
- 效果描述：页面 hero 区域中央有一个由 15 条三角形路径叠加而成的嵌套三角形，底边固定，顶点 Y 坐标逐步上移，opacity 从 1 渐变到 0.07，形成向内收缩的深度感。背景是多色 radial-gradient 光晕（橙/红/绿/蓝），浅色主题，底层有细线网格。整体呈现出科技感十足的几何美学。支持暗色/亮色主题切换，鼠标移动时光晕跟随偏移。
- 实现原理：SVG 绘制 15 条三角形 path（底边固定 485,650→715,650，顶点 Y 从 451 递增到 578），每条 opacity 按等差递减；背景用多个 radial-gradient 叠加（橙/红/绿/蓝各一个光晕），CSS grid 网格线用 background-image: linear-gradient 绘制；mousemove 事件驱动光晕中心偏移，CSS transition 平滑跟随
- 状态：已实现 → 65-nested-triangle-glow.html，已集成到 collect.html

## 2026-04-28 diabrowser.com
- 效果名称：文字粒子爆炸 (Text Particle Explosion)
- 效果描述：点击文字时，文字碎裂成粒子向四周飞散，然后重新聚合
- 实现原理：Canvas 2D API，将文字渲染到离屏 canvas，读取像素点生成粒子数组，用物理模拟驱动粒子运动
- 状态：已实现 → 66-text-particle-explosion.html，已集成到 collect.html

## 2026-05-05 tympanus.net/codrops (Playground)
- 效果名称：等高线地形图 (Contour Terrain Map)
- 效果描述：Canvas 绘制的动态地形等高线图，鼠标移动时地形随之变化，不同高度区间用不同颜色渲染
- 实现原理：Canvas 2D API，用 marching squares 算法或直接绘制等值线，基于 Perlin noise / simplex noise 生成地形高度场，不同高度区间映射不同颜色（热力图配色），mousemove 事件在鼠标位置叠加扰动函数，requestAnimationFrame 驱动动画，等高线用 canvas.stroke() 绘制密集路径
- 状态：已实现 → 55-contour-terrain-map.html，已集成到 collect.html

## 2026-05-05 tympanus.net/codrops (EaseReverseClipMenu)
- 效果名称：Clip-Path 全屏菜单展开 (Clip-Path Fullscreen Menu)
- 效果描述：黑色背景上散落着多张随机旋转的图片，右上角有一个 TOGGLE MENU 按钮。点击后，用 clip-path: polygon() 动画从右上角展开一个全屏菜单覆盖层，菜单背景是渐变/图片，菜单项为大号像素等宽字体。关闭时 clip-path 以弹性回弹动画收缩回角落。整体呈现出游戏 UI 风格的沉浸感。
- 实现原理：nav 元素用 clip-path: polygon() 控制可见区域，关闭态为右上角小矩形（如 polygon(85% 0%, 100% 0%, 100% 15%, 85% 15%)），展开态为全屏（polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)），CSS transition cubic-bezier 控制弹性动画，背景散落图片用 CSS transform rotate + absolute 定位，菜单项用 letter-spacing + 等宽字体
- 状态：已实现 → 56-clip-path-fullscreen-menu.html，已集成到 collect.html

## 2026-05-05 raycast.com (AI page)
- 效果名称：App 图标星系网格 (App Icon Galaxy Grid)
- 效果描述：大量 App 图标（圆角方形，深色背景）以椭圆形星系状排列，中心图标（主角）发出紫红色光晕高亮，周围图标按距离中心的远近逐渐降低亮度和透明度，边缘图标几乎不可见。鼠标移动时，悬停的图标会轻微放大并发光，整体有微弱的浮动动画（各图标以不同频率和幅度上下漂浮）。背景是纯黑色，营造出宇宙星系的空间感。
- 实现原理：绝对定位布局，用 JS 计算椭圆轨道坐标（参数方程 x=cx+a*cos(t), y=cy+b*sin(t)），多层椭圆轨道嵌套，每个图标的 opacity 和 filter:brightness 根据到中心距离线性衰减，CSS animation keyframes 驱动各图标独立浮动（translateY + 随机 delay/duration），mousemove 事件检测悬停图标触发 scale(1.15) + box-shadow 发光，中心图标用 radial-gradient 光晕 + CSS animation 呼吸发光
- 状态：已实现 → 57-app-icon-galaxy.html，已集成到 collect.html

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
