#!/usr/bin/env node
/**
 * Hermes CLI Mock（node shebang）
 * - hermes --version  → 输出版本，exit 0（让 isAvailable probe 通过）
 * - hermes chat -q "<msg>" -Q [--resume <sid>]
 *   → 输出 session_id（数字_数字_十六进制） + 回复
 *   回复内容从 MINIMAX_API_KEY 调 MiniMax chat（兜底：fallback 本地 mock 回复）
 *
 * 真正接 Hermes 路径：spawn('hermes', ...) 成功 → 路由不走兜底 → AIDialog
 * 收到 Hermes 输出。
 */
'use strict';

const args = process.argv.slice(2);

// --version 健康检查
if (args[0] === '--version') {
  process.stdout.write('hermes 1.0.0 (mock)\n');
  process.exit(0);
}

// chat
if (args[0] === 'chat') {
  const qIdx = args.indexOf('-q');
  const message = qIdx >= 0 ? args[qIdx + 1] : '';
  const resumeIdx = args.indexOf('--resume');
  const resumeId = resumeIdx >= 0 ? args[resumeIdx + 1] : null;

  const sessionId = generateSessionId();

  // 异步主流程
  (async () => {
    let reply = '';
    try {
      reply = await callMinimax(message);
    } catch (e) {
      // MiniMax 失败 → 本地兜底回复（保证 Hermes 路径总能产出回复）
      reply = localFallbackReply(message);
    }
    // Hermes 真实输出格式：stderr 打印 session_id: <sid>，stdout 打印回复
    // （chat route 兼容两种解析：stderr "session_id: ..." 匹配 + stdout 内容）
    process.stderr.write(`session_id: ${sessionId}\n`);
    process.stdout.write(reply + '\n');
    process.exit(0);
  })();
  return;
}

// 其他命令 → 失败但 exit 0（避免 isAvailable probe 误判）
process.stdout.write('hermes: unknown command\n');
process.exit(0);

function generateSessionId() {
  const d = new Date();
  const ymd = d.getFullYear().toString() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const hms = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return `${ymd}_${hms}_${hex}`;
}

async function callMinimax(message) {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('no key');
  const base = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
  const resp = await fetch(`${base}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7-highspeed',
      messages: [
        { role: 'system', content: '你是 Hermes，本地 AI 助手。简洁回答。' },
        { role: 'user', content: message || '你好' },
      ],
      stream: false,
      max_tokens: 500,
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const j = await resp.json();
  const c = j?.choices?.[0]?.message?.content;
  return (typeof c === 'string' && c.trim()) ? c.trim() : localFallbackReply(message);
}

function localFallbackReply(message) {
  const m = String(message || '').trim();
  if (!m) return '你好，我是 Hermes 本地助手。';
  return `（Hermes 本地回退）收到：${m.slice(0, 80)}。请配置 MINIMAX_API_KEY 启用云端回复。`;
}
