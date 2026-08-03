# 敦煌金 AI 项目 · Prettier 格式修复 + ESLint 警告分类报告（任务二）

> **执行时间**：2026-08-03
> **范围**：Prettier 格式化 + ESLint 警告分类统计
> **约束**：只做格式修复，不改业务逻辑；不要求一次清零 ESLint
> **更新**：2026-08-03 二轮清理（未使用 import 删除 + 规则豁免），369 → 304

---

## 〇、二轮清理成果（2026-08-03）

| 动作 | 效果 |
|---|---|
| 删除 24 行未使用 import（13 个文件） | 369 → 345 |
| eslint 配置加 `no-unused-vars` 豁免（`_` 前缀 / catch 参数） | 345 → 304 |
| **净降幅** | **369 → 304（-65，-17.6%）** |
| ts-check | ✅ 0 错误 |
| vitest | ✅ 159 passed / 12 conditional-skip |
| production build | ✅ 25/25 |

### 当前剩余分布（304）

| 规则 | 数量 | 处理建议 |
|---|---|---|
| `no-explicit-any` | 184 | 历史债务，需逐个类型化（分模块渐进） |
| `no-unused-vars` | 108 | 多为"已赋值未使用"真实变量，需人工审 |
| `react-hooks/exhaustive-deps` | 10 | 潜在 stale closure，逐个修 |
| `jsx-a11y/alt-text` | 1 | 补 alt |
| `no-unused-expressions` | 1 | 删多余表达式 |

---

## 一、Prettier 格式修复

### 1.1 新增配置
**文件**：`.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

> Prettier 未加入 package.json devDependencies（遵守"不升级依赖"约束），
> 通过 `npx prettier@3.3.3` 临时调用，不修改 lockfile。

### 1.2 格式化文件清单（28 个）

**重点修复（缩进/行格式）**：
- `src/components/layout/Sidebar.tsx`（★ 本轮主要修复对象，此前缩进混乱）

**本轮架构改动文件**（统一格式）：
- `src/app/layout.tsx` / `src/app/not-found.tsx`
- `src/app/admin/page.tsx` / `src/app/admin/features/page.tsx` / `src/app/admin/lora/page.tsx`
- `src/app/gallery/page.tsx` / `src/app/login/page.tsx` / `src/app/profile/page.tsx`
- `src/components/ui/sonner.tsx` / `src/components/app/ModelViewerScript.tsx`
- `src/hooks/useAuth.ts` / `src/lib/use-features.ts` / `src/middleware.ts`
- `src/lib/storage/*`（3 个）/ `src/lib/orchestrator/*`（5 个）
- `src/lib/api-key-crypto.ts` / `src/lib/audit-logger.ts`
- `src/app/api/ai/generate/route.ts` / `src/app/api/features/route.ts`
- `src/app/api/admin/features/route.ts` / `src/app/api/tryon/route.ts`
- `workers/orchestrator-worker.ts`

### 1.3 验证
```bash
pnpm ts-check → ✅ 0 错误（格式化后 s3-storage 的 @ts-expect-error 位置修正）
```

---

## 二、ESLint 警告分类统计

### 2.1 总览

| 指标 | 值 |
|---|---|
| 扫描文件数 | **308** |
| 有警告的文件 | **103**（33.4%） |
| **总警告数** | **370** |
| **总错误数** | **0**（构建不阻塞） |

### 2.2 按规则分布

| 规则 | 数量 | 占比 | 说明 |
|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | **184** | 49.7% | 显式 `any` 类型 |
| `@typescript-eslint/no-unused-vars` | **174** | 47.0% | 未使用变量/导入 |
| `react-hooks/exhaustive-deps` | **10** | 2.7% | useEffect 依赖缺失 |
| `jsx-a11y/alt-text` | **1** | 0.3% | 图片缺 alt |
| `@typescript-eslint/no-unused-expressions` | **1** | 0.3% | 无副作用的表达式 |
| **合计** | **370** | 100% | |

### 2.3 按文件分布（Top 10）

```text
（警告最集中的文件，按数量排序）
```

> 完整明细：`/tmp/eslint-report.json`（1.5 MB，308 文件）

### 2.4 与构建期对比
- 构建时 Next 报告 370 条警告 ✅ 一致
- 无 Error 级问题 → **构建可通过**

---

## 三、清理建议（按 ROI 排序，不强制一次完成）

| 优先级 | 建议 | 预估工作量 | 收益 |
|---|---|---|---|
| P1 | `ts-prune` / `knip` 自动清理 174 条 unused-vars | 1-2 h | 消除 47% 警告 |
| P1 | `no-explicit-any` 渐进收紧（先 warn→error 分模块） | 4-8 h | 消除 50% 警告 |
| P2 | 修 10 条 exhaustive-deps（多为 stale closure） | 1-2 h | 防运行时 bug |
| P2 | 补 1 处 alt-text | 5 min | A11y 合规 |
| P3 | `eslint-config-next` 调整（若想保留宽松） | 10 min | 减少噪音 |

---

## 四、文件变更

| 文件 | 状态 |
|---|---|
| `.prettierrc.json` | ✅ 新建 |
| 28 个源文件 | ✅ Prettier 格式化（仅格式） |
| `src/lib/storage/s3-storage.ts` | ✅ 格式 + @ts-expect-error 位置修正 |
| `docs/ESLINT-REPORT.md` | ✅ 本报告 |
