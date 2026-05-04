# 前端效果发现记录

## 2026-05-05 linear.app
- 效果名称：彩色引用卡片 (Colorful Quote Cards)
- 效果描述：大尺寸引用卡片，每张卡片有独特的纯色背景（荧光黄 #e4f222、蓝色 #1c85e8、淡紫 #e8e8f5 等），卡片内含大号引用文字、公司 logo 和作者信息。悬停时有微妙的上移 + 阴影效果，整体排列为水平滚动或三列网格。
- 实现原理：纯 CSS，flex 布局，每张卡片固定尺寸 320×360px，border-radius: 6px，不同背景色通过 CSS 变量控制，hover 用 transform: translateY + box-shadow 实现
- 状态：已实现 → 48-colorful-quote-cards.html
