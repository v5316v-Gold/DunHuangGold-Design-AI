# 前端 UI 整体设计美化参数规范

> **主题风格**:新中式奢华科技风(墨黑底 + 辉金点缀)
> **主配置来源**:`src/app/globals.css`(Tailwind v4 `@theme inline` + CSS 变量)
> **配套文档**:`docs/UI-FONTS-2026-08-13.md`(字号应用明细)
> **用途**:后续任何 UI 调整、改版、多端复刻,先查本表,保证全局一致

---

## 一、设计语言总览

| 维度 | 定位 |
|------|------|
| 整体气质 | 深色奢华 + 金色点缀,新中式科技感 |
| 背景基调 | 墨黑 5 级层次(`#08080A` → `#242430`) |
| 主强调色 | 辉金 `#D4AF37`(高光 `#F5D76E` / 深金 `#8B6914`) |
| 文字基调 | 象牙白 `#F8F6F0` 主文 + 4 级灰阶 |
| 功能色 | 翠玉绿 / 朱砂红 / 琥珀黄 / 青花蓝(国风语义) |
| 质感手段 | 渐变光晕、流光边框、玻璃拟态、纹样底纹、金色光标 |
| 动效基调 | 250ms 标准缓动 + 400ms 弹性回弹,克制不浮夸 |

---

## 二、色彩系统

### 2.1 金色系(主色)

| 变量 | 色值 | 用途 |
|------|------|------|
| `--gold` | `#D4AF37` | 主金 · 辉金 |
| `--gold-bright` | `#F5D76E` | 亮金 · 高光 |
| `--gold-hover` | `#E5C158` | 悬停金 |
| `--gold-dark` | `#8B6914` | 深金 · 阴影 |
| `--gold-muted` | `rgba(212, 175, 55, 0.12)` | 淡金背景 |
| `--gold-glow` | `rgba(212, 175, 55, 0.35)` | 金色光晕 |
| `--gold-border` | `rgba(212, 175, 55, 0.25)` | 金色边框 |
| `--gold-gradient` | `linear-gradient(135deg, #D4AF37 0%, #F5D76E 50%, #D4AF37 100%)` | 金色渐变 |

### 2.2 背景色(墨黑层次)

| 变量 | 色值 | 用途 |
|------|------|------|
| `--bg-primary` | `#08080A` | 主背景 · 深墨黑 |
| `--bg-secondary` | `#0E0E12` | 次级背景 |
| `--bg-tertiary` | `#16161C` | 三级背景 |
| `--bg-card` | `#111115` | 卡片背景 |
| `--bg-hover` | `#1C1C24` | 悬停背景 |
| `--bg-active` | `#242430` | 激活背景 |
| `--bg-elevated` | `#1A1A22` | 悬浮背景 |
| `--bg-overlay` | `rgba(8, 8, 10, 0.9)` | 遮罩层 |
| `--bg-glass` | `rgba(17, 17, 21, 0.85)` | 玻璃拟态 |

### 2.3 边框色

| 变量 | 色值 | 用途 |
|------|------|------|
| `--border-color` | `#252530` | 默认边框 |
| `--border-light` | `#35354A` | 亮边框 |
| `--border-gold` | `rgba(212, 175, 55, 0.3)` | 金色边框 |
| `--border-gold-hover` | `rgba(212, 175, 55, 0.5)` | 金色悬停边框 |

### 2.4 文字色(象牙白灰阶)

| 变量 | 色值 | 用途 |
|------|------|------|
| `--text-primary` | `#F8F6F0` | 主文字 · 象牙白 |
| `--text-secondary` | `#B8B4A8` | 次级文字 |
| `--text-muted` | `#6A6860` | 弱化文字 |
| `--text-dim` | `#454540` | 暗淡文字(placeholder) |
| `--text-inverse` | `#0A0A08` | 反色文字(金底黑字) |
| `--text-gold` | `#D4AF37` | 金色文字(强调) |

### 2.5 功能色(国风语义)

