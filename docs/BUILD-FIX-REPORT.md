# 敦煌金 AI 项目 · 构建修复报告（任务一）

> **执行时间**：2026-08-03（多轮迭代，最终成功）
> **命令**：`NODE_ENV=production bash ./scripts/build.sh`
> **结果**：✅ **构建成功**（EXIT_CODE=0）

---

## 一、构建结果总览

| 指标 | 值 |
|---|---|
| 构建状态 | ✅ **成功** |
| 静态页面 | **25/25** 全部生成成功 |
| 总路由数 | **95**（含 1 个静态 + 94 个动态/API） |
| First Load JS（shared） | **106 kB** |
| 最大共享 chunk | 52.9 kB |
| Middleware | 38.2 kB |
| ESLint 警告 | 370 条（仅 warning，不阻塞） |
| 构建产物 | .next/ 320 MB |
| 退出码 | **0** |

### 关键路由确认
- ✅ `/`（设计工坊首页，动态）
- ✅ `/login` / `/gallery` / `/profile`（动态）
- ✅ `/admin` / `/admin/features` / `/admin/lora`（动态）
- ✅ `/api/tryon`（新补功能）
- ✅ `/api/features` / `/api/admin/features`（新增 API）
- ✅ `/api/ai/generate`（统一入口）
- ✅ 全部 78+ API 路由正常生成

---

## 二、修复过程记录（多轮迭代）

### 遇到的构建问题与修复

| # | 问题 | 根因 | 修复 |
|---|---|---|---|
| 1 | `pnpm build` 无限自递归 | `scripts/build.sh` 内调 `pnpm build` 又回到自己 | 改为 `./node_modules/.bin/next build` |
| 2 | `Cannot find module next` | `next build` 裸命令在 MSYS 下 PATH 找不到 | 用 `./node_modules/.bin/next build` 绝对路径 |
| 3 | `@ts-ignore` ESLint error | `s3-storage.ts` 用了 `@ts-ignore` 被 `ban-ts-comment` 规则拦截 | 改 `@ts-expect-error` + 类型标注 |
| 4 | `react/no-unescaped-entities` | `/admin/features/page.tsx` 未转义双引号 | 改 `&quot;` |
| 5 | `Module not found: @valkey/valkey-glide` | bullmq 6 的可选 peer dep 未被安装 | webpack externals + resolve.fallback 标记为可选 |
| 6 | `<Script>` 的 `useContext(HeadManagerContext)` 崩 | 根 layout 用 `next/script` 在预渲染时 context 为 null | 改为 `ModelViewerScript` 客户端动态注入 |
| 7 | `getAuthHeader()` SSR 访问 localStorage 崩 | 无 `typeof window` 守卫 | 加守卫返回 `{}` |
| 8 | sonner `useTheme()` 无 Provider 兜底 | next-themes 无 Provider 时 theme undefined | `theme ?? 'dark'` 兜底 |
| 9 | **`export const revalidate = 0` 冲突** | client 页面导出 `revalidate` 被 Next 当作 `next/cache` 函数引用 | **删除** client 页面的 revalidate/dynamic 导出 |
| 10 | **`NODE_ENV=development` 预渲染崩** | development 模式用 dev 版 react-dom-server | **改用 `NODE_ENV=production`**（关键） |
| 11 | 内置 `_not-found`/`/404`/`/500` 预渲染崩 | React 19.2 + Next 15.1 兼容问题 | 页面级 server layout（`export const dynamic`）+ 自定义 not-found.tsx |

### 最终生效方案（关键）

```text
1. scripts/build.sh → ./node_modules/.bin/next build（修复自递归）
2. 移除 .babelrc（恢复 SWC 编译，避免 Babel + React 19.2 兼容问题）
3. 页面级 server layout（admin/gallery/login/profile 等 6 个）
     export const dynamic = 'force-dynamic'  ← Server Component 层导出（有效）
4. 自定义 not-found.tsx（force-dynamic）
5. client 页面不导出任何 route segment config（无效且冲突）
6. NODE_ENV=production 构建（development 模式有预渲染兼容问题）
```

---

## 三、文件变更清单

### 构建相关修复
| 文件 | 改动 |
|---|---|
| `scripts/build.sh` | 自递归修复 → `./node_modules/.bin/next build` |
| `.babelrc` → `.babelrc.bak` | 移除（恢复 SWC） |
| `next.config.ts` | +valkey-glide externals/fallback（可选依赖） |
| `src/app/layout.tsx` | `<Script>` → `ModelViewerScript`（移除 next/script） |
| `src/components/app/ModelViewerScript.tsx` | **新建**（客户端动态注入 model-viewer） |
| `src/components/ui/sonner.tsx` | useTheme 兜底 `theme ?? 'dark'` |
| `src/hooks/useAuth.ts` | getAuthHeader 加 `typeof window` 守卫 |
| `src/lib/storage/s3-storage.ts` | @ts-ignore → @ts-expect-error |
| `src/app/admin/features/page.tsx` | 双引号转义 `&quot;` |
| `src/app/not-found.tsx` | **新建**（敦煌风 404，force-dynamic） |

### 页面级 server layouts（新建 6 个）
```text
src/app/admin/layout.tsx
src/app/admin/features/layout.tsx
src/app/admin/lora/layout.tsx
src/app/gallery/layout.tsx
src/app/profile/layout.tsx
src/app/login/layout.tsx
```

---

## 四、验证记录

```bash
# 最终成功命令
cd DunHuangGold-Design-AI
NODE_ENV=production \
JWT_SECRET="<random-32-char>" \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dunhuang_design" \
NEXT_PUBLIC_APP_URL="http://localhost:3000" \
bash ./scripts/build.sh
# → EXIT_CODE=0, 25/25 static pages, 95 routes
```

### ts-check 独立验证
```bash
NODE_ENV=development ./node_modules/.bin/tsc --noEmit
# → 0 errors
```

---

## 五、遗留问题（非阻塞）

| 问题 | 影响 | 建议 |
|---|---|---|
| 370 条 ESLint 警告 | 不阻塞构建（warning） | 任务二 Prettier + 分类统计 |
| `.babelrc` 被移除 | SWC 编译（正常） | 确认无 Babel 插件依赖后删除 .bak |
| 2 个 vitest suite fail | 测试（非构建） | 已知问题，后续修 |
| Next 15.1 + React 19.2 兼容 | 需 NODE_ENV=production 构建 | 建议后续升级 Next ≥15.2（用户拍板） |

---

## 六、给 CI/CD 的建议

```yaml
# GitHub Actions 构建步骤（已验证可用的 env）
- name: Build
  env:
    NODE_ENV: production
    JWT_SECRET: ${{ secrets.JWT_SECRET }}        # 必须 ≥32 字符
    DATABASE_URL: ${{ secrets.DATABASE_URL }}    # 构建期需要（静态生成查询）
    NEXT_PUBLIC_APP_URL: ${{ secrets.APP_URL }}
  run: bash ./scripts/build.sh
```

**关键要点**：
1. `NODE_ENV=production` 必须显式设置（否则预渲染兼容问题复现）
2. `JWT_SECRET` 必须注入（缺失则 fail-fast，这是安全设计）
3. `DATABASE_URL` 构建期需要（静态生成会查询数据库）
