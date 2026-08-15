'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Send,
  Bot,
  User,
  Trash2,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  X,
  Check,
  Settings,
  Brain,
  Sun,
  Mic,
  ArrowUp,
  ChevronDown,
  FileText,
  Upload,
} from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { getAuthHeader } from '@/lib/auth-client';
import { apiClient, API_ROUTES } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { ModelPickerModal } from './sub-components/ModelPickerModal';
import { ROLE_PRESETS, ROLE_ICONS } from '@/lib/ai/role-presets';

/* eslint-disable @typescript-eslint/no-explicit-any */


/** 模型参数配置 */
interface ModelParams {
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  thinkingDepth: 'low' | 'medium' | 'high';
  systemPrompt: string;
}

const DEFAULT_PARAMS: ModelParams = {
  model: '', // 启动时从 /api/models 加载默认模型
  temperature: 0.7,
  max_tokens: 50,
  top_p: 0.9,
  thinkingDepth: 'high',
  systemPrompt: '',
};

/** 估算 token 数（中文 1.5 字符/token，英文 4 字符/token） */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // 中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

/** 消息内容块（多模态） */
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface Message {
  id: string;
  role: 'user' | 'assistant';
  /** 纯文本，用于 UI 展示 */
  content: string;
  /** 多模态内容块，仅 user 消息且带图片时存在 */
  contentBlocks?: ContentBlock[];
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  conversationId?: string;
}

interface AIDialogProps {
  power: number;
  onDeductPower: (amount: number, reason: string) => void;
}