| 变量 | 色值 | 名称 | 淡背景 |
|------|------|------|--------|
| `--success` | `#4A9A7A` | 翠玉绿 | `rgba(74, 154, 122, 0.12)` |
| `--error` | `#B85450` | 朱砂红 | `rgba(184, 84, 80, 0.12)` |
| `--warning` | `#C49A3A` | 琥珀黄 | `rgba(196, 154, 58, 0.12)` |
| `--info` | `#5A7AB8` | 青花蓝 | `rgba(90, 122, 184, 0.12)` |

### 2.6 配色速查

```
主色     #D4AF37   辉金
高光     #F5D76E   亮金
背景     #08080A   墨黑
卡片     #111115   深炭
文字     #F8F6F0   象牙白
次级文   #B8B4A8   暖灰
成功     #4A9A7A   翠玉绿
错误     #B85450   朱砂红
警告     #C49A3A   琥珀黄
信息     #5A7AB8   青花蓝
```

---

## 三、字体系统

### 3.1 字体栈

| 用途 | 字体栈 |
|------|--------|
| 主字体(sans) | `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial`(中文优先,纯系统字体零加载) |
| 等宽(mono) | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New'` |

### 3.2 基础渲染

| 参数 | 值 |
|------|-----|
| 默认字号 | 16px(`text-base`) |
| 行高 | `1.6` |
| 字间距 | `0.01em` |
| 抗锯齿 | `-webkit-font-smoothing: antialiased` / `-moz-osx-font-smoothing: grayscale` |

### 3.3 字号阶梯(Tailwind v4)

| class | px | | class | px |
|-------|----|---|-------|----|
| `text-xs` | 12 | | `text-3xl` | 30 |
| `text-sm` | 14 | | `text-4xl` | 36 |
| `text-base` | 16 ←默认 | | `text-5xl` | 48 |
| `text-lg` | 18 | | `text-6xl` | 60 |
| `text-xl` | 20 | | `text-7xl` | 72 |
| `text-2xl` | 24 | | `text-8xl` | 96 |

### 3.4 字重规范

| 字重 | 用途 |
|------|------|
| 400 normal | 默认正文 |
| 500 medium | 菜单项、表格标题 |
| 600 semibold | 主按钮、主标题 |
| 700 bold | 大数字、字段标题 |

### 3.5 标题配色模式

| 类型 | 颜色 |
|------|------|
| 主标题 | `#F8F6F0`(象牙白) |
| 副标题/强调 | `#D4AF37`(辉金) |
| 弱化 | `#6A6860` |
| 错误 | 朱砂红 |

---

## 四、圆角与间距

| 变量 | 值 |
|------|-----|
| `--radius`(基准) | `0.5rem`(8px) |
| `--radius-sm` | `calc(var(--radius) - 4px)` = 4px |
| `--radius-md` | `calc(var(--radius) - 2px)` = 6px |
| `--radius-lg` | `var(--radius)` = 8px |
| `--radius-xl` | `calc(var(--radius) + 4px)` = 12px |
| `--radius-2xl` | 16px / `--radius-3xl` 20px / `--radius-4xl` 24px |

**间距规范**:采用 Tailwind 默认 4px 基准体系(`p-2`=8px, `p-4`=16px, `gap-3`=12px),组件内 padding 常见 `py-2.5 px-4`(参数按钮)。

---

## 五、阴影系统

