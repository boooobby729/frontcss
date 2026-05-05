## 前端效果采集记录

## 2026-04-28 diabrowser.com
- 效果名称：文字粒子爆炸 (Text Particle Explosion)
- 效果描述：点击文字时，文字碎裂成粒子向四周飞散，然后重新聚合
- 实现原理：Canvas 2D API，将文字渲染到离屏 canvas，读取像素点生成粒子数组，用物理模拟驱动粒子运动
- 状态：待实现

## 2026-05-05 tympanus.net/codrops (Playground)
- 效果名称：等高线地形图 (Contour Terrain Map)
- 效果描述：Canvas 绘制的动态地形等高线图，鼠标移动时地形随之变化，不同高度区间用不同颜色渲染
- 实现原理：Canvas 2D API，用 marching squares 算法或直接绘制等值线，基于 Perlin noise / simplex noise 生成地形高度场，不同高度区间映射不同颜色（热力图配色），mousemove 事件在鼠标位置叠加扰动函数，requestAnimationFrame 驱动动画，等高线用 canvas.stroke() 绘制密集路径
- 状态：已实现 → 55-contour-terrain-map.html，已集成到首页

## 2026-05-05 tympanus.net/codrops (EaseReverseClipMenu)
- 效果名称：Clip-Path 全屏菜单展开 (Clip-Path Fullscreen Menu)
- 效果描述：黑色背景上散落着多张随机旋转的图片，右上角有一个 TOGGLE MENU 按钮。点击后，用 clip-path: polygon() 动画从右上角展开一个全屏菜单覆盖层，菜单背景是渐变/图片，菜单项为大号像素等宽字体。关闭时 clip-path 以弹性回弹动画收缩回角落。整体呈现出游戏 UI 风格的沉浸感。
- 实现原理：nav 元素用 clip-path: polygon() 控制可见区域，关闭态为右上角小矩形（如 polygon(85% 0%, 100% 0%, 100% 15%, 85% 15%)），展开态为全屏（polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)），CSS transition cubic-bezier 控制弹性动画，背景散落图片用 CSS transform rotate + absolute 定位，菜单项用 letter-spacing + 等宽字体
- 状态：已实现 → 56-clip-path-fullscreen-menu.html，已集成到首页

## 2026-05-05 raycast.com (AI page)
- 效果名称：App 图标星系网格 (App Icon Galaxy Grid)
- 效果描述：大量 App 图标（圆角方形，深色背景）以椭圆形星系状排列，中心图标（主角）发出紫红色光晕高亮，周围图标按距离中心的远近逐渐降低亮度和透明度，边缘图标几乎不可见。鼠标移动时，悬停的图标会轻微放大并发光，整体有微弱的浮动动画（各图标以不同频率和幅度上下漂浮）。背景是纯黑色，营造出宇宙星系的空间感。
- 实现原理：绝对定位布局，用 JS 计算椭圆轨道坐标（参数方程 x=cx+a*cos(t), y=cy+b*sin(t)），多层椭圆轨道嵌套，每个图标的 opacity 和 filter:brightness 根据到中心距离线性衰减，CSS animation keyframes 驱动各图标独立浮动（translateY + 随机 delay/duration），mousemove 事件检测悬停图标触发 scale(1.15) + box-shadow 发光，中心图标用 radial-gradient 光晕 + CSS animation 呼吸发光
- 状态：已实现 → 57-app-icon-galaxy.html，已集成到首页

## 2026-05-05 stripe.com / framer.com (Magnetic Interaction)
- 效果名称：磁力吸附按钮 (Magnetic Button)
- 效果描述：鼠标靠近按钮时，按钮被"磁力"吸引，弹性跟随鼠标位置微微偏移（最大 20-30px）；鼠标移出时按钮用弹性动画 (spring) 回弹到原位。按钮内部的文字标签也以更大幅度独立跟随鼠标（视差差分），产生 3D 沉浸感。支持多个磁力按钮组合展示，包括圆形按钮、圆角矩形按钮、发光边框按钮。
- 实现原理：JS mousemove 事件计算鼠标相对按钮中心的偏移量，用距离阈值判断是否激活磁力区，translate(x, y) 驱动按钮位移，CSS transition cubic-bezier 或 spring 物理参数模拟弹性，按钮内文字用稍大倍数的偏移量实现视差，mouseLeave 时归零触发回弹动画
- 状态：已实现 → 59-magnetic-button.html，已集成到首页

## 2026-05-05 vercel.com (Hero Background)
- 效果名称：彩色等高线光晕背景 (Conic Gradient Contour Lines)
- 效果描述：页面 hero 区域有一个震撼的视觉效果：底层是 conic-gradient 彩色光晕（黄/红/蓝/绿渐变，从中心向外辐射），上层叠加密集的 SVG 等高线（大量 line 元素从三角形顶点向两侧延伸，opacity 从 1 逐渐降低），三角形内部用白色 polygon 遮罩，形成镂空等高线效果。鼠标移动时光晕跟随偏移，整体呈现出地形图般的科技感。
- 实现原理：底层 div 用 conic-gradient(from 180deg at 50% 70%, ...) 实现彩色光晕；SVG 层用 JS 动态生成大量 line 元素，从三角形顶点出发，按等差间距向底边延伸，每条线 opacity 按距离衰减；三角形遮罩用 polygon fill 背景色覆盖内部；mousemove 事件驱动 conic-gradient 的中心点偏移，实现光晕跟随效果
- 状态：已实现 → 60-conic-contour.html，已集成到首页

## 2026-05-05 framer.com (Performance Section)
- 效果名称：圆形进度评分卡 (Circular Score Cards)
- 效果描述：多个圆形进度指示器（SVG stroke-dasharray 动画），每个圆环代表一项指标评分（如 SEO 99、Performance 100、Accessibility 98）。页面滚动到可见区域时触发 IntersectionObserver，圆环从 0 动画到目标值，同时中心数字用 requestAnimationFrame 计数递增。悬停卡片时圆环高亮、数字跳动。支持多组评分主题：性能指标、用户评分、数据仪表盘等。
- 实现原理：SVG circle 元素用 stroke-dasharray/stroke-dashoffset 控制圆弧长度，circumference = 2πr，dashoffset 从 circumference（空）到 circumference*(1-score/100)（目标值），CSS transition 或 JS requestAnimationFrame 驱动动画，IntersectionObserver 监听入场触发，数字计数用 easeOutQuart 插值
- 状态：已实现 → 61-circular-score-cards.html，已集成到首页

## 2026-05-05 tympanus.net/codrops (Playground)
- 效果名称：SVG 滤镜文字扭曲 (SVG Filter Text Distortion)
- 效果描述：大号标题文字在鼠标悬停或滚动时，通过 SVG feTurbulence + feDisplacementMap 滤镜产生液态扭曲、故障撕裂、溶解消散等视觉效果。多个变体展示不同滤镜组合：① 液态融化（turbulence 频率渐变）② 故障撕裂（feColorMatrix 通道分离 + 位移）③ 像素溶解（feMorphology + feBlend）④ 霓虹发光扭曲（feGaussianBlur + feComposite）。深色背景，大号白色/彩色文字，鼠标悬停触发动画。
- 实现原理：SVG defs 中定义 filter 元素，feTurbulence 的 baseFrequency 和 seed 属性用 JS 动态修改驱动动画，feDisplacementMap 的 scale 属性控制扭曲强度，CSS filter: url(#filterId) 应用到文字元素，mousemove/scroll 事件驱动参数变化，requestAnimationFrame 平滑插值
- 状态：已实现 → 62-svg-filter-text.html，已集成到首页
