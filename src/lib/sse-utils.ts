/**
 * SSE (Server-Sent Events) 工具函数
 */

/**
 * 将 fetch Response 对象转换为 SSE JSON 流的 AsyncGenerator
 */
export async function* fetchSSEJson<T = unknown>(
  response: Response
): AsyncGenerator<T, void, unknown> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data && data !== '[DONE]') {
                try {
                  yield JSON.parse(data) as T;
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              yield JSON.parse(data) as T;
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