| 变量 | 值 |
|------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.4)` |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.5)` |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.6)` |
| `--shadow-xl` | `0 16px 48px rgba(0, 0, 0, 0.7)` |
| `--shadow-gold` | `0 4px 20px rgba(212, 175, 55, 0.15)` |
| `--shadow-gold-lg` | `0 8px 32px rgba(212, 175, 55, 0.2)` |
| `--shadow-gold-glow` | `0 0 30px rgba(212, 175, 55, 0.3)` |

**使用原则**:黑阴影用于层叠深度,金阴影只用于强调/选中/主按钮,避免大面积使用。

---

## 六、过渡与动画

### 6.1 过渡时长

| 变量 | 值 |
|------|-----|
| `--transition-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-normal` | `250ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-slow` | `350ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-spring` | `400ms cubic-bezier(0.34, 1.56, 0.64, 1)`(弹性回弹) |

### 6.2 动画类速查

| class | 动画 | 参数 |
|-------|------|------|
| `.animate-fade-in` | 淡入 | 0.3s ease-out forwards |
| `.animate-fade-out` | 淡出 | 0.2s ease-out forwards |
| `.animate-slide-up` | 上滑入 | 0.4s `cubic-bezier(0.16, 1, 0.3, 1)` |
| `.animate-slide-down` | 下滑入 | 0.4s 同上 |
| `.animate-slide-in-left` | 左滑入(24px) | 0.4s 同上 |
| `.animate-slide-in-right` | 右滑入(24px) | 0.4s 同上 |
| `.animate-scale-in` | 缩放入(0.92→1) | 0.3s `cubic-bezier(0.16, 1, 0.3, 1)` |
| `.animate-pulse-glow` | 金色脉冲发光 | 2.5s ease-in-out infinite |
| `.animate-float` | 浮游(±10px) | 3s ease-in-out infinite |
| `.animate-bounce-subtle` | 轻弹跳(±6px) | 0.5s ease-out |
| `.animate-spin` | 旋转 | 1s linear infinite |
| `.animate-shimmer-text` | 流光文字(金色扫光) | 4s ease-in-out infinite |
| `.animate-border-flow` | 流光渐变边框 | 3s ease-in-out infinite |
| `.skeleton` | 骨架屏微光 | 1.5s ease-in-out infinite |

### 6.3 延迟工具

`.delay-100` ~ `.delay-800`(100ms 步进),用于列表交错入场。

### 6.4 动效原则

- 入场 0.3–0.4s,交互动效 150–250ms,强调动效 ≤ 4s 循环
- 循环动效仅用于:脉冲光、流光、浮游、骨架屏,禁止大面积使用
- 全局只给 `button, a, input, select, textarea` 及卡片/边框类加过渡,避免性能问题

---

## 七、组件美化规范

### 7.1 按钮体系

| class | 视觉 | 交互 |
|-------|------|------|
| `.btn-gold` 主按钮 | 135° 金渐变 + 斜向流光扫过(::before 白色 20% 高光) | hover 上浮 2px + 金色光晕放大;active 回落;disabled 半透明 |
| `.btn-gold-outline` 金色描边 | 透明底 + 1px 金边 + 金字 | hover 金色从左向右填充(scaleX),文字反色 |
| `.btn-secondary` 次按钮 | 三级背景 + 1px 默认边框 | hover 背景提亮 + 边框变亮 |
| `.btn-ghost` 幽灵按钮 | 透明 | hover 淡背景 + 金色文字 |
| `.btn-power` 算力角标 | `text-xs text-black/60` | 附于主按钮 |

### 7.2 卡片体系

| class | 用途 | hover |
|-------|------|-------|
| `.card-gold-border` 金色边框卡 | 默认 1px 边框 + 卡片底 | 边框变金 + 金影 + 135° 金色扫光角(opacity 0.3) |
| `.card-elevated` 悬浮卡 | 悬浮背景 + md 阴影 | 上浮 2px + lg 阴影 |
| `.card-glass` 玻璃卡 | 玻璃底(0.85) + `backdrop-filter: blur(16px)` + 金边 | — |
| `.card-glow` 发光卡 | 呼吸金边框动画(glow-border 3s) | 上浮 4px scale 1.02 + 金色大阴影 |

### 7.3 输入框

| class | 状态 |
|-------|------|
| `.input-gold` 默认 | 三级背景 + 1px 边框,placeholder 用暗淡文字 |
| hover | 边框变亮 `#35354A` |
| focus | 金边 + `0 0 0 3px gold-muted` 聚焦环 + 20px 金色柔光 |

### 7.4 Toast / 通知

