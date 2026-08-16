import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createLogger } from '@/lib/error-handler';
import { rateLimit, getClientIP, API_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
const logger = createLogger('chat');

import { getApiConfig } from '@/lib/api-config-service';
import { spawn } from 'child_process';
import { chatSchema, sanitizeError } from '@/lib/validators';
import { randomUUID } from 'crypto';
import { unauthorized } from '@/lib/api-response';

/* eslint-disable @typescript-eslint/no-explicit-any */


// Phase 3.6：统一 requestId 注入
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';

/**
 * AI 对话 API
 * 支持多种 Provider：
 * - minimax: MiniMax-M2.7-highspeed
 * - openclaw: 九色鹿 AI 助手 (OpenClaw)
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  // 限流：按用户 ID 限流（防 API 配额滥用）
  const rl = await rateLimit(`chat:${user.userId}`, API_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    // 验证请求参数
    const body = await request.json();
    const {
      messages,
      provider: requestedProvider,
      conversationId: requestConversationId,
      model: requestedModel,
      temperature,
      max_tokens,
      top_p,
      thinking_depth,
      system_prompt,
    } = chatSchema.parse(body);

    // 调试日志：检查收到的消息是否有图片
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const lastContent = lastUserMsg?.content;
    if (Array.isArray(lastContent)) {
      const hasImage = lastContent.some((c) => c.type === 'image_url');
      logger.info('收到用户消息（多模态）', {
        contentTypes: lastContent.map((c) => c.type),
        hasImage,
        imageCount: lastContent.filter((c) => c.type === 'image_url').length,
      });
      if (!hasImage) {
        logger.warn('多模态消息中没有找到图片');
      }
    } else {
      logger.info('收到用户消息（纯文本）', { contentLength: String(lastContent ?? '').length });
    }

    // Phase 9.23：默认 provider = hermes（本地 CLI），失败降级 minimax
        let apiKey = '';
        const selectedProvider = 'hermes';
        const selectedModel = 'hermes-default';

        // Hermes 走本机 CLI，无需 API key
        if (selectedProvider === 'hermes') {
          apiKey = 'hermes-local';
        }

    // 系统提示词：用户自定义 > 默认
    const userSystemContent = system_prompt?.trim();
    const defaultSystemContent = `你是一个专业的 AI 设计助手，专注于帮助用户进行创意设计、文案撰写和艺术创作。

你的能力包括：
1. 提供设计建议和创意灵感
2. 帮助撰写设计相关的文案
3. 分析和评价设计作品
4. 推荐设计风格和配色方案
5. 解答设计相关问题

【重要】当用户发送了图片时，你必须：
- 仔细观看并描述图片中的内容（颜色、形状、风格、元素等）
- 如果是设计作品，给出专业的分析和评价
- 如果是照片，指出其视觉特点和风格
- 绝对不要只说"收到了您的图片"或"您上传了一张图片"，要真正"看"图并分析

请用专业、友好、简洁的方式回答用户的问题。`;

    const systemMessage = {
      role: 'system' as const,
      content: userSystemContent || defaultSystemContent,
    };

    // 思考深度提示（注入到 system prompt）
    const thinkingHint = thinking_depth
      ? `\n\n【思考模式：${thinking_depth === 'high' ? '深度思考' : thinking_depth === 'medium' ? '平衡' : '快速'}】请按此模式调整回答详尽程度。`
      : '';
    if (thinkingHint) {
      systemMessage.content = systemMessage.content + thinkingHint;
    }

    const allMessages = [systemMessage, ...messages];

    // 根据 provider 选择处理方式
    // 生成或使用提供的 conversationId
    const conversationId = requestConversationId || randomUUID();

    if (selectedProvider === 'hermes') {
      // 使用本机 Hermes Agent（Windows）
      return await handleHermesChat(allMessages, conversationId);
    } else if (selectedProvider === 'openclaw') {
      // 使用九色鹿 AI 助手
      return await handleOpenClawChat(allMessages, conversationId);
    } else {
      // 使用 Minimax API (默认)
      return await handleMinimaxChat(allMessages, selectedModel, apiKey, conversationId, {
        temperature,
        max_tokens,
        top_p,
      });
    }

  } catch (error) {
    // 处理 zod 验证错误
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        {requestId: reqId(),  success: false, error: '参数验证失败', details: (error as any).errors },
        { status: 400 }
      );
    }
    // 脱敏错误处理
    const { message } = sanitizeError(error, '对话失败，请稍后重试');
    logger.error('chat 失败', error);
    return NextResponse.json({requestId: reqId(),  success: false, error: message }, { status: 500 });
  }
}


/**
 * 处理 Hermes Agent 对话（Windows 本机 CLI）
 *
 * conversationId 语义 = Hermes session_id：
 *   - 首次对话：无 conversationId → 新建会话，返回 hermes 生成的 session_id
 *   - 多轮对话：带 conversationId → hermes chat --resume <session_id>（保持上下文）
 */
async function handleHermesChat(messages: any[], conversationId: string): Promise<Response> {
  // 提取最后一条用户消息纯文本（支持多模态格式）
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  const userMessageText = (() => {
    const content = lastUserMessage?.content;
    if (typeof content === 'string') return content || '你好';
    if (Array.isArray(content)) {
      const texts = content.filter((c) => c.type === 'text').map((c) => c.text);
      return texts.join('\n') || '你好';
    }
    return '你好';
  })();

  // 限制长度（防滥用）
  if (userMessageText.length > 4000) {
    throw new Error('消息过长（上限 4000 字符）');
  }

  // Hermes session_id 格式形如 20260810_130256_67f82e（数字下划线数字）
  // 前端 UUID（bdcb180f-...）不是 Hermes session，不能用于 --resume
  const isHermesSession = /^\d{8}_\d{6}_[0-9a-f]+$/i.test(conversationId || '');
  const resumeId = isHermesSession ? conversationId : undefined;

  logger.info('调用 Hermes Agent', {
    messageLength: userMessageText.length,
    resume: !!resumeId,
    conversationId,
  });

  // 调用 Hermes CLI（异步 spawn，参数数组防注入）
  const result = await callHermes(userMessageText, resumeId);

  // 返回 SSE 流式响应（与 openclaw 分支一致的协议）
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 先发送 conversationId（Hermes session_id，用于多轮续聊）
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversationId: result.sessionId })}\n\n`));

        // 字符级流式输出（正确处理 Unicode 代理对）
        const chars = [...result.reply];
        for (let i = 0; i < chars.length; i++) {
          const data = JSON.stringify({ content: chars[i], done: false });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
        controller.close();
      } catch (error) {
        logger.error('Hermes 流式输出错误', error);
        const { message } = sanitizeError(error, 'AI 服务暂时不可用，请稍后重试');
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message, done: true })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * 调用 Hermes CLI（异步，参数数组防注入）
 *
 * 输出格式（hermes chat -q "..." -Q）：
 *   session_id: 20260810_130256_67f82e
 *   回复内容
 */
function callHermes(message: string, resumeSessionId?: string): Promise<{ reply: string; sessionId: string }> {
  return new Promise((resolve, reject) => {
    // 参数数组（禁止 shell 拼接，防命令注入）
    const args = ['chat', '-q', message, '-Q'];
    if (resumeSessionId) {
      args.push('--resume', resumeSessionId);
    }

    logger.info('执行 Hermes CLI', { args: args.slice(0, 2).concat(['...']) });

    const child = spawn('hermes', args, {
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', HERMES_NONINTERACTIVE: '1' },
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Hermes 响应超时（60s）'));
    }, 60000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Hermes 启动失败: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.error('Hermes CLI 非零退出', { code, stderr: stderr.slice(0, 500), stdout: stdout.slice(0, 500) });
        reject(new Error(`Hermes 调用失败 (exit ${code})${stderr ? ': ' + stderr.slice(0, 200) : ''}`));
        return;
      }
      // 解析输出：
      //   - session_id 在 stderr（hermes -Q 模式实测：session_id: 20260810_... 打到 stderr）
      //   - 回复内容在 stdout
      const allOutput = stdout + '\n' + stderr;
      const sessionMatch = allOutput.match(/session_id:\s*(\S+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : '';
      const reply = stdout.trim();
      if (!reply) {
        reject(new Error('Hermes 返回为空'));
        return;
      }
      logger.info('Hermes 响应成功', { replyLength: reply.length, sessionId });
      resolve({ reply, sessionId: sessionId || `hermes_${Date.now()}` });
    });
  });
}

/**
 * 处理九色鹿 AI 助手 (OpenClaw)
 */
async function handleOpenClawChat(messages: any[], conversationId: string): Promise<Response> {
  // 提取最后一条用户消息
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  // 提取用户消息纯文本（支持多模态格式）
  const userMessageText = (() => {
    const content = lastUserMessage?.content;
    if (typeof content === 'string') return content || '你好';
    if (Array.isArray(content)) {
      // 多模态：提取所有文本块
      const texts = content.filter((c) => c.type === 'text').map((c) => c.text);
      return texts.join('\n') || '你好';
    }
    return '你好';
  })();

  logger.info('调用九色鹿 AI', { messageLength: userMessageText.length });

  try {
    // 调用 OpenClaw CLI
    const result = await callOpenClaw(userMessageText);

    // 返回 SSE 流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 先发送 conversationId
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversationId })}\n\n`));

          // 使用展开运算符正确处理 Unicode 代理对
          const chars = [...result];

          for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            const data = JSON.stringify({ content: char, done: false });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          // 发送完成信号
          const doneData = JSON.stringify({ content: '', done: true });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          logger.error('流式输出错误', error);
          const { message } = sanitizeError(error, 'AI 服务暂时不可用，请稍后重试');
          const errorData = JSON.stringify({ error: message, done: true });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error('九色鹿 AI 调用失败', error);
    throw error;
  }
}

