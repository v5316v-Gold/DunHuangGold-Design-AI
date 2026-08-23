# 负载测试（O12）

`scripts/load-test.mjs` 是 Node.js 自带的简易压测骨架（无需额外依赖），验证并发场景下：
- 幂等性（同一用户同参数不双扣算力）
- BullMQ 队列不丢失
- 响应延迟分布（p50/p95/p99）

## 用法

```bash
# 默认 20 并发 × 5 轮 = 100 次 text2img
E2E_BASE_URL=http://127.0.0.1:5000 \
E2E_ADMIN_EMAIL=admin@dunhuang.com \
E2E_ADMIN_PASSWORD=admin123 \
  node scripts/load-test.mjs

# 自定义并发
CONCURRENCY=50 ITERATIONS=10 \
  node scripts/load-test.mjs
```

## 预期输出

```
总数: 100（成功 X / 失败 Y）
幂等命中: Z         ← 应该 > 0（同一并发会触发幂等）
响应延迟：p50=Xms p95=Yms p99=Zms
```

## 真实负载测试（推荐）

骨架脚本覆盖功能/幂等验证，**不能**模拟真实负载（带宽、DB 连接池饱和、ComfyUI 慢响应）。生产负载测试建议：

- **k6**（推荐）：`grafana/k6` 镜像，分布式负载生成器 + 详细指标
  ```bash
  docker run --rm -i grafana/k6 run - <loadtest.k6.js
  ```
- **k6 cloud / Grafana Cloud k6**：托管服务
- **Locust**（Python）：分布式 Python 压测

## 已知局限

- 仅支持 text2img（chat 流式响应 + dialogue 异步任务未覆盖）
- 不验证 SSE 流式（用 polling 接口代替）
- Node 单进程 fetch 并发（~1k 并发）
- 不测量 ComfyUI / Hermes 后端延迟

## 验证清单（执行后看）

- [ ] 幂等命中 > 0（说明幂等键生效）
- [ ] p99 < 5s（text2img 5s 内返回 taskId）
- [ ] 失败率 < 5%（除显式 INVALID_INPUT）
- [ ] 数据库 pool 无 'too many connections' 错误
- [ ] BullMQ 任务数 ≈ 请求数（无丢失）
- [ ] 算力 transactions 正确（幂等合并）
