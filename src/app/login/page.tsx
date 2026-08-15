'use client';

// 标记为动态渲染，避免静态生成时缺少客户端上下文

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Zap,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Sparkles,
  Box,
  Palette,
  Video,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */


type AuthMode = 'login' | 'register';

// 敦煌莫高窟九层楼 SVG 组件 - 金边金光流转效果
function NineStoryPavilion() {
  return (
    <svg viewBox="0 0 400 550" className="absolute inset-0 w-full h-full" style={{ opacity: 0.18 }}>
      <defs>
        {/* 金色渐变 */}
        <linearGradient id="goldFlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4">
            <animate
              attributeName="stopColor"
              values="#D4AF37;#F5D76E;#D4AF37"
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor="#F5D76E" stopOpacity="0.8">
            <animate
              attributeName="stopColor"
              values="#F5D76E;#D4AF37;#F5D76E"
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.4">
            <animate
              attributeName="stopColor"
              values="#D4AF37;#F5D76E;#D4AF37"
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>

        {/* 楼阁渐变 */}
        <linearGradient id="pavilionGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5D76E" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8B6914" stopOpacity="0.3" />
        </linearGradient>

        {/* 外发光 */}
        <filter id="outerGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#D4AF37" floodOpacity="0.4" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 内发光 */}
        <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* 光晕背景 */}
        <radialGradient id="haloGradient" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#F5D76E" stopOpacity="0.15">
            <animate
              attributeName="stopOpacity"
              values="0.15;0.3;0.15"
              dur="5s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 背景光晕 */}
      <ellipse cx="200" cy="300" rx="180" ry="220" fill="url(#haloGradient)" />

      {/* === 九层楼主体结构 === */}
      <g filter="url(#outerGlow)" stroke="url(#goldFlow)" fill="none" strokeWidth="1.2">
        {/* === 基座/台基 === */}
        <path d="M80 500 L320 500 L330 520 L70 520 Z" strokeWidth="1.5" />
        <path d="M90 480 L310 480 L320 500 L80 500 Z" strokeWidth="1.2" />
        {/* 台基装饰线 */}
        <line x1="100" y1="490" x2="300" y2="490" strokeWidth="0.6" strokeDasharray="2 2" />
        <line x1="95" y1="495" x2="305" y2="495" strokeWidth="0.6" strokeDasharray="2 2" />

        {/* === 第一层（底层） === */}
        <path d="M100 480 L100 400 L300 400 L300 480" strokeWidth="1.5" />
        {/* 斗拱层 */}
        <path d="M95 400 L95 390 L305 390 L305 400" strokeWidth="1" />
        {/* 屋檐 */}
        <path d="M80 400 Q120 385 160 390 Q200 380 240 390 Q280 385 320 400" strokeWidth="1.2" />
        {/* 飞檐翘角 */}
        <path d="M80 400 Q70 395 60 385" strokeWidth="1" />
        <path d="M320 400 Q330 395 340 385" strokeWidth="1" />

        {/* === 第二层 === */}
        <path d="M105 390 L105 320 L295 320 L295 390" strokeWidth="1.3" />
        <path d="M100 320 L100 312 L300 312 L300 320" strokeWidth="1" />
        <path d="M88 320 Q125 308 163 312 Q200 305 238 312 Q275 308 312 320" strokeWidth="1.1" />

        {/* === 第三层 === */}
        <path d="M110 312 L110 250 L290 250 L290 312" strokeWidth="1.2" />
        <path d="M105 250 L105 242 L295 242 L295 250" strokeWidth="1" />
        <path d="M92 250 Q128 240 165 242 Q200 236 235 242 Q272 240 308 250" strokeWidth="1" />

        {/* === 第四层 === */}
        <path d="M115 242 L115 185 L285 185 L285 242" strokeWidth="1.2" />
        <path d="M110 185 L110 177 L290 177 L290 185" strokeWidth="1" />
        <path d="M98 185 Q132 176 168 177 Q200 172 232 177 Q268 176 302 185" strokeWidth="1" />

        {/* === 第五层 === */}
        <path d="M120 177 L120 125 L280 125 L280 177" strokeWidth="1.1" />
        <path d="M115 125 L115 118 L285 118 L285 125" strokeWidth="1" />
        <path d="M102 125 Q135 117 170 118 Q200 113 230 118 Q265 117 298 125" strokeWidth="0.9" />

        {/* === 第六层 === */}
        <path d="M125 118 L125 75 L275 75 L275 118" strokeWidth="1.1" />
        <path d="M120 75 L120 68 L280 68 L280 75" strokeWidth="1" />
        <path d="M108 75 Q140 68 175 68 Q200 64 225 68 Q260 68 292 75" strokeWidth="0.9" />

        {/* === 第七层 === */}
        <path d="M130 68 L130 35 L270 35 L270 68" strokeWidth="1" />
        <path d="M125 35 L125 28 L275 28 L275 35" strokeWidth="0.9" />
        <path d="M115 35 Q145 28 180 28 Q200 25 220 28 Q255 28 285 35" strokeWidth="0.8" />

        {/* === 第八层 === */}
        <path d="M135 28 L135 8 L265 8 L265 28" strokeWidth="1" />
        <path d="M130 8 L130 2 L270 2 L270 8" strokeWidth="0.9" />

        {/* === 第九层（顶层）=== */}
        {/* 攒尖顶 */}
        <path d="M145 2 L200 -25 L255 2" strokeWidth="1.2" />
        {/* 宝顶 */}
        <circle cx="200" cy="-25" r="6" fill="url(#goldFlow)" strokeWidth="1">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* === 门洞（第一层）=== */}
        <path d="M170 450 L170 410 Q200 400 230 410 L230 450" strokeWidth="1" />

        {/* === 窗户（各层）=== */}
        {/* 第二层窗户 */}
        <rect x="140" y="340" width="20" height="30" rx="2" strokeWidth="0.8" />
        <rect x="180" y="340" width="20" height="30" rx="2" strokeWidth="0.8" />
        <rect x="240" y="340" width="20" height="30" rx="2" strokeWidth="0.8" />

        {/* 第三层窗户 */}
        <rect x="145" y="270" width="18" height="28" rx="2" strokeWidth="0.8" />
        <rect x="191" y="270" width="18" height="28" rx="2" strokeWidth="0.8" />
        <rect x="237" y="270" width="18" height="28" rx="2" strokeWidth="0.8" />

        {/* 第四层窗户 */}
        <rect x="150" y="205" width="16" height="25" rx="2" strokeWidth="0.7" />
        <rect x="192" y="205" width="16" height="25" rx="2" strokeWidth="0.7" />
        <rect x="234" y="205" width="16" height="25" rx="2" strokeWidth="0.7" />

        {/* 第五层窗户 */}
        <rect x="155" y="142" width="14" height="22" rx="2" strokeWidth="0.7" />
        <rect x="193" y="142" width="14" height="22" rx="2" strokeWidth="0.7" />
        <rect x="231" y="142" width="14" height="22" rx="2" strokeWidth="0.7" />

        {/* 第六层窗户 */}
        <rect x="158" y="88" width="12" height="20" rx="2" strokeWidth="0.6" />
        <rect x="195" y="88" width="12" height="20" rx="2" strokeWidth="0.6" />
        <rect x="230" y="88" width="12" height="20" rx="2" strokeWidth="0.6" />

        {/* 第七层窗户 */}
        <rect x="160" y="42" width="10" height="18" rx="2" strokeWidth="0.6" />
        <rect x="198" y="42" width="10" height="18" rx="2" strokeWidth="0.6" />
        <rect x="230" y="42" width="10" height="18" rx="2" strokeWidth="0.6" />

        {/* === 栏杆（每层走廊）=== */}
        <line x1="105" y1="380" x2="295" y2="380" strokeWidth="0.6" strokeDasharray="3 2" />
        <line x1="108" y1="305" x2="292" y2="305" strokeWidth="0.6" strokeDasharray="3 2" />
        <line x1="112" y1="238" x2="288" y2="238" strokeWidth="0.5" strokeDasharray="3 2" />
        <line x1="117" y1="172" x2="283" y2="172" strokeWidth="0.5" strokeDasharray="3 2" />
        <line x1="122" y1="112" x2="278" y2="112" strokeWidth="0.5" strokeDasharray="3 2" />
        <line x1="127" y1="62" x2="273" y2="62" strokeWidth="0.4" strokeDasharray="3 2" />

        {/* === 斗拱装饰 === */}
        {[0, 1, 2, 3, 4, 5, 6].map((level) => {
          const yPos = [388, 310, 242, 174, 114, 65, 25][level];
          const xStart = [95, 100, 105, 110, 115, 120, 125][level];
          const xEnd = [305, 300, 295, 290, 285, 280, 275][level];
          const count = 8 - level;
          const step = (xEnd - xStart) / count;
          return (
            <g key={`dougong-${level}`}>
              {[...Array(count)].map((_, i) => (
                <rect
                  key={i}
                  x={xStart + i * step - 2}
                  y={yPos}
                  width="4"
                  height="6"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          );
        })}

        {/* === 装饰性火焰/祥云纹 === */}
        <path d="M50 450 Q40 430 50 410 Q60 430 50 450" strokeWidth="0.6" />
        <path d="M55 445 Q50 435 55 425 Q60 435 55 445" strokeWidth="0.4" />
        <path d="M350 450 Q360 430 350 410 Q340 430 350 450" strokeWidth="0.6" />
        <path d="M345 445 Q350 435 345 425 Q340 435 345 445" strokeWidth="0.4" />

        {/* 祥云 */}
        <path d="M45 380 Q35 365 45 350 Q55 365 45 380" strokeWidth="0.5" />
        <path d="M355 380 Q365 365 355 350 Q345 365 355 380" strokeWidth="0.5" />

        {/* 底部装饰线 */}
        <path d="M60 530 L80 520 M340 530 L320 520" strokeWidth="0.8" />
      </g>

      {/* === 流动光点 === */}
      {[...Array(6)].map((_, i) => (
        <circle key={i} r="2.5" fill="#F5D76E" filter="url(#innerGlow)" opacity="0.9">
          <animateMotion
            dur={`${4 + i * 0.7}s`}
            repeatCount="indefinite"
            path={
              i % 3 === 0
                ? 'M100 200 Q150 100 200 200 Q250 300 300 200'
                : i % 3 === 1
                  ? 'M120 350 Q200 250 280 350 Q200 400 120 350'
                  : 'M140 100 Q200 50 260 100 Q200 150 140 100'
            }
          />
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur={`${1.5 + i * 0.3}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

// 敦煌花纹装饰
function DunhuangPattern({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={cn('w-full h-full', className)}>
      <defs>
        <linearGradient id="patternGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#F5D76E" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* 八瓣莲花纹 */}
      <g opacity="0.3">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <ellipse
            key={i}
            cx="100"
            cy="100"
            rx="25"
            ry="55"
            fill="none"
            stroke="url(#patternGold)"
            strokeWidth="0.8"
            transform={`rotate(${angle} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="20" fill="none" stroke="url(#patternGold)" strokeWidth="1" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="url(#patternGold)" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="url(#patternGold)" strokeWidth="0.4" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoading: authLoading, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated && mounted) {
      router.push('/');
    }
  }, [isAuthenticated, router, mounted]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center shadow-[0_8px_32px_rgba(212,175,55,0.4)] animate-pulse">
          <span className="text-black font-bold text-xl" style={{ fontFamily: 'serif' }}>
            敦
          </span>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--gold)] animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // useEffect 会处理重定向
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (result.success) {
          router.push('/');
        } else {
          setError(result.error || '登录失败');
        }
      } else {
        if (password.length < 6) {
          setError('密码长度至少6位');
          setLoading(false);
          return;
        }
        const result = await register(email, password, nickname);
        if (result.success) {
          router.push('/');
        } else {
          setError(result.error || '注册失败');
        }
      }
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Sparkles, title: '智能文案生图', desc: '一键将创意转化为精美图像' },
    { icon: Box, title: '3D建模转换', desc: '图片快速转换为高质量3D模型' },
    { icon: Video, title: '视频内容生成', desc: 'AI驱动的视频创作与编辑' },
    { icon: Palette, title: '产品精修优化', desc: '电商产品图片智能精修' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex relative overflow-hidden">
      {/* CSS 动画 */}
      <style jsx global>{`
        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 0.08;
            transform: scale(1);
          }
          50% {
            opacity: 0.15;
            transform: scale(1.05);
          }
        }
      `}</style>

      {/* 左侧展示区域 - 佛窟风格 */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 50%, rgba(212,175,55,0.03) 100%)',
        }}
      >
        {/* 佛光背景 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 80% at 50% 45%, rgba(212,175,55,0.08) 0%, transparent 60%)',
            animation: 'pulseGlow 4s ease-in-out infinite',
          }}
        />

        {/* 佛像轮廓 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <NineStoryPavilion />
        </div>

        {/* 敦煌花纹装饰 - 左上 */}
        <div className="absolute top-12 left-8 w-24 h-24 text-[var(--gold)] opacity-20 rotate-12">
          <DunhuangPattern />
        </div>

        {/* 敦煌花纹装饰 - 右下 */}
        <div className="absolute bottom-12 right-8 w-32 h-32 text-[var(--gold)] opacity-15 -rotate-12">
          <DunhuangPattern />
        </div>

        {/* 角落小花纹 */}
        <div className="absolute top-24 right-24 w-12 h-12 text-[var(--gold)] opacity-10">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="0.5">
            <circle cx="24" cy="24" r="20" />
            <circle cx="24" cy="24" r="12" />
            <circle cx="24" cy="24" r="4" fill="currentColor" />
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <line
                key={angle}
                x1="24"
                y1="24"
                x2={24 + 20 * Math.cos((angle * Math.PI) / 180)}
                y2={24 + 20 * Math.sin((angle * Math.PI) / 180)}
              />
            ))}
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 w-full">
          {/* Logo 区域 — 使用 /logo.png 真实图片 */}
          <div className="flex items-center gap-4 mb-10 animate-fade-in">
            <div
              className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold-hover)] flex items-center justify-center"
              style={{
                boxShadow:
                  '0 8px 40px rgba(212,175,55,0.4), inset 0 2px 10px rgba(255,255,255,0.3)',
              }}
            >
              <Image
                src="/logo.png"
                alt="敦煌金AI设计平台"
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
              {/* 光晕 */}
              <div className="absolute inset-0 rounded-2xl bg-[var(--gold)] blur-xl opacity-30 -z-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-[var(--text-primary)] tracking-wide">
                敦煌金AI设计平台
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1 tracking-widest">
                DUNHUANG GOLD AI DESIGN
              </p>
            </div>
          </div>

          {/* 标题 */}
          <div className="mb-8">
            <h2 className="text-4xl xl:text-5xl font-bold mb-4 animate-slide-up flex flex-wrap items-baseline gap-x-4">
              <span className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] bg-clip-text text-transparent animate-shimmer-text">
                敦煌金
              </span>
              <span className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] bg-clip-text text-transparent animate-shimmer-text">
                中国金
              </span>
              <span className="bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] bg-clip-text text-transparent animate-shimmer-text">
                世界金
              </span>
            </h2>
            <p className="text-[var(--text-secondary)] text-base animate-fade-in">
              探索AI赋能的创意设计新境界
            </p>
          </div>

          {/* 特性列表 */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {features.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl animate-slide-up"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0.02) 100%)',
                  border: '1px solid rgba(212,175,55,0.15)',
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, transparent 100%)',
                    border: '1px solid rgba(212,175,55,0.2)',
                  }}
                >
                  <item.icon className="w-4 h-4 text-[var(--gold)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)] text-sm">{item.title}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 底部注册提示 */}
          <div
            className="p-4 rounded-2xl animate-fade-in"
            style={{
              background:
                'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.03) 100%)',
              border: '1px solid rgba(212,175,55,0.2)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center shadow-[0_4px_20px_rgba(212,175,55,0.3)]">
                <Zap className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-primary)] font-medium">首次注册即赠送</p>
                <p className="text-xl font-bold text-[var(--gold)]">100 算力</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧表单区域 */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-[var(--gold)]/5 to-transparent rounded-full blur-[100px]" />
        </div>

        <div className="w-full max-w-[420px] relative z-10">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center shadow-[0_4px_20px_rgba(212,175,55,0.4)]">
              <span className="text-black font-bold text-lg" style={{ fontFamily: 'serif' }}>
                敦
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">敦煌金AI</h1>
              <p className="text-xs text-[var(--text-muted)]">设计平台</p>
            </div>
          </div>

          {/* 表单卡片 */}
          <div
            className="p-8 rounded-3xl animate-scale-in"
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,175,55,0.05)',
            }}
          >
            {/* 顶部金色装饰 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60 rounded-full" />

            {/* 标题 */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                {mode === 'login' ? '欢迎回来' : '创建账户'}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {mode === 'login' ? '登录以继续使用平台' : '注册即享 100 算力'}
              </p>
            </div>

            {/* 标签切换 */}
            <div
              className="flex p-1 rounded-xl mb-8"
              style={{
                background: 'var(--bg-tertiary)',
              }}
            >
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  mode === 'login'
                    ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black shadow-[0_2px_10px_rgba(212,175,55,0.3)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                登录
              </button>
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  mode === 'register'
                    ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black shadow-[0_2px_10px_rgba(212,175,55,0.3)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                注册
              </button>
            </div>

            {/* 表单 */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 昵称（仅注册） */}
              {mode === 'register' && (
                <div className="animate-slide-up">
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    昵称
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="您的昵称"
                      className="w-full h-12 pl-12 pr-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-muted)] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* 邮箱 */}
              <div
                className="animate-slide-up"
                style={{ animationDelay: mode === 'register' ? '50ms' : '0ms' }}
              >
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  邮箱地址
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入邮箱地址"
                    required
                    className="w-full h-12 pl-12 pr-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-muted)] transition-all"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div
                className="animate-slide-up"
                style={{ animationDelay: mode === 'register' ? '100ms' : '50ms' }}
              >
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? '请输入密码' : '至少6位密码'}
                    required
                    minLength={mode === 'register' ? 6 : undefined}
                    className="w-full h-12 pl-12 pr-12 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-muted)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--gold)] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div
                  className="p-4 rounded-xl animate-scale-in"
                  style={{
                    background: 'var(--error-light)',
                    border: '1px solid rgba(184,84,80,0.3)',
                  }}
                >
                  <p className="text-sm text-[var(--error)]">{error}</p>
                </div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full h-12 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all relative overflow-hidden',
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] text-black hover:shadow-[0_4px_25px_rgba(212,175,55,0.5)] active:scale-[0.98]'
                )}
                style={{
                  boxShadow: '0 4px 15px rgba(212,175,55,0.3)',
                }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? '登录' : '注册'}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* 其他选项 */}
            {mode === 'login' && (
              <div className="mt-6 flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-tertiary)] accent-[var(--gold)]"
                  />
                  记住我
                </label>
                <button className="text-[var(--gold)] hover:text-[var(--gold-bright)] transition-colors">
                  忘记密码？
                </button>
              </div>
            )}

            {/* 服务条款 */}
            <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
              {mode === 'register' ? '注册即表示同意' : '登录即表示同意'}
              <button className="text-[var(--gold)] hover:text-[var(--gold-bright)] mx-1 transition-colors">
                服务条款
              </button>
              和
              <button className="text-[var(--gold)] hover:text-[var(--gold-bright)] mx-1 transition-colors">
                隐私政策
              </button>
            </p>
          </div>

          {/* 底部金色装饰 */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-40 rounded-full" />
        </div>
      </div>
    </div>
  );
}
