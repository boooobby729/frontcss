# 前端效果发现记录

## 2026-05-05 tympanus.net/codrops (Playground)
- 效果名称：滚动驱动 3D 轮播 (On-Scroll 3D Carousel)
- 效果描述：一组卡片（图片/内容卡）在滚动时以 3D 透视旋转展示。卡片沿 Y 轴旋转，形成类似翻书或旋转木马的效果。每张卡片有不同的旋转角度和深度，随滚动进度平滑过渡。整体呈现出强烈的空间感和层次感，非常适合作品集或产品展示。
- 实现原理：CSS perspective + rotateY 实现 3D 透视，IntersectionObserver 或 scroll 事件监听滚动进度，根据元素在视口中的位置计算旋转角度（从 -45deg 到 0deg 到 45deg），CSS transition 或 requestAnimationFrame 平滑更新 transform，卡片用 backface-visibility: hidden 避免背面显示，整体容器设置 perspective: 1000px
- 状态：待实现

## 2026-05-05 linear.app
- 效果名称：彩色引用卡片 (Colorful Quote Cards)
- 效果描述：大尺寸引用卡片，每张卡片有独特的纯色背景（荧光黄 #e4f222、蓝色 #1c85e8、淡紫 #e8e8f5 等），卡片内含大号引用文字、公司 logo 和作者信息。悬停时有微妙的上移 + 阴影效果，整体排列为水平滚动或三列网格。
- 实现原理：纯 CSS，flex 布局，每张卡片固定尺寸 320×360px，border-radius: 6px，不同背景色通过 CSS 变量控制，hover 用 transform: translateY + box-shadow 实现
- 状态：已实现 → 48-colorful-quote-cards.html，已集成到首页

## 2026-05-05 raycast.com
- 效果名称：键盘快捷键可视化 (Keyboard Shortcut Visualizer)
- 效果描述：用圆角矩形模拟真实键帽质感，展示 option/command/shift 等修饰键与字母键的组合。键帽有立体感（内阴影+底部边框模拟厚度），支持按下动画（translateY + 阴影收缩），可展示多种快捷键组合场景。
- 实现原理：纯 CSS，box-shadow 模拟键帽立体感（顶部高光 + 底部阴影），:active 伪类实现按下效果，flex 布局排列键位，CSS 变量控制主题色
- 状态：已实现 → 49-keyboard-shortcuts.html，已集成到首页

## 2026-05-05 stripe.com
- 效果名称：粒子光线放射动画 (Particle Ray Burst)
- 效果描述：从画面中心向四周放射出数百条细线/粒子轨迹，形成爆炸式光芒效果。深蓝色背景，白色/蓝色粒子带有发光光晕，粒子沿射线方向运动并逐渐消散，整体呈现宇宙星爆或神经网络激活的视觉感。
- 实现原理：Canvas 2D API，每帧绘制大量粒子（200-500个），每个粒子有随机角度、速度、长度、透明度，用 globalCompositeOperation: 'lighter' 实现叠加发光效果，requestAnimationFrame 驱动动画循环
- 状态：已实现 → 50-particle-ray-burst.html，已集成到首页

## 2026-05-05 codrops (tympanus.net)
- 效果名称：终端字符解密悬停动画 (Terminal Text Scramble Hover)
- 效果描述：等宽字体排列的终端风格数据表格，鼠标悬停某行时，该行每一列的文字逐字符按延迟顺序快速替换成随机乱码符号，然后还原回原字母，同时每个字符上方出现闪烁方块光标，模拟黑客终端解码过程。整体深色背景，带扫描线纹理。
- 实现原理：纯 JS（无依赖）将文字拆分成单字符 span，mouseenter 时用 setTimeout 按 position*delay 依次触发每个字符：快速随机替换乱码 3-4 次后还原原字符，CSS 伪元素 ::after 模拟光标方块，CSS 变量 --opa 控制光标闪烁，repeating-linear-gradient 制造扫描线背景。
- 状态：已实现 → 51-terminal-text-scramble.html，已集成到首页

## 2026-05-05 diabrowser.com
- 效果名称：毛玻璃浮动通知卡片 (Glassmorphism Floating UI Cards)
- 效果描述：在蓝紫色径向渐变背景上，多个半透明毛玻璃 UI 卡片以不同位置漂浮，卡片模拟真实 App 通知（日历提醒、会议通知、消息气泡等）。页面加载时卡片从下方淡入上浮，鼠标移动时卡片有轻微视差跟随效果。背景是超大径向渐变圆形被 clip-path 裁剪成半圆弧，营造出沉浸式空间感。
- 实现原理：CSS backdrop-filter: blur() 实现毛玻璃效果，box-shadow 多层叠加（外阴影+内高光）增加质感，radial-gradient 超大圆形背景 + clip-path 裁剪，JS IntersectionObserver 触发入场动画（translateY + scale + opacity），mousemove 事件驱动视差位移
- 状态：已实现 → 52-glassmorphism-floating-ui-cards.html，已集成到首页

## 2026-05-05 linear.app (features page)
- 效果名称：菱形图标网格光晕追踪 (Diamond Icon Grid Spotlight)
- 效果描述：大量深色圆角方形图标按菱形/偏移网格排列，覆盖整个背景区域。鼠标移动时，以鼠标为中心的圆形区域内图标会逐渐亮起（发光 + 颜色变化），距离越近越亮，形成动态追踪光晕效果。图标本身是各种 SF Symbols 风格的功能图标（搜索、星标、地图、闪电等），整体营造出产品功能丰富的视觉感。
- 实现原理：CSS Grid 偏移布局（奇偶行 margin-left 错位实现菱形排列），JS mousemove 事件计算每个图标与鼠标的距离，用 CSS 变量 --glow 控制每个图标的 box-shadow 发光强度和 opacity，距离阈值内线性插值计算亮度，requestAnimationFrame 平滑更新
- 状态：已实现 → 53-diamond-icon-grid-spotlight.html，已集成到首页

## 2026-05-05 framer.com (Holo Shader feature)
- 效果名称：全息彩虹渐变卡片 (Holographic Rainbow Card)
- 效果描述：模拟真实全息贴纸/卡片的光学效果。卡片表面覆盖一层随鼠标角度变化的彩虹渐变层，当鼠标移动时，彩虹光谱会随视角改变而流动偏移，模拟光线在全息薄膜上的衍射效果。同时卡片有轻微的 3D 倾斜跟随鼠标，增强立体感。静止时卡片有微弱的彩虹光泽，移动时彩虹效果变得鲜艳。
- 实现原理：CSS perspective + rotateX/rotateY 实现 3D 倾斜跟随，CSS conic-gradient 或 linear-gradient 多层叠加模拟彩虹光谱，JS mousemove 计算鼠标相对卡片的角度，用 CSS 变量 --rx --ry --bgx --bgy 控制倾斜角度和渐变偏移，mix-blend-mode: color-dodge 或 screen 叠加彩虹层，CSS filter: brightness/saturate 增强光泽感
- 状态：已实现 → 54-holographic-rainbow-card.html，已集成到首页

## 2026-05-05 vercel.com (homepage hero)
- 效果名称：等高线地形波纹背景 (Contour Terrain Map)
- 效果描述：密集的等高线/波纹线条覆盖整个背景，配合彩色渐变区域（红色热区、绿色冷区、黄色中间区），形成地形图般的视觉效果。鼠标移动时，以鼠标为中心的区域波纹会动态扰动，形成涟漪扩散效果。整体呈现出科技感十足的地形数据可视化风格，中央可放置主体内容。
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
- 状态：待实现