- 底:悬浮背景 + 1px 边框 + lg 阴影 + `radius-lg` 圆角,右侧滑入(0.3s)
- 左侧 3px 语义色条:`toast-success`(翠绿)/ `toast-error`(朱砂)/ `toast-info`(青花)/ `toast-warning`(琥珀)

### 7.5 徽章 / 标签

- `.badge`:`inline-flex` + `0.25em 0.75em` + `0.75rem` 字号 + 全圆角(`9999px`)
- 变体:`.badge-gold`(淡金底金字金边,悬停发光)/ `.badge-success` / `.badge-error` / `.badge-info` / `.badge-warning`(均为淡色底 + 语义色 0.3 边框)

### 7.6 链接

- `.link-gold-underline`:金色文字,底部下划线从左到右生长(250ms),悬停变亮金

### 7.7 参数选择器(功能区通用)

| class | 状态 |
|-------|------|
| `.param-btn` 基础 | `py-2.5 px-4` + `rounded-lg` + 居中 + `text-sm font-medium` |
| `.param-btn-selected` 选中 | 卡片底 + 金字 + 金边 + `0 0 10px rgba(200,164,92,0.35)` 光晕 |
| `.param-btn-unselected` | 卡片底 + 白字 + 默认边框,悬停金边 |
| `.param-btn:disabled` | 半透明 + not-allowed |
| `input[type=range]` 滑块 | 16px 金色圆点 + 2px 卡片色描边 + 金色光晕,悬停光晕增强 |

### 7.8 滚动条

- 宽度 8px;轨道 = 次级背景(圆角 4px);滑块 = 三级背景(圆角 4px),悬停变边框色
- Firefox:`scrollbar-width: thin` + 同色系
- `.scrollbar-hide`:彻底隐藏滚动条

---

## 八、光晕效果系统(glow-*)

| class | 效果 |
|-------|------|
| `.glow-selected` | 选中态:金边 + 金色垂向渐变底 + 金色光晕 |
| `.glow-hover:hover` | 未选悬停:金边 0.4 + 半透明卡片底 |
| `.glow-btn-hover` | 按钮悬停:15px 金光 + 上浮 1px |
| `.glow-btn-primary` | 主按钮:深金→金→亮金渐变 + 20px 金光,悬停 30px |
| `.glow-shimmer` | 流光层:白色 25% 扫光渐变 |
| `.glow-modal-bar::before` | 弹窗顶部 2px 金色渐变条(居中渐隐,opacity 0.6) |
| `.glow-icon` | 图标:`0 4px 15px` 金光 |
| `.glow-success` / `.glow-error` | 成功/错误状态 15px 语义光晕 |
| `.glow-loading` | 加载中:4px 金色半透明环 + 内外金光 |
| `.glow-input:focus` | 输入聚焦:金边 + 3px 淡金环 + 15px 柔光 |
| `.glow-modal-backdrop` | 模态遮罩:`rgba(8,8,10,0.7)` + `blur(12px)` |
| `.glow-modal-container` | 弹窗容器:次级背景 + 1px 边框 + 25px 黑阴影 + 30px 金光 |
| `.glow-gold` | 通用金色三层光晕(20/40/60px 递减) |
| `.glow-inner` | 内发光(inset 20px 金色 0.1) |

---

## 九、背景与纹样

### 9.1 页面根背景(html 层)

```
① 中心光晕:radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,0.08) → transparent 60%)
② 纹样底纹:120×120 SVG 平铺,金色低透明度
   - 方形网格:stroke #D4AF37 · 0.3 宽 · opacity 0.04
   - 同心圆 r=40/25/12:0.25/0.2/0.15 宽 · opacity 0.03/0.025/0.02
   - 对角线:0.2 宽 · opacity 0.02
   - 四角圆点 r=8:0.15 宽 · opacity 0.015
```

### 9.2 渐变工具类

| class | 效果 |
|-------|------|
| `.bg-gradient-gold` | 135° 淡金→透明 |
| `.bg-gradient-dark` | 180° 主背景→次级背景 |
| `.bg-gradient-hero` | 顶部金色径向光晕(0.12)+ 深色渐变(首屏用) |
| `.bg-grid` | 20px 方格棋盘格(图片预览区) |
| `.bg-dots` | 20px 圆点阵(边框色) |
| `.bg-dots-gold` | 24px 金色点阵(金边色) |

