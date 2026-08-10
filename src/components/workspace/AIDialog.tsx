'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Send, Bot, User, Trash2, Image as ImageIcon, Paperclip, Plus, Search, Sparkles, X } from 'lucide-react';
import { getTaskCost } from '@/lib/power';
import { getAuthHeader } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref 追踪图片（同步读取，解决 state 异步更新导致的竞态）
  const uploadedImagesRef = useRef<string[]>([]);
  const cost = getTaskCost('dialogue');

  const currentConversation = conversations.find((c) => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];

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

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scenePresets = [
    { label: '戒指设计', prompt: '请帮我设计一款戒指，风格是' },
    { label: '项链设计', prompt: '请帮我设计一款项链，风格是' },
    { label: '手镯设计', prompt: '请帮我设计一款手镯，风格是' },
    { label: '耳饰设计', prompt: '请帮我设计一款耳饰，风格是' },
    { label: '敦煌风格', prompt: '请以敦煌风格为主题，帮我构思设计' },
    { label: '现代简约', prompt: '请以现代简约风格为主题，帮我构思设计' },
  ];

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

              {/* 底部操作栏 */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mt-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                    title="上传图片"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                    title="上传文件"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  {uploadedImages.length > 0 && (
                    <span className="text-xs text-[var(--gold)]">{uploadedImages.length} 张图片</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">Enter 发送 / Shift+Enter 换行</span>
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="px-5 py-2 bg-[var(--gold)] text-black font-medium rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--gold-hover)] transition-all"
                  >
                    <Send className="w-4 h-4" />
                    发送
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
            敦煌设计助手
          </h3>

          {/* 模型信息 */}
          <div className="mb-6 p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-[var(--gold)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">当前模型</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">MiniMax-M2.7-highspeed</p>
          </div>

          {/* 场景指令预设库 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
              快捷指令
            </label>
            <div className="space-y-2">
              {scenePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setInput(preset.prompt)}
                  className="w-full p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-left hover:border-[var(--gold)] hover:bg-[var(--bg-hover)] transition-all group"
                >
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--gold)] transition-colors">
                    {preset.label}
                  </span>
                </button>
              ))}
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
      </div>

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
  );
}