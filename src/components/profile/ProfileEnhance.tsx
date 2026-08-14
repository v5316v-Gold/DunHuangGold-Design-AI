'use client';

import { User as UserIcon, Coins, Settings, Zap, Crown, Users, HelpCircle, Download, Star, Gift, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */


// ============== 用户信息卡片 ==============
export function ProfileHeader({ user, onSettings }: { user: any; onSettings: () => void }) {
  return (
    <div className="relative bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[var(--gold)]/8 to-transparent rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-[var(--gold)]/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
      
      <div className="relative flex items-center gap-4">
        {/* 头像 */}
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] rounded-2xl flex items-center justify-center shadow-lg shadow-[var(--gold)]/20">
            {user?.avatar ? (
              <Image src={user.avatar} alt={user.nickname || "用户头像"} className="w-full h-full rounded-2xl object-cover" width={64} height={64} unoptimized />
            ) : (
              <UserIcon className="w-8 h-8 text-black" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[var(--bg-secondary)]" />
        </div>
        
        {/* 用户信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              {user?.nickname || '敦煌金用户'}
            </h1>
            {user?.role === 'admin' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black rounded-full">
                <Zap className="w-3 h-3" />
                管理员
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-full">
              <Star className="w-3 h-3" />
              VIP
            </span>
          </div>
          <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
          <p className="text-xs text-[var(--text-dim)] mt-1">加入于 {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '未知'}</p>
        </div>
        
        {/* 设置按钮 */}
        <button 
          onClick={onSettings}
          className="w-11 h-11 bg-[var(--bg-card)] rounded-xl flex items-center justify-center border border-[var(--border-color)] hover:border-[var(--gold)] hover:shadow-lg hover:shadow-[var(--gold)]/10 transition-all group"
        >
          <Settings className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--gold)] transition-colors" />
        </button>
      </div>
    </div>
  );
}

// ============== 算力中心 ==============
export function PowerSection({ power, usedToday, totalUsed, onRecharge }: { 
  power: number; 
  usedToday: number;
  totalUsed: number;
  onRecharge: () => void;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 h-full">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-[var(--gold)]/10 rounded-lg flex items-center justify-center">
          <Coins className="w-4 h-4 text-[var(--gold)]" />
        </div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">我的算力</h2>
      </div>
      
      {/* 算力数值 - 居中大字 */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Coins className="w-6 h-6 text-[var(--gold)]" />
          <span className="text-4xl font-bold text-[var(--gold)] font-mono">{power.toLocaleString()}</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">剩余算力</p>
      </div>
      
      {/* 充值按钮 - 全宽居中 */}
      <div className="flex justify-center mb-4">
        <button
          onClick={onRecharge}
          className="px-8 py-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[var(--gold)]/20 transition-all"
        >
          充值
        </button>
      </div>
      
      {/* 统计数据网格 - 3列 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--bg-card)] rounded-lg p-3 text-center">
          <TrendingUp className="w-4 h-4 text-orange-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{usedToday}</p>
          <p className="text-[10px] text-[var(--text-dim)]">今日消耗</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-lg p-3 text-center">
          <Wallet className="w-4 h-4 text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{totalUsed}</p>
          <p className="text-[10px] text-[var(--text-dim)]">累计消耗</p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-lg p-3 text-center">
          <Sparkles className="w-4 h-4 text-[var(--gold)] mx-auto mb-1" />
          <p className="text-lg font-bold text-[var(--text-primary)]">{usedToday > 0 ? Math.ceil(totalUsed / usedToday) : 0}</p>
          <p className="text-[10px] text-[var(--text-dim)]">可用次数</p>
        </div>
      </div>
    </div>
  );
}

// ============== 快捷功能 ==============
export function QuickActionsSection({ onNavigate }: {
  onNavigate: (path: string) => void;
}) {
  const actions = [
    { icon: <Crown className="w-5 h-5" />, label: '会员中心', desc: '解锁权益', color: 'text-[var(--gold)]', bg: 'bg-[var(--gold)]/10' },
    { icon: <Users className="w-5 h-5" />, label: '邀请好友', desc: '奖励算力', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: <Download className="w-5 h-5" />, label: '批量导出', desc: '导出作品', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: <HelpCircle className="w-5 h-5" />, label: '帮助中心', desc: '使用指南', color: 'text-green-500', bg: 'bg-green-500/10' },
  ];
  
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 h-full">
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">快捷功能</h2>
      
      {/* 2x2 网格布局 */}
      <div className="grid grid-cols-2 gap-3">
        {actions.map((item, index) => (
          <button
            key={index}
            onClick={() => {}}
            className="flex flex-col items-center p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] hover:border-[var(--gold)]/30 hover:bg-[var(--bg-card)]/80 transition-all group"
          >
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-2', item.bg)}>
              <span className={item.color}>{item.icon}</span>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] mb-0.5">{item.label}</p>
            <p className="text-[10px] text-[var(--text-dim)]">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============== 使用趋势 ==============
export function UsageTrendSection() {
  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const usageData = [12, 8, 15, 6, 20, 10, 5];
  const maxUsage = Math.max(...usageData);
  const totalUsage = usageData.reduce((a, b) => a + b, 0);
  
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">本周使用趋势</h2>
        <span className="text-xs text-[var(--text-muted)]">共 {totalUsage} 次生成</span>
      </div>
      
      {/* 柱状图 */}
      <div className="flex items-end justify-between gap-2 h-24 mb-4">
        {weekDays.map((day, i) => {
          const height = (usageData[i] / maxUsage) * 100;
          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div 
                className="w-full bg-gradient-to-t from-[var(--gold)]/30 to-[var(--gold)] rounded-t-sm transition-all hover:from-[var(--gold)]/50 hover:to-[var(--gold)]"
                style={{ height: `${Math.max(height, 4)}%` }}
              />
              <span className="text-[10px] text-[var(--text-dim)]">{day.slice(1)}</span>
            </div>
          );
        })}
      </div>
      
      {/* 图例 */}
      <div className="flex items-center justify-center gap-6 pt-3 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-[var(--gold)]" />
          <span className="text-xs text-[var(--text-muted)]">日均 {Math.round(totalUsage / 7)} 次</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--gold)]/50" />
          <span className="text-xs text-[var(--text-muted)]">峰值 {maxUsage} 次</span>
        </div>
      </div>
    </div>
  );
}

// ============== 邀请板块 (保留但不用) ==============
export function InviteSection() {
  return (
    <div className="relative bg-gradient-to-r from-[var(--gold)]/10 via-[var(--bg-secondary)] to-[var(--gold)]/10 rounded-2xl border border-[var(--gold)]/20 p-5 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--gold)]/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-[var(--gold)]/20 rounded-xl flex items-center justify-center">
          <Gift className="w-5 h-5 text-[var(--gold)]" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">邀请好友 得算力</h2>
          <p className="text-xs text-[var(--text-muted)]">每邀请1位好友，双方各得50算力</p>
        </div>
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
          <span className="text-xs text-[var(--text-dim)]">我的邀请码</span>
          <p className="text-sm font-mono text-[var(--text-primary)]">DHG-2024-ABCD</p>
        </div>
        <button className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[var(--gold)]/20 transition-all">
          复制邀请
        </button>
      </div>
    </div>
  );
}