### 9.3 页面专属背景

- `.bg-auth`(登录/注册):顶部 + 右下双金晕 + 主背景
- `.bg-gallery`(作品墙):顶部 120% 宽金晕(0.06)+ 主背景

### 9.4 装饰元素

| class | 效果 |
|-------|------|
| `.border-*` 四角边框 | 24×24 金色 L 形四角(opacity 0.4) |
| `.corner-decoration` | 右上 16×16 金色 L 角(opacity 0.3) |
| `.divider-gold` | 1px 金色渐变分隔线(中亮两端渐隐) |
| `.divider-shimmer` | 1px 流光分隔线(3s 扫光) |
| `.glow-modal-bar` | 弹窗顶部金色渐变条 |

---

## 十、光标系统(可选增强)

| 变量 | 类型 |
|------|------|
| `--cursor-default` | 24px 金色描边指针 |
| `--cursor-pointer` | 24px 金色实心指针(悬停按钮/链接) |
| `--cursor-text` | 20×24 金色 I 形(输入框) |
| `--cursor-grab` | 24px 金色抓手(拖拽) |

> 由 `.enable-gold-cursor` 容器启用,`button/a/[role=button]` 用 pointer、`input/textarea` 用 text。低配设备建议关闭。

---

## 十一、其他全局细节

| 项 | 值 |
|----|-----|
| 文本选中色 | `rgba(212, 175, 55, 0.35)` 金底 + 象牙白文字 |
| 聚焦环 `.focus-ring:focus-visible` | 2px 金边 + offset 2px + 4px 淡金光 |
| 打印样式 | html/body 强制白底黑字,去除纹样 |
| 响应式断点 | ≤640px 隐藏 `.hide-mobile`;641–1024px 隐藏 `.hide-tablet`;≥1025px 隐藏 `.hide-desktop`;`.mobile-full` 移动端 100% 宽 |
| 主题切换 | 仅关键交互元素做过渡,`@custom-variant dark` 已预置 |

---

## 十二、Shadcn 变量映射

| Shadcn 变量 | 映射 | Shadcn 变量 | 映射 |
|-------------|------|-------------|------|
| `--background` | `--bg-primary` | `--sidebar` | `--bg-secondary` |
| `--foreground` | `--text-primary` | `--sidebar-primary` | `--gold` |
| `--card` | `--bg-card` | `--sidebar-foreground` | `--text-primary` |
| `--primary` | `--gold` | `--sidebar-accent` | `--bg-hover` |
| `--primary-foreground` | `--text-inverse` | `--sidebar-border` | `--border-color` |
| `--secondary` | `--bg-tertiary` | `--sidebar-ring` | `--gold` |
| `--muted` | `--bg-tertiary` | `--chart-1` | `--gold` |
| `--muted-foreground` | `--text-muted` | `--chart-2` | `--success` |
| `--accent` | `--bg-hover` | `--chart-3` | `--error` |
| `--destructive` | `--error` | `--chart-4` | `--info` |
| `--border` | `--border-color` | `--chart-5` | `--text-secondary` |
| `--input` | `--border-color` | `--ring` | `--gold` |

---

## 十三、修改与验证流程

1. **改颜色/阴影/动画** → 只改 `globals.css` 的 CSS 变量,组件引用变量自动生效
2. **改字号** → 同步 `@theme` 的 `--text-*` 与组件 class(见 `UI-FONTS-2026-08-13.md` §10)
3. **验证** → `pnpm build` + 浏览器硬刷新(DevTools → Computed Style 核对变量实际值)
4. **一致性检查** → 全局搜索是否仍有硬编码色值(应以 `var(--x)` 为准)

---

**最后更新**:2026-08-16
**说明**:本文档为通用设计规范,不绑定任何具体项目名称,可整体复用于同风格产品。
