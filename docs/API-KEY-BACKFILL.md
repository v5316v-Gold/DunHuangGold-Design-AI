# 敦煌金 AI 项目 · API Key 明文回填加密脚本（任务三）

> **执行时间**：2026-08-03
> **产物**：`scripts/encrypt-api-keys.ts`

---

## 一、脚本能力

| 需求 | 实现 |
|---|---|
| **dry-run 支持** | `--dry-run` 参数：只扫描分类，不写入数据库 |
| **跳过已加密记录** | 用 `tryDecrypt` 判断：能解密 = 已加密，跳过 |
| **执行前提示备份** | 默认要求输入 `yes` 确认（附 pg_dump 命令提示）；`--yes` 跳过 |
| **执行后输出报告** | 统计总数/已加密/跳过/失败/无法判断，含失败明细 |
| **严禁打印完整 Key** | 所有输出经过 `mask()`（前4+****+后4），空值显示 `(空)` |

## 二、用法

```bash
# 预演（推荐先跑，不写入）
DATABASE_URL="postgresql://..." \
API_KEY_ENCRYPTION_KEY="<32字节hex>" \
npx tsx scripts/encrypt-api-keys.ts --dry-run

# 正式执行（需输入 yes 确认）
DATABASE_URL="postgresql://..." \
API_KEY_ENCRYPTION_KEY="<32字节hex>" \
npx tsx scripts/encrypt-api-keys.ts

# 正式执行（跳过确认，CI 场景）
DATABASE_URL="postgresql://..." \
API_KEY_ENCRYPTION_KEY="<32字节hex>" \
npx tsx scripts/encrypt-api-keys.ts --yes
```

### 密钥生成
```bash
openssl rand -hex 32
# 输出 64 个十六进制字符，配置为 API_KEY_ENCRYPTION_KEY
```

## 三、安全设计

1. **AES-256-GCM**：iv(12B) + authTag(16B) + ciphertext，认证加密防篡改
2. **明文识别启发式**：
   - 能解密 → 已加密，跳过
   - 长得像 base64 且 ≥28 字符但解密失败 → 疑似损坏密文，**不覆盖**（人工处理）
   - 其它 → 视为明文，加密
3. **fail-fast**：DATABASE_URL 缺失 / 密钥非 32 字节 → 立即退出
4. **全链路脱敏**：预览、进度、报告均只显示 `mask()` 结果

## 四、核心逻辑验证（8 项 PASS）

```text
1. 明文加密: PASS（mask 后显示）
2. 解密验证: PASS（还原原文）
3. 已加密识别: PASS（tryDecrypt ok=true）
4. 明文识别: PASS（tryDecrypt ok=false）
5. mask 空值: PASS（显示 "(空)"）
6. mask 短值: PASS（≤8 字符显示 ****）
7. mask 不泄漏中间: PASS
8. 二次加密幂等: PASS（每次 IV 随机，密文不同）
```

## 五、数据库交互说明

- 表：`api_configs`（字段 `api_key`）
- 查询：`WHERE api_key IS NOT NULL AND api_key != ''`
- 更新：`UPDATE api_configs SET api_key = $1, updated_at = NOW() WHERE id = $2`
- 兼容：与 `src/lib/api-key-crypto.ts` 的 encryptApiKey/decryptApiKey 逻辑一致

## 六、注意事项

1. **备份先行**：执行前务必 `pg_dump` 备份（脚本会提示）
2. **密钥保管**：`API_KEY_ENCRYPTION_KEY` 与 `JWT_SECRET` 同等重要，泄漏=可解密全部 Key
3. **存量与新增一致**：新写入的 Key 也走 `api-key-crypto.ts` 加密，回填后全库统一
4. **失败重试**：脚本幂等，失败记录修正后可重跑（已加密的会自动跳过）
