# AI Provider 现状报告 · Phase 9.19

> 用户决策记录（按用户明确指定）
> 决策时间：2026-08-05

## 1. 决策内容

| 类别 | 决策 | 状态 |
|------|------|------|
| 视频 API | 使用 **Minimax**（命名）| ⚠️ 实际不可用：Minimax 国内无视频模型 |
| 3D API | 使用 **Meshy**（命名）| ⚠️ 实际不可用：Meshy 海外 API 防火墙拦截 |

**关键说明**：本次决策**仅修改代码中的 `cloudProvider` 标识字段和注释**，**不接入新 API 也不删现有 provider 代码**。

## 2. 修改文件清单

### Phase A · 视频 API（Minimax）

| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-service/services/img2video.ts` | `cloudProvider: 'kling'` → `'minimax'`；注释更新 |
| `src/lib/ai-service/services/text2video.ts` | `cloudProvider: 'kling'` → `'minimax'`；注释更新 |

### Phase B · 3D API（Meshy）

| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-service/services/relief.ts` | **无需修改**（已用 Meshy 兜底）|
| `src/lib/ai-service/services/image3d.ts` | **无需修改**（已用 Meshy）|

## 3. 实际可调用性矩阵

| 服务 | 标识 | 实际 API | 国内可达 | 状态 |
|------|------|---------|---------|------|
| text2video | minimax | ❌ 无视频模型 | - | 占位返回错误 |
| img2video | minimax | ❌ 无视频模型 | - | 占位返回错误 |
| relief | meshy | ❌ 海外 API | - | ComfyUI 失败后兜底失败 |
| image3d | meshy | ❌ 海外 API | - | ComfyUI 失败后兜底失败 |

**实际可用的 4 个 AI 功能**（text2video / img2video / relief[Meshy 兜底] / image3d[Meshy 兜底]）在当前国内网络环境下**仍然返回占位错误**。

## 4. 真实接入选项（如后续需要实现）

如需真实接入视频/3D 能力，可选方案：

| 类别 | 国内方案 | 海外方案（需 VPN） |
|------|---------|------------------|
| 视频 | 通义万相 wanx2.1、智谱 CogVideoX、豆包视频 | MiniMax video-01、可灵 Kling |
| 3D | 通义万相 3D、腾讯混元 3D | Meshy V3、Tripo3D |

**本决策不限制后续接入** —— 代码中 `cloudProvider` 字段可随时调整。

## 5. 已知影响

- **功能可用性无变化**：4 个服务之前是占位，现在仍是占位
- **`/api/health` 返回不变**：仍报告 `MESHY_API_KEY: configured`（实际海外不可用）
- **代码标识变更**：服务类型 `kling` → `minimax`（仅元数据层面）
- **文档标注更新**：明确"按用户决策"+"实际不可用"双层说明

## 6. 决策约束

- ✅ **不删现有代码**：保留所有 provider 实现
- ✅ **不接入新 API**：本次仅改标识和注释
- ✅ **不破坏现有功能**：测试代码、生产路径不变
- ✅ **保留警示注释**：明确标注实际可调用性

## 7. 后续建议

如需真实视频/3D 能力：
1. 接入通义万相（视频 + 3D 统一 SDK）
2. 改造 `img2video.ts` / `relief.ts` 中的 fetch 调用
3. 写集成测试
4. 真实 API Key + 端到端冒烟

**预计 1-2 周工作量**（Phase A + B 完整实施）。

---

**当前状态**：代码标识变更已完成（Phase A + B）。**未提交**。等待 Phase D 验证 + 推送。