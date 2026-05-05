# 前端效果发现记录

## 2026-05-05 linear.app
- 效果名称：彩色引用卡片 (Colorful Quote Cards)
- 效果描述：大尺寸引用卡片，每张卡片有独特的纯色背景（荧光黄 #e4f222、蓝色 #1c85e8、淡紫 #e8e8f5 等），卡片内含大号引用文字、公司 logo 和作者信息。悬停时有微妙的上移 + 阴影效果，整体排列为水平滚动或三列网格。
- 实现原理：纯 CSS，flex 布局，每张卡片固定尺寸 320×360px，border-radius: 6px，不同背景色通过 CSS 变量控制，hover 用 transform: translateY + box-shadow 实现
- 状态：已实现 → 48-colorful-quote-cards.html

## 2026-05-05 raycast.com
- 效果名称：键盘快捷键可视化 (Keyboard Shortcut Visualizer)
- 效果描述：用圆角矩形模拟真实键帽质感，展示 option/command/shift 等修饰键与字母键的组合。键帽有立体感（内阴影+底部边框模拟厚度），支持按下动画（translateY + 阴影收缩），可展示多种快捷键组合场景。
- 实现原理：纯 CSS，box-shadow 模拟键帽立体感（顶部高光 + 底部阴影），:active 伪类实现按下效果，flex 布局排列键位，CSS 变量控制主题色
- 状态：已实现 → 49-keyboard-shortcuts.html

## 2026-05-05 stripe.com
- 效果名称：粒子光线放射动画 (Particle Ray Burst)
- 效果描述：从画面中心向四周放射出数百条细线/粒子轨迹，形成爆炸式光芒效果。深蓝色背景，白色/蓝色粒子带有发光光晕，粒子沿射线方向运动并逐渐消散，整体呈现宇宙星爆或神经网络激活的视觉感。
- 实现原理：Canvas 2D API，每帧绘制大量粒子（200-500个），每个粒子有随机角度、速度、长度、透明度，用 globalCompositeOperation: 'lighter' 实现叠加发光效果，requestAnimationFrame 驱动动画循环
- 状态：已实现 → 50-particle-ray-burst.html

## 2026-05-05 codrops (tympanus.net)
- 效果名称：终端字符解密悬停动画 (Terminal Text Scramble Hover)
- 效果描述：等宽字体排列的终端风格数据表格，鼠标悬停某行时，该行每一列的文字逐字符按延迟顺序快速替换成随机乱码符号，然后还原回原字母，同时每个字符上方出现闪烁方块光标，模拟黑客终端解码过程。整体深色背景，带扫描线纹理。
- 实现原理：纯 JS（无依赖）将文字拆分成单字符 span，mouseenter 时用 setTimeout 按 position*delay 依次触发每个字符：快速随机替换乱码 3-4 次后还原原字符，CSS 伪元素 ::after 模拟光标方块，CSS 变量 --opa 控制光标闪烁，repeating-linear-gradient 制造扫描线背景。
- 状态：已实现 → 51-terminal-text-scramble.html

## 2026-05-05 diabrowser.com
- 效果名称：毛玻璃浮动通知卡片 (Glassmorphism Floating UI Cards)
- 效果描述：在蓝紫色径向渐变背景上，多个半透明毛玻璃 UI 卡片以不同位置漂浮，卡片模拟真实 App 通知（日历提醒、会议通知、消息气泡等）。页面加载时卡片从下方淡入上浮，鼠标移动时卡片有轻微视差跟随效果。背景是超大径向渐变圆形被 clip-path 裁剪成半圆弧，营造出沉浸式空间感。
- 实现原理：CSS backdrop-filter: blur() 实现毛玻璃效果，box-shadow 多层叠加（外阴影+内高光）增加质感，radial-gradient 超大圆形背景 + clip-path 裁剪，JS IntersectionObserver 触发入场动画（translateY + scale + opacity），mousemove 事件驱动视差位移
- 状态：已实现 → 52-glassmorphism-floating-ui-cards.html，已集成到首页