/**
 * 调用 OpenClaw CLI
 * 使用 spawn + 参数数组（shell: false）执行，消息作为单个参数传入，
 * 不拼进命令行字符串，杜绝命令注入
 */
function callOpenClaw(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const openclawPath = 'C:\\Users\\v5316\\AppData\\Roaming\\npm\\node_modules\\openclaw\\dist\\index.js';
    // 参数数组传参（shell: false）：--message 的值是独立参数，含引号/特殊字符也不会被 shell 解释
    const args = [openclawPath, 'agent', '--agent', 'main', '--message', message, '--json'];

    logger.info('执行 OpenClaw CLI', { args: args.slice(0, 5).concat(['...']) });

    const child = spawn('node', args, {
      windowsHide: true,
      shell: false,
      env: { ...process.env, OPENCLAW_GATEWAY_PORT: '18789' },
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('OpenClaw 响应超时（60s）'));
    }, 60000);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`OpenClaw 启动失败: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.error('OpenClaw CLI 非零退出', { code, stderr: stderr.slice(0, 500), stdout: stdout.slice(0, 500) });
        reject(new Error(`AI 服务调用失败 (exit ${code})${stderr ? ': ' + stderr.slice(0, 200) : ''}`));
        return;
      }

      const result = stdout;
      logger.info('九色鹿原始输出', { resultLength: result.length });

      try {
        const response = JSON.parse(result);
        const text = response.result?.payloads?.[0]?.text || '';
        logger.info('九色鹿响应成功', { textLength: text.length });
        resolve(text);
      } catch (error: unknown) {
        const err = error as Error;
        logger.error('OpenClaw 输出解析失败', { stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) });
        reject(new Error(`AI 服务调用失败: ${err.message}`));
      }
    });
  });
}

/**
 * 处理 Minimax 聊天
 */
async function handleMinimaxChat(
  messages: any[],
  model: string,
  apiKey: string,
  conversationId: string,
  options?: { temperature?: number; max_tokens?: number; top_p?: number }
) {
  try {
    const minimaxBaseUrl = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';

    // 检查最后一条用户消息是否含有多模态内容
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const hasMultimodal = Array.isArray(lastUser?.content);
    logger.info('handleMinimaxChat', {
      model,
      messageCount: messages.length,
      hasMultimodal,
      lastContentType: hasMultimodal ? 'ContentBlock[]' : typeof lastUser?.content,
    });

    // 检测到图片 -> 使用 MiniMax VLM 专用端点（MiniMax-VL-01）
    if (hasMultimodal) {
      logger.info('检测到图片，使用 MiniMax VLM 端点 /v1/coding_plan/vlm');
      return handleMinimaxVLM(messages, apiKey, conversationId);
    }

    const response = await fetch(`${minimaxBaseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'MiniMax-M2.7-highspeed',
        messages: messages,
        stream: true,
        use_standard_stream: true,
        // LLM 调优参数（来自用户设置面板）
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.max_tokens !== undefined && { max_tokens: options.max_tokens }),
        ...(options?.top_p !== undefined && { top_p: options.top_p }),
      }),
    });

    if (!response.ok) {
      throw new Error('AI 服务暂时不可用，请稍后重试');
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let hasContent = false;

        // 先发送 conversationId
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversationId })}\n\n`));

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                  const json = JSON.parse(data);
                  // MiniMax 流式返回格式：choices[0].message.content（非 delta）
                  // 标准 OpenAI 格式：choices[0].delta.content
                  const content = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
                  if (content) {
                    hasContent = true;
                    const responseData = JSON.stringify({ content, done: false });
                    controller.enqueue(encoder.encode(`data: ${responseData}\n\n`));
                  }
                } catch (e) {
                  // 忽略解析错误
                }
              }
            }
          }

          const doneData = JSON.stringify({ content: '', done: true });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
        } catch (error) {
          const { message } = sanitizeError(error, 'AI 服务暂时不可用，请稍后重试');
          const errorData = JSON.stringify({ error: message || '处理失败', done: true });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    throw error;
  }
}

/**
 * 处理 MiniMax VLM 图片理解
 * 调用独立 VLM 端点 /v1/coding_plan/vlm（MiniMax-VL-01 模型）
 * 注意：VLM 端点不支持多轮对话历史，需要从 messages 构建完整 prompt
 */
async function handleMinimaxVLM(
  messages: any[],
  apiKey: string,
  conversationId: string
): Promise<Response> {
  const minimaxHost = process.env.MINIMAX_API_BASE
    ? new URL(process.env.MINIMAX_API_BASE).origin
    : 'https://api.minimax.chat';
  const vlmUrl = `${minimaxHost}/v1/coding_plan/vlm`;

  // 从消息历史中提取最后一条用户消息的图片和文字
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const contentBlocks = lastUser?.content;
  let imageUrl = '';
  let userText = '';

  if (Array.isArray(contentBlocks)) {
    for (const block of contentBlocks) {
      if (block.type === 'image_url' && block.image_url?.url) {
        imageUrl = block.image_url.url;
      } else if (block.type === 'text') {
        userText = block.text.trim();
      }
    }
  }

  if (!imageUrl) {
    throw new Error('VLM: 未找到图片数据');
  }

  logger.info('handleMinimaxVLM', {
    userTextLen: userText.length,
    imageUrlPrefix: imageUrl.substring(0, 30),
    imageUrlLen: imageUrl.length,
  });

  // 从历史消息中提取之前的对话内容，作为上下文追加到 prompt
  const chatHistory: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'user' && msg.content !== lastUser?.content) {
      const text = Array.isArray(msg.content)
        ? (msg.content.find((c: any) => c.type === 'text')?.text ?? '')
        : String(msg.content ?? '');
      if (text.trim()) chatHistory.push(`用户: ${text.trim()}`);
    } else if (msg.role === 'assistant') {
      const text = Array.isArray(msg.content)
        ? (msg.content.find((c: any) => c.type === 'text')?.text ?? '')
        : String(msg.content ?? '');
      if (text.trim()) chatHistory.push(`AI: ${text.trim()}`);
    }
  }

  // 构建完整 prompt（包含对话历史 + 当前问题）
  const historyCtx = chatHistory.length > 0
    ? `【对话历史】\n${chatHistory.join('\n')}\n\n【当前问题】\n`
    : '';
  const fullPrompt = `${historyCtx}${userText || '描述这张图片的内容'}`.trim();

  const response = await fetch(vlmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'MM-API-Source': 'DunHuangGold-AI',
    },
    body: JSON.stringify({
      prompt: fullPrompt,
      image_url: imageUrl,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`MiniMax VLM 请求失败 (${response.status}): ${body.slice(0, 200)}`);
  }

  const json = await response.json();
  const content = (json.content ?? '').trim();

  if (!content) {
    throw new Error('MiniMax VLM 返回为空');
  }

  // 将非流式响应转为 SSE 格式
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chars = [...content];
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'conversation_id', conversationId })}\n\n`));

      (async () => {
        for (let i = 0; i < chars.length; i++) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chars[i], done: false })}\n\n`));
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '', done: true })}\n\n`));
        controller.close();
      })();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