export default function AIDialog({ power, onDeductPower }: AIDialogProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
    // 模型参数与工具栏 UI
    const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);

    // 启动时从 /api/models 加载默认模型（管理员在后台改默认后立即生效）
    useEffect(() => {
      apiClient.get<{ default?: string }>(API_ROUTES.models)
        .then((data) => {
          const model = data.data?.default;
          if (model) {
            setParams((prev) => ({ ...prev, model }));
          }
        })
        .catch(() => {});
    }, []);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showThinkingMenu, setShowThinkingMenu] = useState(false);
    const [showSettingsPopover, setShowSettingsPopover] = useState(false);
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref 追踪图片（同步读取，解决 state 异步更新导致的竞态）
  const uploadedImagesRef = useRef<string[]>([]);
  const cost = getTaskCost('dialogue');

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
    const messages = currentConversation?.messages || [];

    // 当前会话 token 估算（用于顶部进度条）— 简单计算，无需 memoize
    let currentConversationTokenUsage = 0;
    if (currentConversation) {
      let total = 0;
      for (const msg of currentConversation.messages) {
        total += estimateTokens(msg.content || '');
      }
      currentConversationTokenUsage = total / 1000; // 转为 k
    }

  // 加载会话
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aidialog-data');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.conversations) {
          setConversations(data.conversations.map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
          })));
        }
        if (data.currentId) {
          setCurrentConversationId(data.currentId);
        }
        if (data.input) {
          setInput(data.input);
        }
      }
    } catch (e) {
      console.warn('[AIDialog] 加载失败:', e);
    }
    setIsLoaded(true);
  }, []);

  // 保存会话
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem('aidialog-data', JSON.stringify({
        conversations,
        currentId: currentConversationId,
        input,
      }));
    } catch (e) {
      console.warn('[AIDialog] 保存失败:', e);
    }
  }, [conversations, currentConversationId, input, isLoaded]);

  // 点击外部关闭 popover
  useEffect(() => {
    if (!showUploadMenu && !showThinkingMenu && !showSettingsPopover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-toolbar-popover]')) return;
      setShowUploadMenu(false);
      setShowThinkingMenu(false);
      setShowSettingsPopover(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUploadMenu, showThinkingMenu, showSettingsPopover]);

  // 将 File 转换为 base64 data URL（Promise 化，确保读完再继续）
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
      reader.readAsDataURL(file);
    });
  };

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        // await 确保 FileReader 完全读完，同时写 ref（同步）和 state（异步）
        const dataUrl = await readFileAsDataUrl(file);
        uploadedImagesRef.current = [...uploadedImagesRef.current, dataUrl];
        setUploadedImages((prev) => [...prev, dataUrl]);
        console.log(`[AIDialog] 图片上传成功: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB`);
      } catch (error) {
        console.error('[AIDialog] 图片上传失败:', error);
        alert(`图片上传失败: ${(error as Error).message}`);
      }
    }

    // 清空 input 以允许重新选择相同文件
    e.target.value = '';
  };

  // 处理文件上传（用于参考图等）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          // 文件类型消息
          const fileMessage = `【上传文件】${file.name}`;
          setInput((prev) => prev + (prev ? '\n' : '') + fileMessage);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('[AIDialog] 文件上传失败:', error);
      }
    }

    e.target.value = '';
  };

  // 移除已上传的图片
  const removeUploadedImage = (index: number) => {
    uploadedImagesRef.current = uploadedImagesRef.current.filter((_, i) => i !== index);
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date(),
    };
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 取消之前的请求（如果有）
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // 从 ref 读取图片（同步），避免 state 异步导致的竞态
    const currentImages = [...uploadedImagesRef.current];
    uploadedImagesRef.current = []; // 立即清空 ref
    setUploadedImages([]);

    // 如果没有当前对话，先创建一个
    let conversationId = currentConversationId;
    if (!conversationId) {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: input.trim().slice(0, 20) || '新对话',
        messages: [],
        createdAt: new Date(),
      };
      setConversations((prev) => [newConversation, ...prev]);
      conversationId = newConversation.id;
      setCurrentConversationId(conversationId);
    }

    // 构建用户消息内容（包含图片）
    const trimmedInput = input.trim();
    const hasImages = currentImages.length > 0;

    // 调试日志：确认图片是否正确捕获
    if (hasImages) {
      console.log(`[AIDialog] 发送消息：文字 + ${currentImages.length} 张图片`);
      currentImages.forEach((img, i) => {
        console.log(`  图片${i + 1}: ${img.substring(0, 50)}... (总长度: ${img.length})`);
      });
    } else {
      console.log('[AIDialog] 发送消息：纯文字（currentImages 为空）');
    }

    // 用于 UI 展示的纯文本内容（图片单独渲染，不用占位符）
    const displayContent = trimmedInput;

    // 构建多模态内容块（API 格式）
    const contentBlocks: ContentBlock[] = [];
    if (trimmedInput) {
      contentBlocks.push({ type: 'text', text: trimmedInput });
    }
    for (const img of currentImages) {
      contentBlocks.push({ type: 'image_url', image_url: { url: img } });
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent,
      contentBlocks: hasImages ? contentBlocks : undefined,
      timestamp: new Date(),
    };

    const assistantMessageId = (Date.now() + 1).toString();

    // 更新对话标题（使用第一条消息）并添加用户消息和空的助手消息
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: [
              ...c.messages,
              userMessage,
              { id: assistantMessageId, role: 'assistant' as const, content: '', timestamp: new Date() }
            ],
            title: c.messages.length === 0 ? input.trim().slice(0, 20) : c.title,
          };
        }
        return c;
      })
    );

    setInput('');
    setIsLoading(true);

    try {
      // 获取当前对话的消息（在状态更新后）
      // 多模态消息格式：content 为 string（纯文本）或 ContentBlock[]（多模态）
      type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string | ContentBlock[] };
      let messagesToSend: ApiMessage[] = [];
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === conversationId);
        if (conv) {
          messagesToSend = [...conv.messages, userMessage].map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            // 有图片时发多模态格式，否则发纯文本
            content: m.contentBlocks ?? m.content,
          }));
        }
        return prev;
      });

      // 等待状态更新
      await new Promise(resolve => setTimeout(resolve, 0));

      // 直接调用 chat API（SSE）并解析 conversationId 事件
      let accumulatedContent = '';
      let hasContent = false;
      let serverConversationId: string | undefined;

      // 获取当前对话的 server conversationId
      let currentServerConvId: string | undefined;
      setConversations((prev) => {
        const conv = prev.find((c) => c.id === conversationId);
        currentServerConvId = conv?.conversationId;
        return prev;
      });

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            messages: messagesToSend,
            provider: 'hermes', // 接入 Windows 本机 Hermes Agent
            ...(currentServerConvId ? { conversationId: currentServerConvId } : {}),
            model: params.model,
            temperature: params.temperature,
            max_tokens: params.max_tokens,
            top_p: params.top_p,
            thinking_depth: params.thinkingDepth,
            system_prompt: params.systemPrompt || undefined,
          }),
          signal: abortControllerRef.current!.signal,
        });

        if (!response.ok || !response.body) {
          let errorMsg = 'AI 服务暂时不可用';
          // 尝试从响应体中读取真实错误信息
          try {
            const errData = await response.clone().json();
            if (errData?.error) errorMsg = errData.error;
          } catch {
            // 响应体无法解析，使用默认错误信息
          }
          // 401/403 → 认证错误，提示登录
          if (response.status === 401 || response.status === 403) {
            errorMsg = '请先登录后使用 AI 对话';
          }
          throw new Error(errorMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const dataStr = line.slice(6).trim();
              if (!dataStr || dataStr === '[DONE]') continue;

              try {
                const data = JSON.parse(dataStr) as Record<string, unknown>;

                if (data.type === 'conversation_id' && data.conversationId) {
                  // 保存服务器的 conversationId 到对话
                  serverConversationId = data.conversationId as string;
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === conversationId ? { ...c, conversationId: serverConversationId } : c
                    )
                  );
                  continue;
                }

                const content = data.content as string | undefined;
                if (content) {
                  hasContent = true;
                  accumulatedContent += content;

                  setConversations((prev) =>
                    prev.map((c) => {
                      if (c.id === conversationId) {
                        return {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, content: accumulatedContent }
                              : m
                          ),
                        };
                      }
                      return c;
                    })
                  );
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (streamError) {
        if ((streamError as Error).name === 'AbortError') {
          // 用户取消，不报错
        } else {
          console.error('[AIDialog] 流式调用失败:', streamError);
          hasContent = false;
        }
      }

      // 只有成功收到内容才扣除算力
      if (hasContent && accumulatedContent.length > 0) {
        onDeductPower(cost, 'AI对话');
      }
    } catch (error) {
      console.error('[AIDialog] Error:', error);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: '抱歉，发生了错误。请稍后重试。' }
                  : m
              ),
            };
          }
          return c;
        })
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (currentConversationId) {
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConversationId ? { ...c, messages: [] } : c))
      );
    }
  };

  // 角色卡点击：填 input + 切 systemPrompt + 自动配参数
  const handleRoleSelect = (role: typeof ROLE_PRESETS[number]) => {
    setSelectedRoleId(role.id);
    setInput(role.prompt);
    setParams((prev) => ({
      ...prev,
      systemPrompt: role.systemPrompt,
      ...(role.suggestedParams?.temperature !== undefined && {
        temperature: role.suggestedParams.temperature,
      }),
      ...(role.suggestedParams?.thinkingDepth && {
        thinkingDepth: role.suggestedParams.thinkingDepth,
      }),
    }));
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden" data-ai-assistant-enabled>
      {/* 左侧 - 历史对话管理面板 */}
      <div className="w-[260px] min-w-[260px] bg-[var(--bg-primary)] border-r border-[var(--border-color)] flex flex-col">
        {/* 新建对话按钮 */}
        <div className="p-4">
          <button
            onClick={createNewConversation}
            className="w-full py-3 bg-[var(--gold)] text-black font-semibold rounded-lg flex items-center justify-center gap-2 hover:bg-[var(--gold-hover)] transition-all"
          >
            <Plus className="w-5 h-5" />
            新建对话
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索历史对话..."
              className="w-full pl-9 pr-3 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none"
            />
          </div>
        </div>

        {/* 历史对话记录 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text-secondary)]">历史对话记录</span>
            <span className="text-xs text-[var(--text-muted)]">共{conversations.length}条</span>
          </div>

          {filteredConversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--text-muted)]">暂无对话记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setCurrentConversationId(conversation.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setCurrentConversationId(conversation.id)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left transition-all group cursor-pointer',
                    currentConversationId === conversation.id
                      ? 'bg-[var(--gold-muted)] border border-[var(--gold)]'
                      : 'bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--gold)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          currentConversationId === conversation.id
                            ? 'text-[var(--gold)]'
                            : 'text-[var(--text-primary)]'
                        )}
                      >
                        {conversation.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {conversation.messages.length} 条消息
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 中间 - 主对话交互区域 */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
        {/* 顶部状态栏 */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-[var(--text-secondary)]">SYSTEM READY</span>
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {currentConversation?.title || '新对话'}
          </span>
        </div>

        {/* 对话内容展示区 */}
        <div className="flex-1 overflow-y-auto p-6 bg-dots">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                <Sparkles className="w-10 h-10 text-black" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">敦煌 AI 助手</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed">
                我是您的智能设计助手，可以帮助您进行创意构思、文案撰写、设计建议等。
                <br />
                有任何问题都可以问我！
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex gap-4', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {message.role === 'assistant' && message.content && (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center flex-shrink-0 shadow-md">
                      <Bot className="w-5 h-5 text-black" />
                    </div>
                  )}
                  {message.content && (
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-5 py-4',
                        message.role === 'user'
                          ? 'bg-[var(--gold)] text-black'
                          : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]'
                      )}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      {/* 用户消息的图片预览（contentBlocks 里的 base64 图片） */}
                      {message.role === 'user' && message.contentBlocks && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.contentBlocks
                            .filter((b) => b.type === 'image_url')
                            .map((block, idx) => {
                              const url = (block as any).image_url?.url ?? '';
                              if (!url) return null;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setLightboxImage(url)}
                                  className="block w-20 h-20 rounded-lg overflow-hidden border-2 border-black/10 hover:border-[var(--gold)] transition-colors"
                                  title="点击查看大图"
                                >
                                  <Image
                                    src={url}
                                    alt={`图片${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    width={80}
                                    height={80}
                                    unoptimized
                                  />
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center flex-shrink-0 border border-[var(--border-color)]">
                      <User className="w-5 h-5 text-[var(--text-primary)]" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center flex-shrink-0 shadow-lg relative">
                    <Bot className="w-5 h-5 text-black" />
                    {/* 脉冲光环 */}
                    <span className="absolute inset-0 rounded-xl bg-[var(--gold)] opacity-30 animate-ping" />
                  </div>
                  <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-5 py-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      {/* 三点波浪动画 */}
                      <span className="flex gap-0.5 items-end h-4">
                        <span className="w-1 h-2 bg-[var(--gold)] rounded-full animate-pulse" style={{animationDelay: '0ms'}} />
                        <span className="w-1 h-3 bg-[var(--gold)] rounded-full animate-pulse" style={{animationDelay: '200ms'}} />
                        <span className="w-1 h-2 bg-[var(--gold)] rounded-full animate-pulse" style={{animationDelay: '400ms'}} />
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">正在输入<span className="inline-flex ml-0.5">
                        <span className="animate-pulse" style={{animationDelay: '0ms'}}>.</span>
                        <span className="animate-pulse" style={{animationDelay: '300ms'}}>.</span>
                        <span className="animate-pulse" style={{animationDelay: '600ms'}}>.</span>
                      </span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 底部输入交互区 */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4">
              {/* 顶部 token 统计（参考 Cursor 风格） */}
              {currentConversation && currentConversation.messages.length > 0 && (
                <div className="flex items-center justify-between mb-2 text-[11px] text-[var(--text-muted)]">
                  <span>
                    {currentConversationTokenUsage.toFixed(1)}k / 1.0M · 剩余 {(1000 - currentConversationTokenUsage).toFixed(1)}k
                  </span>
                  <div className="w-24 h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--text-muted)] transition-all"
                      style={{ width: `${Math.min(100, (currentConversationTokenUsage / 1000) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 已上传图片预览 */}
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <Image
                        src={img}
                        alt={`上传图片 ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg border border-[var(--border-color)]"
                        width={64}
                        height={64}
                        unoptimized
                      />
                      <button
                        onClick={() => removeUploadedImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 隐藏的文件输入 */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* 输入框 */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息，或上传图片作为参考..."
                className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none min-h-[60px]"
                rows={2}
                disabled={isLoading}
              />

              {/* 底部工具栏（Cursor/Claude 风格） */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mt-3">
                <div className="flex items-center gap-1">
                  {/* + 加号 popover */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowUploadMenu(!showUploadMenu);
                        setShowThinkingMenu(false);
                        setShowSettingsPopover(false);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                      title="上传"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {showUploadMenu && (
                      <div data-toolbar-popover className="absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 w-40 z-50">
                        <button
                          onClick={() => {
                            imageInputRef.current?.click();
                            setShowUploadMenu(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                        >
                          <ImageIcon className="w-4 h-4" />上传图片
                        </button>
                        <button
                          onClick={() => {
                            fileInputRef.current?.click();
                            setShowUploadMenu(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />上传文件
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 思考深度 */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowThinkingMenu(!showThinkingMenu);
                        setShowUploadMenu(false);
                        setShowSettingsPopover(false);
                      }}
                      className={cn(
                        'h-7 px-2 rounded-lg flex items-center gap-1 text-[13px] transition-all',
                        params.thinkingDepth === 'high'
                          ? 'text-[var(--gold)] hover:bg-[var(--bg-hover)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                      )}
                      title="思考深度"
                    >
                      <Brain className="w-4 h-4" />
                      <span>
                        {params.thinkingDepth === 'high' && '高'}
                        {params.thinkingDepth === 'medium' && '中'}
                        {params.thinkingDepth === 'low' && '低'}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showThinkingMenu && (
                      <div data-toolbar-popover className="absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 w-32 z-50">
                        {(['high', 'medium', 'low'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => {
                              setParams({ ...params, thinkingDepth: level });
                              setShowThinkingMenu(false);
                            }}
                            className={cn(
                              'w-full px-3 py-2 text-left text-sm transition-all',
                              params.thinkingDepth === level
                                ? 'text-[var(--gold)] bg-[var(--bg-hover)]'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            )}
                          >
                            {level === 'high' && '高 · 深度思考'}
                            {level === 'medium' && '中 · 平衡'}
                            {level === 'low' && '低 · 快速'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 设置 */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSettingsPopover(!showSettingsPopover);
                        setShowUploadMenu(false);
                        setShowThinkingMenu(false);
                      }}
                      className="h-7 px-2 rounded-lg flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
                      title="参数设置"
                    >
                      <Settings className="w-4 h-4" />
                      <span>设置</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showSettingsPopover && (
                      <div data-toolbar-popover className="absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg shadow-xl p-4 w-72 z-50 space-y-3">
                        <div>
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">
                            Temperature: {params.temperature.toFixed(2)}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={params.temperature}
                            onChange={(e) =>
                              setParams({ ...params, temperature: parseFloat(e.target.value) })
                            }
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">
                            Max Tokens
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="32000"
                            step="256"
                            value={params.max_tokens}
                            onChange={(e) =>
                              setParams({ ...params, max_tokens: parseInt(e.target.value) || 50 })
                            }
                            className="w-full px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-sm text-[var(--text-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">
                            Top-P: {params.top_p.toFixed(2)}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={params.top_p}
                            onChange={(e) =>
                              setParams({ ...params, top_p: parseFloat(e.target.value) })
                            }
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-[var(--text-secondary)] mb-1">
                            系统提示词（可选）
                          </label>
                          <textarea
                            value={params.systemPrompt}
                            onChange={(e) =>
                              setParams({ ...params, systemPrompt: e.target.value })
                            }
                            placeholder="自定义 AI 行为..."
                            rows={2}
                            className="w-full px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] resize-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 模型选择 */}
                  <button
                    onClick={() => setShowModelPicker(true)}
                    className="h-7 px-2 rounded-lg flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
                    title="切换模型"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{params.model}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* 麦克风（占位） */}
                  <button
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                    title="语音输入（即将开放）"
                    disabled
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* 发送按钮（圆形图标） */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="w-8 h-8 rounded-full bg-[var(--gold)] text-black flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--gold-hover)] transition-all"
                    title="发送 (Enter)"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* 底部提示 */}
            <p className="text-xs text-[var(--text-muted)] text-center mt-3">
              AI生成的内容仅供参考，请注意甄别并结合实际工艺规范。
            </p>
          </div>
        </div>
      </div>

      {/* 右侧 - 场景预设面板 */}
      <div className="w-[280px] min-w-[280px] bg-[var(--bg-primary)] border-l border-[var(--border-color)] overflow-y-auto">
        <div className="p-5">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--gold)]" />
            敦煌金设计助手
          </h3>

          {/* 场景指令预设库（9 个专家角色 · 平铺） */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
              场景指令预设库
            </label>
            <div className="space-y-2">
              {ROLE_PRESETS.map((role) => {
                const Icon = ROLE_ICONS[role.iconName];
                const isSelected = selectedRoleId === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role)}
                    className={cn(
                      'w-full p-2.5 rounded-lg text-left transition-all border',
                      isSelected
                        ? 'bg-[var(--bg-hover)] border-[var(--gold)] shadow-[0_0_0_1px_var(--gold)]'
                        : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--gold)]/50 hover:bg-[var(--bg-hover)]/50'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon
                            className={cn(
                              'w-3.5 h-3.5 flex-shrink-0',
                              isSelected ? 'text-[var(--gold)]' : 'text-[var(--text-secondary)]'
                            )}
                          />
                          <span
                            className={cn(
                              'text-sm truncate',
                              isSelected
                                ? 'font-semibold text-[var(--text-primary)]'
                                : 'font-medium text-[var(--text-primary)]'
                            )}
                          >
                            {role.title}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                          {role.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[var(--gold)] flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-3">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="w-full py-2.5 text-sm text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                清空当前对话
              </button>
            )}
          </div>

          {/* 算力信息 */}
          <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">消耗算力</span>
              <span className="text-[var(--gold)] font-bold">{cost}/次</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-[var(--text-muted)]">当前算力</span>
              <span className="text-[var(--text-primary)] font-bold">{power}</span>
            </div>
          </div>
        </div>

        {/* 模型选择 Modal */}
        <ModelPickerModal
          isOpen={showModelPicker}
          onClose={() => setShowModelPicker(false)}
          selectedModel={params.model}
          onSelect={(modelId) => setParams({ ...params, model: modelId })}
        />

        {/* 图片预览弹窗（Lightbox） */}
        {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
          <Image
            src={lightboxImage}
            alt="预览"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            width={1920}
            height={1080}
            unoptimized
          />
        </div>
      )}
      </div>
    </div>
  );
}