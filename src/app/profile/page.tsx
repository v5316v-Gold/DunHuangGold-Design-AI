'use client';

// 标记为动态渲染，避免静态生成时缺少客户端上下文

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Heart,
  Clock,
  ChevronRight,
  LogOut,
  Loader2,
  X,
  Moon,
  Trash2,
  User,
  Bell,
  Shield,
  Info,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import { useAuth, getAuthHeader } from '@/hooks/useAuth';
import { usePower, ADMIN_DEFAULT_POWER } from '@/lib/power';
import RechargeModal from '@/components/profile/RechargeModal';
import HistoryActions from '@/components/profile/HistoryActions';
import {
  ProfileHeader,
  PowerSection,
  QuickActionsSection,
  UsageTrendSection,
} from '@/components/profile/ProfileEnhance';
import { usePageState } from '@/hooks/usePageState';

/* eslint-disable @typescript-eslint/no-explicit-any */


export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = usePageState('profile-active-tab', 'history');
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = usePageState('profile-settings-tab', 'account');
  const { user, isAuthenticated, isLoading: authLoading, logout, updateAvatar } = useAuth();
  const { power: localPower } = usePower();
  const [showRecharge, setShowRecharge] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  // 计算实际算力：优先使用用户数据，确保管理员有足够算力
  const power =
    isAuthenticated && user
      ? user.role === 'admin'
        ? Math.max(user.power, ADMIN_DEFAULT_POWER)
        : user.power
      : localPower;

  // ─── 所有 React Hooks 必须在这里（条件 return 之前）───
  // 用户统计数据（从 API 加载）
  const [userStats, setUserStats] = useState({
    power: power,
    usedToday: 0,
    totalUsed: 0,
    memberDays: 0,
  });

  // 历史记录（从 API 加载）
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<any[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // 设置相关状态
  const [editedNickname, setEditedNickname] = useState(user?.nickname || '');
  const [editedEmail, setEditedEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 头像上传相关
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 用户设置状态
  const [userSettings, setUserSettings] = useState({
    darkMode: false,
    goldCursor: true,
    notifications: true,
    publicProfile: false,
    publicHistory: false,
  });

  // ─── 条件 return（Hooks 必须在 return 之前）───

  // 未登录时重定向到登录页
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // 加载真实数据
  useEffect(() => {
    const fetchUserStats = async () => {
      try {
        const authHeader = getAuthHeader();
        const res = await fetch('/api/stats', {
          credentials: 'include',
          headers: { ...authHeader },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const { user, statistics } = json.data;
            const d = new Date();
            const joinDate = new Date(user.createdAt || user.created_at || Date.now());
            const memberDays = Math.floor(
              (d.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            setUserStats({
              power: user.currentPower ?? power,
              usedToday: statistics?.today?.deduct ?? 0,
              totalUsed: statistics?.month?.deduct ?? 0,
              memberDays,
            });
          }
        }
      } catch (e) {
        console.error('[Profile] 加载统计数据失败', e);
      }
    };

    const fetchHistory = async () => {
      try {
        const authHeader = getAuthHeader();
        const res = await fetch('/api/works?limit=50', {
          credentials: 'include',
          headers: { ...authHeader },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.length > 0) {
            const FEATURE_TO_CATEGORY: Record<string, string> = {
              text2img: '文案生图',
              dialogue: 'AI对话',
              relief: '图转浮雕图',
              image3d: '图转3D模型',
              '2dto3d': '平面转雕塑',
              refine: '产品精修',
              blend: '多图融合',
              oneclick: '一键设计',
              multiview: '生成多视图',
              sketch: '线稿/写实',
              free: '自由创作区',
              text2video: '文生视频',
              img2video: '图生视频',
              removebg: '移除背景',
              upscale: '高清放大',
              watermark: '去除水印',
            };
            const items = json.data.map((item: any, idx: number) => {
              const d = new Date(item.created_at);
              const now = new Date();
              let time = '';
              if (d.toDateString() === now.toDateString()) {
                time = `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
              } else {
                const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                time = diff === 1 ? '昨天' : `${diff}天前`;
              }
              return {
                id: item.id,
                type: FEATURE_TO_CATEGORY[item.type] || item.type || '创作',
                title: item.title || '无标题',
                time,
                imageUrl: item.image_url,
              };
            });
            setHistoryItems(items);
          }
        }
      } catch (e) {
        console.error('[Profile] 加载历史记录失败', e);
      }
    };

    fetchUserStats();
    fetchHistory();
  }, [power]);

  // 加载收藏数据
  useEffect(() => {
    if (activeTab === 'favorites') {
      setLoadingFavorites(true);
      const fetchFavorites = async () => {
        try {
          const authHeader = getAuthHeader();
          const res = await fetch('/api/favorites', {
            credentials: 'include',
            headers: { ...authHeader },
          });
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data?.length > 0) {
              const FEATURE_TO_CATEGORY: Record<string, string> = {
                text2img: '文案生图',
                dialogue: 'AI对话',
                relief: '图转浮雕图',
                image3d: '图转3D模型',
                '2dto3d': '平面转雕塑',
                refine: '产品精修',
                blend: '多图融合',
                oneclick: '一键设计',
                multiview: '生成多视图',
                sketch: '线稿/写实',
                free: '自由创作区',
                text2video: '文生视频',
                img2video: '图生视频',
                removebg: '移除背景',
                upscale: '高清放大',
                watermark: '去除水印',
              };
              const items = json.data.map((fav: any) => {
                const work = fav.work;
                const d = new Date(fav.createdAt);
                const now = new Date();
                let time = '';
                if (d.toDateString() === now.toDateString()) {
                  time = `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                } else {
                  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                  time = diff === 1 ? '昨天' : `${diff}天前`;
                }
                return {
                  id: fav.workId,
                  type: FEATURE_TO_CATEGORY[work?.type] || work?.type || '创作',
                  title: work?.title || '无标题',
                  time,
                  imageUrl: work?.outputImageUrl || work?.outputVideoUrl,
                };
              });
              setFavoriteItems(items);
            } else {
              setFavoriteItems([]);
            }
          }
        } catch (e) {
          console.error('[Profile] 加载收藏失败', e);
        } finally {
          setLoadingFavorites(false);
        }
      };
      fetchFavorites();
    }
  }, [activeTab, getAuthHeader]);

  // 加载用户设置
  useEffect(() => {
    if (showSettings) {
      const fetchSettings = async () => {
        try {
          const authHeader = getAuthHeader();
          const res = await fetch('/api/user/settings', { credentials: 'include', headers: { ...authHeader } });
          if (res.ok) {
            const json = await res.json();
            if (json.success) {
              setUserSettings(json.data);
            }
          }
        } catch (e) {
          console.error('[Profile] 加载设置失败', e);
        }
      };
      fetchSettings();
    }
  }, [showSettings, getAuthHeader]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // 处理头像上传
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const authHeader = getAuthHeader();
      const res = await fetch('/api/user/avatar', {
              credentials: 'include',
              method: 'POST',
        headers: { ...authHeader },
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data?.avatar) {
        setAvatarUrl(data.data.avatar);
        updateAvatar(data.data.avatar);
        setSettingsMsg({ type: 'success', text: '头像上传成功！' });
      } else {
        setSettingsMsg({ type: 'error', text: data.error || '上传失败' });
      }
    } catch (err) {
      console.error('[Profile] 头像上传失败:', err);
      setSettingsMsg({ type: 'error', text: '上传失败，请重试' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--gold)] animate-spin" />
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Header />
      <div className="pt-20 px-6 pb-8">
        <div className="max-w-4xl mx-auto">
          {/* 用户信息卡片 */}
          <ProfileHeader user={user} onSettings={() => setShowSettings(true)} />

          {/* 算力与快捷功能 */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <PowerSection
              power={userStats.power}
              usedToday={userStats.usedToday}
              totalUsed={userStats.totalUsed}
              onRecharge={() => setShowRecharge(true)}
            />
            <QuickActionsSection onNavigate={(path) => router.push(path)} />
          </div>

          {/* 使用趋势 */}
          <div className="mb-4">
            <UsageTrendSection />
          </div>

          {/* 标签切换 */}
          <div className="flex border-b border-[var(--border-color)] mb-4">
            {[
              { key: 'history', label: '历史记录', icon: Clock },
              { key: 'favorites', label: '我的收藏', icon: Heart },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-[var(--gold)] text-[var(--gold)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 内容区域 */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
            {activeTab === 'history' ? (
              historyItems.length > 0 ? (
                <div className="divide-y divide-[var(--border-color)]">
                  {historyItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHistory(item)}
                      className="flex items-center gap-4 p-4 hover:bg-[var(--bg-card)] transition-all cursor-pointer group"
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name || '作品图片'}
                          className="w-12 h-12 rounded-lg object-cover"
                          width={48}
                          height={48}
                          unoptimized
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[var(--bg-card)] flex items-center justify-center">
                          <Clock className="w-5 h-5 text-[var(--text-muted)]" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {item.type} · {item.time}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--gold)] transition-all" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="w-12 h-12 text-[var(--text-dim)] mb-4 opacity-30" />
                  <p className="text-[var(--text-muted)] mb-1">暂无历史记录</p>
                  <p className="text-xs text-[var(--text-dim)]">开始创作你的第一个作品吧</p>
                </div>
              )
            ) : loadingFavorites ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="w-8 h-8 text-[var(--gold)] animate-spin mb-4" />
                <p className="text-sm text-[var(--text-muted)]">加载中...</p>
              </div>
            ) : favoriteItems.length > 0 ? (
              <div className="divide-y divide-[var(--border-color)]">
                {favoriteItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 hover:bg-[var(--bg-card)] transition-all cursor-pointer group"
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-12 h-12 rounded-lg object-cover"
                        width={48}
                        height={48}
                        unoptimized
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[var(--bg-card)] flex items-center justify-center">
                        <Heart className="w-5 h-5 text-[var(--text-muted)] fill-current" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {item.type} · {item.time}
                      </p>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const authHeader = getAuthHeader();
                          await fetch(`/api/favorites?workId=${item.id}`, {
                            credentials: 'include',
                            method: 'DELETE',
                            headers: { ...authHeader },
                          });
                          setFavoriteItems((prev) => prev.filter((f) => f.id !== item.id));
                        } catch (err) {
                          console.error('取消收藏失败', err);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Heart className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Heart className="w-12 h-12 text-[var(--text-dim)] mb-4 opacity-30" />
                <p className="text-[var(--text-muted)] mb-1">暂无收藏</p>
                <p className="text-xs text-[var(--text-dim)]">收藏的作品会在这里显示</p>
              </div>
            )}
          </div>

          {/* 退出登录 */}
          <button
            onClick={handleLogout}
            className="w-full mt-6 py-3 text-sm text-[var(--text-muted)] border border-[var(--border-color)] rounded-lg hover:border-red-500 hover:text-red-500 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </div>

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div
            className="w-full max-w-2xl h-[600px] flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">设置</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-8 h-8 rounded-lg hover:bg-[var(--bg-card)] flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* 左侧菜单 */}
              <div className="w-48 border-r border-[var(--border-color)] p-3 overflow-y-auto flex-shrink-0">
                {[
                  { key: 'account', label: '账号设置', icon: User },
                  { key: 'appearance', label: '外观', icon: Moon },
                  { key: 'notifications', label: '通知', icon: Bell },
                  { key: 'privacy', label: '隐私安全', icon: Shield },
                  { key: 'about', label: '关于', icon: Info },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveSettingsTab(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${
                      activeSettingsTab === item.key
                        ? 'bg-[var(--gold)] text-black font-medium'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 右侧内容 */}
              <div className="flex-1 p-6 overflow-y-auto">
                {activeSettingsTab === 'account' && (
                  <div className="space-y-4">
                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
                      账号设置
                    </h3>
                    {settingsMsg && (
                      <div
                        className={`p-3 rounded-lg text-sm ${settingsMsg.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
                      >
                        {settingsMsg.text}
                      </div>
                    )}
                    <div className="flex items-center gap-4 p-4 bg-[var(--bg-card)] rounded-xl">
                      <div className="w-16 h-16 bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] rounded-full flex items-center justify-center overflow-hidden relative group">
                        {uploadingAvatar ? (
                          <Loader2 className="w-8 h-8 text-black animate-spin" />
                        ) : avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt="头像"
                            className="w-full h-full object-cover"
                            width={64}
                            height={64}
                            unoptimized
                          />
                        ) : user?.avatar ? (
                          <Image
                            src={user.avatar}
                            alt="头像"
                            className="w-full h-full object-cover"
                            width={64}
                            height={64}
                            unoptimized
                          />
                        ) : (
                          <UserIcon className="w-8 h-8 text-black" />
                        )}
                        {/* 悬停遮罩 */}
                        <div
                          className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          <span className="text-white text-xs">更换</span>
                        </div>
                      </div>
                      {/* 隐藏的文件输入 */}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-[var(--text-primary)]">
                          {user?.nickname || '敦煌金用户'}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
                        <button
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="mt-1 text-xs text-[var(--gold)] hover:text-[var(--gold-hover)] disabled:opacity-50"
                        >
                          {uploadingAvatar ? '上传中...' : '更换头像'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">昵称</label>
                      <input
                        type="text"
                        value={editedNickname}
                        onChange={(e) => setEditedNickname(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-[var(--text-muted)] mb-2">邮箱</label>
                      <input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        disabled
                        className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)] cursor-not-allowed"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        setSavingProfile(true);
                        setSettingsMsg(null);
                        try {
                          const authHeader = getAuthHeader();
                          const res = await fetch('/api/user/profile', {
                            credentials: 'include',
                            method: 'PUT',
                            headers: { ...authHeader, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ nickname: editedNickname }),
                          });
                          const json = await res.json();
                          if (json.success) {
                            setSettingsMsg({ type: 'success', text: '保存成功' });
                          } else {
                            setSettingsMsg({ type: 'error', text: json.error || '保存失败' });
                          }
                        } catch (e) {
                          setSettingsMsg({ type: 'error', text: '保存失败' });
                        } finally {
                          setSavingProfile(false);
                        }
                      }}
                      disabled={savingProfile}
                      className="w-full py-2.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {savingProfile ? '保存中...' : '保存修改'}
                    </button>
                    <div className="border-t border-[var(--border-color)] pt-4 mt-4">
                      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                        修改密码
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">
                            旧密码
                          </label>
                          <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">
                            新密码
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-[var(--text-muted)] mb-2">
                            确认新密码
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
                          />
                        </div>
                        <button
                          onClick={async () => {
                            if (newPassword !== confirmPassword) {
                              setSettingsMsg({ type: 'error', text: '两次密码输入不一致' });
                              return;
                            }
                            if (newPassword.length < 6) {
                              setSettingsMsg({ type: 'error', text: '新密码长度至少6位' });
                              return;
                            }
                            setChangingPassword(true);
                            setSettingsMsg(null);
                            try {
                              const authHeader = getAuthHeader();
                              const res = await fetch('/api/user/password', {
                                credentials: 'include',
                                method: 'PUT',
                                headers: { ...authHeader, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ oldPassword, newPassword }),
                              });
                              const json = await res.json();
                              if (json.success) {
                                setSettingsMsg({ type: 'success', text: '密码修改成功' });
                                setOldPassword('');
                                setNewPassword('');
                                setConfirmPassword('');
                              } else {
                                setSettingsMsg({ type: 'error', text: json.error || '修改失败' });
                              }
                            } catch (e) {
                              setSettingsMsg({ type: 'error', text: '修改失败' });
                            } finally {
                              setChangingPassword(false);
                            }
                          }}
                          disabled={
                            changingPassword || !oldPassword || !newPassword || !confirmPassword
                          }
                          className="w-full py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--border-color)] transition-all disabled:opacity-50"
                        >
                          {changingPassword ? '修改中...' : '修改密码'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'appearance' && (
                  <div className="space-y-4">
                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
                      外观设置
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">深色模式</p>
                          <p className="text-sm text-[var(--text-muted)]">开启深色主题</p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !userSettings.darkMode;
                            setUserSettings((prev) => ({ ...prev, darkMode: newValue }));
                            try {
                              const authHeader = getAuthHeader();
                              await fetch('/api/user/settings', {
                                credentials: 'include',
                                method: 'PUT',
                                headers: { ...authHeader, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ darkMode: newValue }),
                              });
                            } catch (e) {}
                          }}
                          className={`w-16 h-8 rounded-full relative border transition-all ${
                            userSettings.darkMode
                              ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-black rounded-full shadow-md transition-all ${
                              userSettings.darkMode ? 'right-1.5' : 'left-1.5'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">金色主题光标</p>
                          <p className="text-sm text-[var(--text-muted)]">使用金色自定义鼠标光标</p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !userSettings.goldCursor;
                            setUserSettings((prev) => ({ ...prev, goldCursor: newValue }));
                            try {
                              const authHeader = getAuthHeader();
                              await fetch('/api/user/settings', {
                                credentials: 'include',
                                method: 'PUT',
                                headers: { ...authHeader, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ goldCursor: newValue }),
                              });
                            } catch (e) {}
                          }}
                          className={`w-16 h-8 rounded-full relative border transition-all ${
                            userSettings.goldCursor
                              ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-black rounded-full shadow-md transition-all ${
                              userSettings.goldCursor ? 'right-1.5' : 'left-1.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'notifications' && (
                  <div className="space-y-4">
                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
                      通知设置
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">生成完成通知</p>
                          <p className="text-sm text-[var(--text-muted)]">
                            图片/视频生成完成时通知
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !userSettings.notifications;
                            setUserSettings((prev) => ({ ...prev, notifications: newValue }));
                            try {
                              const authHeader = getAuthHeader();
                              await fetch('/api/user/settings', {
                                credentials: 'include',
                                method: 'PUT',
                                headers: { ...authHeader, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ notifications: newValue }),
                              });
                            } catch (e) {}
                          }}
                          className={`w-16 h-8 rounded-full relative border transition-all ${
                            userSettings.notifications
                              ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-black rounded-full shadow-md transition-all ${
                              userSettings.notifications ? 'right-1.5' : 'left-1.5'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'privacy' && (
                  <div className="space-y-4">
                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">
                      隐私与安全
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">公开作品集</p>
                          <p className="text-sm text-[var(--text-muted)]">允许他人查看你的作品</p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !userSettings.publicProfile;
                            setUserSettings((prev) => ({ ...prev, publicProfile: newValue }));
                            try {
                              const authHeader = getAuthHeader();
                              await fetch('/api/user/settings', {
                                credentials: 'include',
                                method: 'PUT',
                                headers: { ...authHeader, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ publicProfile: newValue }),
                              });
                            } catch (e) {}
                          }}
                          className={`w-16 h-8 rounded-full relative border transition-all ${
                            userSettings.publicProfile
                              ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-black rounded-full shadow-md transition-all ${
                              userSettings.publicProfile ? 'right-1.5' : 'left-1.5'
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-xl">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">公开历史记录</p>
                          <p className="text-sm text-[var(--text-muted)]">允许他人查看使用历史</p>
                        </div>
                        <button
                          onClick={async () => {
                            const newValue = !userSettings.publicHistory;
                            setUserSettings((prev) => ({ ...prev, publicHistory: newValue }));
                            try {
                              const authHeader = getAuthHeader();
                              await fetch('/api/user/settings', {
                                credentials: 'include',
                                method: 'PUT',
                                headers: { ...authHeader, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ publicHistory: newValue }),
                              });
                            } catch (e) {}
                          }}
                          className={`w-16 h-8 rounded-full relative border transition-all ${
                            userSettings.publicHistory
                              ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                              : 'bg-[var(--bg-tertiary)] border-[var(--border-color)]'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-black rounded-full shadow-md transition-all ${
                              userSettings.publicHistory ? 'right-1.5' : 'left-1.5'
                            }`}
                          />
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('确定要删除账号吗？此操作不可恢复。')) {
                            if (prompt('请输入"DELETE"确认删除账号：') === 'DELETE') {
                              alert('账号删除功能开发中');
                            }
                          }
                        }}
                        className="w-full py-3 text-left px-4 bg-[var(--bg-card)] rounded-xl text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                      >
                        <Trash2 className="w-5 h-5" />
                        删除账号
                      </button>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'about' && (
                  <div className="space-y-4">
                    <h3 className="text-base font-medium text-[var(--text-primary)] mb-4">关于</h3>
                    <div className="p-6 bg-[var(--bg-card)] rounded-xl text-center">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] rounded-2xl flex items-center justify-center mb-4">
                        <span className="text-2xl font-bold text-black">敦</span>
                      </div>
                      <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                        敦煌金AI设计平台
                      </h4>
                      <p className="text-sm text-[var(--text-muted)] mb-4">版本 1.0.0</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        探索AI与传统艺术的完美融合，每一幅作品都承载着千年敦煌的文化底蕴。
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button className="w-full py-2.5 px-4 bg-[var(--bg-card)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border-color)] transition-colors text-left">
                        服务条款
                      </button>
                      <button className="w-full py-2.5 px-4 bg-[var(--bg-card)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border-color)] transition-colors text-left">
                        隐私政策
                      </button>
                      <button className="w-full py-2.5 px-4 bg-[var(--bg-card)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--border-color)] transition-colors text-left">
                        用户协议
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 充值弹窗 */}
      <RechargeModal
        open={showRecharge}
        onClose={() => setShowRecharge(false)}
        onSuccess={(amount) => {
          setUserStats((prev) => ({ ...prev, power: prev.power + amount }));
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* 历史操作弹窗 */}
      <HistoryActions
        item={selectedHistory}
        onClose={() => setSelectedHistory(null)}
        onDelete={async (id) => {
          try {
            const authHeader = getAuthHeader();
            const res = await fetch(`/api/works/${id}`, { credentials: 'include',
              method: 'DELETE',
              headers: { ...authHeader },
            });
            if (res.ok) {
              setHistoryItems((prev) => prev.filter((item) => item.id !== id));
            }
          } catch (e) {
            console.error('[Profile] 删除失败', e);
          }
        }}
        onDownload={(item) => {
          if (item.imageUrl) {
            window.open(item.imageUrl, '_blank');
          }
        }}
      />
    </div>
  );
}
