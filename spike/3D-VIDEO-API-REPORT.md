# 3D / 视频 API Spike 报告

**日期**：2026-07-30
**结论**：⚠️ **海外 API 网络不可达**

---

## 测试

### Meshy API（项目已有 key）

```
GET https://api.meshy.ai/openapi/v2/models
GET https://api.meshy.ai/openapi/v2/balance
```

**结果**：
- ✅ API Key 存在（msy_sRz2RB...）
- ❌ 网络超时（74.86.226.234:443 / IPv6 2a03:2880:f127:...）
- ❌ DNS 解析到 Meta/Facebook IP 段（疑似被劫持或防火墙拦截）

### 推断：Tripo3D / Kling 同理

- Tripo3D：api.tripo3d.ai（海外）
- Kling：api.klingai.com（海外）

这两个大概率同样被防火墙拦截。

---

## 影响

| 服务 | 当前状态 |
|------|---------|
| ComfyUI（本地 8188） | ✅ 可用（局域网） |
| Minimax API | ⚠️ 需测试 |
| Meshy / Tripo3D / Kling | ❌ 网络不可达 |

## 缓解方案

| 优先级 | 方案 |
|--------|------|
| **P1** | 配置代理（HTTP_PROXY / HTTPS_PROXY 环境变量） |
| **P2** | 用国内 API 替代（火山方舟 / 阿里云百炼 / 腾讯混元 3D） |
| **P3** | 本地化（StableFast3D / Hunyuan3D 部署到本地 GPU） |

## 当前决策

**暂停接入海外 3D / 视频 API**，优先完成：
1. LoRA 系统（W3-B/C/D）
2. 端到端联调（W3-E）

等老祖明确代理或替代方案后再接入 Tripo3D / Kling。

---

## 下一步

进入 W3-B：LoRA DB 化（替换 InMemoryLoraManager）。