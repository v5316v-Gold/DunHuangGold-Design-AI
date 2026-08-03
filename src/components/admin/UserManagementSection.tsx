'use client';
import { toast } from 'sonner';

import { useState, useEffect } from 'react';
import { Users, RefreshCw, Plus, Minus, X, Check, DollarSign, CheckCircle, Clock, XCircle } from 'lucide-react';

interface UserItem {
  id: string;
  email: string;
  nickname?: string;
  power: number;
  role: string;
  status: string;
  createdAt: string;
}

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeModal, setRechargeModal] = useState<{ open: boolean; user: UserItem | null }>({ open: false, user: null });
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [rechargeReason, setRechargeReason] = useState('');
  const [recharging, setRecharging] = useState(false);

  const presetAmounts = [50, 100, 200, 500, 1000, 2000, 5000];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    const timer = setTimeout(() => { fetchUsers(); }, 0);
    return () => clearTimeout(timer);
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const openRechargeModal = (user: UserItem) => {
    setRechargeAmount(100);
    setRechargeReason('');
    setRechargeModal({ open: true, user });
  };

  const closeRechargeModal = () => {
    setRechargeModal({ open: false, user: null });
    setRechargeAmount(100);
    setRechargeReason('');
  };

  const handleRecharge = async () => {
    if (!rechargeModal.user || rechargeAmount <= 0) return;

    setRecharging(true);
    try {
      const res = await fetch(`/api/admin/users/${rechargeModal.user.id}/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: rechargeAmount,
          reason: rechargeReason || '管理员充值',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => 
          u.id === rechargeModal.user?.id 
            ? { ...u, power: data.data.newBalance }
            : u
        ));
        closeRechargeModal();
        toast('充值成功！新余额: ${data.data.newBalance}');
      } else {
        toast.error(data.error || '充值失败');
      }
    } catch (error) {
      console.error('充值失败:', error);
      toast.error('充值失败，请重试');
    } finally {
      setRecharging(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-500"><CheckCircle className="w-3 h-3" />正常</span>;
      case 'inactive':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-500"><Clock className="w-3 h-3" />未活跃</span>;
      case 'banned':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-500"><XCircle className="w-3 h-3" />已封禁</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-500/20 text-gray-500">{status}</span>;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">用户管理</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button className="px-4 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:shadow-lg transition-all">导出数据</button>
        </div>
      </div>
      
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full table-enhanced">
          <thead>
            <tr>
              {['用户', '邮箱', '剩余算力', '注册时间', '状态', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无用户数据</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-[var(--bg-card)] transition-all">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--gold)]/20 flex items-center justify-center text-[var(--gold)] text-sm font-medium">
                        {(user.nickname || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">{user.nickname || '未设置'}</p>
                        <p className="text-xs text-[var(--text-muted)]">{user.role === 'vip' ? 'VIP用户' : user.role === 'admin' ? '管理员' : '普通用户'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-[var(--gold)]">{user.power.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{user.createdAt}</td>
                  <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => openRechargeModal(user)}
                        className="px-3 py-1 bg-[var(--gold)]/20 text-[var(--gold)] rounded text-xs hover:bg-[var(--gold)] hover:text-black transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        充值
                      </button>
                      <button className="px-3 py-1 bg-[var(--bg-card)] rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all">编辑</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 充值弹窗 */}
      {rechargeModal.open && rechargeModal.user && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-[var(--gold)]" />
                </div>
                <div>
                  <h3 className="font-medium text-[var(--text-primary)]">算力充值</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    为 {rechargeModal.user.nickname || rechargeModal.user.email} 充值
                  </p>
                </div>
              </div>
              <button onClick={closeRechargeModal} className="p-1 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-[var(--bg-card)] rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">当前余额</span>
                <span className="text-lg font-bold text-[var(--gold)]">{rechargeModal.user.power.toLocaleString()}</span>
              </div>

              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">快速选择</label>
                <div className="grid grid-cols-4 gap-2">
                  {presetAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setRechargeAmount(amount)}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        rechargeAmount === amount
                          ? 'bg-[var(--bg-card)] text-[var(--gold)] border border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]'
                      }`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">自定义金额</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRechargeAmount(Math.max(1, rechargeAmount - 100))}
                    className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="flex-1 px-4 py-2 bg-[var(--bg-card)] rounded-lg text-center text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                    min={1}
                  />
                  <button
                    onClick={() => setRechargeAmount(rechargeAmount + 100)}
                    className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--gold)]/20 hover:text-[var(--gold)]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">充值备注（可选）</label>
                <input
                  type="text"
                  value={rechargeReason}
                  onChange={(e) => setRechargeReason(e.target.value)}
                  placeholder="如：活动赠送、补偿等"
                  className="w-full px-4 py-2 bg-[var(--bg-card)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>

              <div className="bg-[var(--gold)]/10 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-[var(--gold)]">充值后余额</span>
                <span className="text-lg font-bold text-[var(--gold)]">
                  {(rechargeModal.user.power + rechargeAmount).toLocaleString()}
                  <span className="text-xs font-normal ml-1">(+{rechargeAmount.toLocaleString()})</span>
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border-color)] flex gap-3">
              <button
                onClick={closeRechargeModal}
                className="flex-1 py-2 bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleRecharge}
                disabled={recharging || rechargeAmount <= 0}
                className="flex-1 py-2 bg-[var(--gold)] text-black rounded-lg text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {recharging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    充值中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    确认充值
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
