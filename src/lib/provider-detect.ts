/**
 * AI供应商识别工具
 * 根据API Key格式自动识别供应商
 */

export type AIProvider = 'zhipu' | 'doubao' | 'openai' | 'qwen' | 'kimi' | 'minimax' | 'custom';

/**
 * 根据API Key识别供应商
 */
export function detectProviderByApiKey(apiKey: string): AIProvider {
  if (!apiKey || typeof apiKey !== 'string') {
    return 'custom';
  }

  // 通义千问: 包含aigc或dashscope关键词
  if (apiKey.includes('aigc') || apiKey.includes('dashscope')) {
    return 'qwen';
  }

  // Kimi: 包含moonshot关键词
  if (apiKey.includes('moonshot')) {
    return 'kimi';
  }

  // 智谱AI: 以sk-开头且包含zhipu
  if (apiKey.includes('zhipu')) {
    return 'zhipu';
  }

  // OpenAI: 以sk-proj-开头或以sk-开头且48-51位
  if (apiKey.startsWith('sk-proj-')) {
    return 'openai';
  }
  if (apiKey.startsWith('sk-') && apiKey.length >= 48 && apiKey.length <= 51) {
    return 'openai';
  }

  // 智谱AI: 以sk-开头，长度大于51（排除OpenAI）
  if (apiKey.startsWith('sk-') && apiKey.length > 51) {
    return 'zhipu';
  }

  // Kimi: 以sk-开头，长度正好48位
  if (apiKey.startsWith('sk-') && apiKey.length === 48) {
    return 'kimi';
  }

  // 豆包: 以ak-开头
  if (apiKey.startsWith('ak-')) {
    return 'doubao';
  }

  // MiniMax: 包含group_id
  if (apiKey.includes('group_id')) {
    return 'minimax';
  }

  // 默认为自定义
  return 'custom';
}
