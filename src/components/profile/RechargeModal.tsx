'use client';

import { useState } from 'react';
import { X, Coins, Loader2, CheckCircle, Sparkles, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RechargeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

const PRESET_AMOUNTS = [
  { value: 50, label: '50', bonus: 0, desc: '体验尝鲜' },
  { value: 100, label: '100', bonus: 5, desc: '基础创作', popular: false },
  { value: 200, label: '200', bonus: 15, desc: '进阶创作', popular: true },
  { value: 500, label: '500', bonus: 50, desc: '专业用户', popular: false },
  { value: 1000, label: '1000', bonus: 150, desc: '资深创作者', popular: false },
  { value: 2000, label: '2000', bonus: 400, desc: '企业级用户', popular: false },
];

const PAYMENT_METHODS = [
  { id: 'alipay', label: '支付宝', icon: '💙' },
  { id: 'wechat', label: '微信支付', icon: '🟢' },
];

type Step = 'select' | 'payment' | 'success';

export default function RechargeModal({ open, onClose, onSuccess }: RechargeModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [selectedPayment, setSelectedPayment] = useState('alipay');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const getSelectedPreset = () => PRESET_AMOUNTS.find(p => p.value === selectedAmount);

  const handlePay = async () => {
    setLoading(true);
    setStep('payment');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    setStep('success');
  };

  const handleClose = () => {
    setStep('select');
    setSelectedAmount(100);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
      <div
        className="w-full max-w-lg bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 - 渐变装饰 */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-[var(--bg-card)] via-[var(--bg-secondary)] to-[var(--bg-card)] border-b border-[var(--border-color)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-hover)] flex items-center justify-center shadow-lg shadow-[var(--gold)]/20">
                <Coins className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {step === 'select' && '充值算力'}
                  {step === 'payment' && '确认支付'}
                  {step === 'success' && '充值成功'}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">安全支付 · 实时到账</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-card)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {step === 'select' && (
            <>
              {/* 算力单位说明 */}
              <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                <div className="w-6 h-6 rounded-md bg-[var(--gold)]/10 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-[var(--gold)]" />
                </div>
                <span className="text-xs text-[var(--text-muted)]">1 算力 = 1 次基础图片生成</span>
                <div className="ml-auto flex items-center gap-1 text-[var(--success)]">
                  <Shield className="w-3 h-3" />
                  <span className="text-xs">账户安全</span>
                </div>
              </div>

              {/* 金额选择 - 紧凑网格 */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {PRESET_AMOUNTS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setSelectedAmount(item.value)}
                    className={cn(
                      'relative p-3 rounded-xl border transition-all duration-200',
                      selectedAmount === item.value
                        ? 'border-[var(--gold)] bg-gradient-to-b from-[var(--gold)]/15 to-[var(--gold)]/5 shadow-[0_0_12px_rgba(200,164,92,0.2)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--gold)]/40 hover:bg-[var(--bg-card)]/80'
                    )}
                  >
                    {/* 推荐标签 */}
                    {item.popular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black text-[10px] font-bold rounded-full shadow-sm">
                        推荐
                      </div>
                    )}
                    
                    <div className="text-lg font-bold text-[var(--text-primary)] leading-tight">{item.label}</div>
                    <div className="text-[10px] text-[var(--text-dim)] mb-1">{item.desc}</div>
                    
                    {item.bonus > 0 ? (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[var(--gold)]" />
                        <span className="text-[10px] text-[var(--gold)] font-medium">+{item.bonus}</span>
                      </div>
                    ) : (
                      <div className="h-3" />
                    )}
                  </button>
                ))}
              </div>

              {/* 充值详情卡 */}
              <div className="bg-[var(--bg-card)] rounded-xl p-4 mb-5 border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-[var(--text-secondary)]">充值详情</span>
                  {getSelectedPreset()?.bonus ? (
                    <span className="text-xs px-2 py-0.5 bg-[var(--gold)]/10 text-[var(--gold)] rounded-full">限时赠送</span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-[var(--gold)]" />
                      <span className="text-sm text-[var(--text-primary)]">充值算力</span>
                    </div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{selectedAmount}</span>
                  </div>
                  {getSelectedPreset()?.bonus ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-[var(--success)]" />
                        <span className="text-sm text-[var(--text-primary)]">赠送算力</span>
                      </div>
                      <span className="text-sm font-semibold text-[var(--success)]">+{getSelectedPreset()?.bonus}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-[var(--border-color)] pt-2 mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-secondary)]">总计获得</span>
                    <span className="text-lg font-bold text-[var(--gold)]">{selectedAmount + (getSelectedPreset()?.bonus || 0)} 算力</span>
                  </div>
                </div>
              </div>

              {/* 支付方式 */}
              <div className="mb-5">
                <p className="text-xs font-medium text-[var(--text-dim)] mb-2 uppercase tracking-wider">支付方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedPayment(method.id)}
                      className={cn(
                        'flex items-center gap-2.5 p-3 rounded-xl border transition-all',
                        selectedPayment === method.id
                          ? 'border-[var(--gold)] bg-[var(--gold)]/10'
                          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--gold)]/40'
                      )}
                    >
                      <span className="text-xl">{method.icon}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{method.label}</span>
                      {selectedPayment === method.id && (
                        <CheckCircle className="w-4 h-4 text-[var(--gold)] ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 支付按钮 */}
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-[var(--gold-dark)] via-[var(--gold)] to-[var(--gold-hover)] text-black font-bold rounded-xl hover:shadow-xl hover:shadow-[var(--gold)]/30 transition-all flex items-center justify-center gap-2 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                ) : (
                  <>
                    <span className="relative z-10">立即支付</span>
                    <span className="relative z-10 text-black/60">·</span>
                    <span className="relative z-10 font-bold">¥{selectedAmount}</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'payment' && (
            <div className="flex flex-col items-center py-10">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-[var(--gold)]/20 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-[var(--gold)] animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-[var(--gold)]/10 animate-ping" />
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">正在唤起支付</p>
              <p className="text-sm text-[var(--text-muted)] text-center">请在{selectedPayment === 'alipay' ? '支付宝' : '微信'}中完成付款</p>
              <p className="text-xs text-[var(--text-dim)] mt-2">支付完成后页面将自动更新</p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center py-10">
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-[var(--success)]" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)] mb-2">充值成功！</p>
              <p className="text-sm text-[var(--text-muted)] mb-1">感谢您的支持</p>
              <div className="mt-4 px-4 py-2 bg-[var(--gold)]/10 rounded-lg border border-[var(--gold)]/20">
                <span className="text-sm text-[var(--text-secondary)]">本次获得 </span>
                <span className="text-lg font-bold text-[var(--gold)]">{selectedAmount + (getSelectedPreset()?.bonus || 0)}</span>
                <span className="text-sm text-[var(--text-secondary)]"> 算力</span>
              </div>
              <button
                onClick={() => {
                  onSuccess?.(selectedAmount + (getSelectedPreset()?.bonus || 0));
                  handleClose();
                }}
                className="mt-6 w-full h-12 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] text-black font-bold rounded-xl hover:shadow-lg hover:shadow-[var(--gold)]/20 transition-all"
              >
                完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 修复缺失的 Gift 组件
function Gift({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 5a4.8 4.8 0 0 1 4.5-2 2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}
