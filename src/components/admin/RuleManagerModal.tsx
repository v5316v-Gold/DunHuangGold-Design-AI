'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, Plus, Save, Edit, Trash2, Loader2, Search } from 'lucide-react';

interface Rule {
  id: string;
  category: string;
  name: string;
  systemPrompt: string;
  enabled: boolean;
  sortOrder: number;
}

const RULE_CATEGORIES = [
  { key: 'optimize', label: '提示词优化规则', addLabel: '添加提示词优化规则' },
  { key: 'translate', label: '翻译规则', addLabel: '添加翻译规则' },
  { key: 'caption-zh', label: '中文反推', addLabel: '添加中文反推规则' },
  { key: 'caption-en', label: '英文反推', addLabel: '添加英文反推规则' },
  { key: 'caption-video', label: '视频反推', addLabel: '添加视频反推规则' },
];

// Toggle组件
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return enabled ? (
    <button onClick={() => onChange(false)} className="w-11 h-6 bg-[var(--gold)] rounded-full flex items-center justify-end px-0.5">
      <div className="w-4 h-4 bg-white rounded-full" />
    </button>
  ) : (
    <button onClick={() => onChange(true)} className="w-11 h-6 bg-[var(--bg-tertiary)] rounded-full flex items-center px-0.5">
      <div className="w-4 h-4 bg-[var(--text-muted)] rounded-full" />
    </button>
  );
}

interface RuleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RuleManagerModal({ isOpen, onClose }: RuleManagerModalProps) {
  const [activeCategory, setActiveCategory] = useState('optimize');
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 添加弹窗状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState('optimize');
  const [addCategory, setAddCategory] = useState('');
  const [addShowOnAssistant, setAddShowOnAssistant] = useState(false);
  const [addContent, setAddContent] = useState('');

  // 编辑弹窗状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('optimize');
  const [editCategory, setEditCategory] = useState('');
  const [editShowOnAssistant, setEditShowOnAssistant] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/immutability
      const timer = setTimeout(() => { loadRules(); }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 保存按钮（规则已自动保存，这里只显示保存动效）
  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setSaving(false);
    toast.success('保存成功！');
  };

  const loadRules = async () => {
    setLoading(true);
    try {
      const token0 = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;
      const res = await fetch('/api/admin/rules', {
        headers: { ...(token0 ? { Authorization: `Bearer ${token0}` } : {}) },
      });
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('加载规则失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (rule: Rule) => {
    try {
      const token4 = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;
      await fetch('/api/admin/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token4 ? { Authorization: `Bearer ${token4}` } : {}),
        },
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      });
      loadRules();
    } catch (error) {
      console.error('切换规则状态失败:', error);
    }
  };

  // 添加规则
  const handleAdd = () => {
    setAddName('');
    setAddType(activeCategory);
    setAddCategory('');
    setAddShowOnAssistant(false);
    setAddContent('');
    setShowAddModal(true);
  };

  const handleAddSubmit = async () => {
    if (!addName.trim() || !addContent.trim()) {
      toast.error('请填写规则名称和规则内容');
      return;
    }

    setSaving(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
          category: addType,
          name: addName,
          systemPrompt: addContent,
          enabled: true,
          showOnAssistant: addShowOnAssistant,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error('添加失败：' + (data.error || '未知错误'));
        setSaving(false);
        return;
      }
      setShowAddModal(false);
      loadRules();
    } catch (error) {
      console.error('添加规则失败:', error);
      toast.error('添加失败');
    } finally {
      setSaving(false);
    }
  };

  // 编辑规则
  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditType(rule.category);
    setEditCategory('');
    setEditShowOnAssistant(false);
    setEditContent(rule.systemPrompt);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    if (!editName.trim() || !editContent.trim()) {
      toast.error('请填写规则名称和规则内容');
      return;
    }

    setSaving(true);
    try {
      const token2 = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;
      const res2 = await fetch('/api/admin/rules', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token2 ? { Authorization: `Bearer ${token2}` } : {}),
        },
        body: JSON.stringify({
          id: editingRule?.id,
          name: editName,
          category: editType,
          systemPrompt: editContent,
          showOnAssistant: editShowOnAssistant,
        }),
      });
      const data2 = await res2.json();
      if (!data2.success) {
        toast.error('保存失败：' + (data2.error || '未知错误'));
        setSaving(false);
        return;
      }
      setShowEditModal(false);
      loadRules();
    } catch (error) {
      console.error('保存规则失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除规则
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个规则吗？')) return;

    try {
      const token3 = typeof window !== 'undefined' ? localStorage.getItem('dunhuang_token') : null;
      const res3 = await fetch(`/api/admin/rules?id=${id}`, {
        method: 'DELETE',
        headers: { ...(token3 ? { Authorization: `Bearer ${token3}` } : {}) },
      });
      const data3 = await res3.json();
      if (!data3.success) {
        toast.error('删除失败：' + (data3.error || '未知错误'));
        return;
      }
      loadRules();
    } catch (error) {
      console.error('删除规则失败:', error);
      toast.error('删除失败');
    }
  };

  const filteredRules = rules.filter(r => {
    const matchesCategory = r.category === activeCategory;
    const matchesSearch = searchQuery.trim() === '' ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.systemPrompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const currentTab = RULE_CATEGORIES.find(c => c.key === activeCategory);
  const canAdd = currentTab?.addLabel !== null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] w-[900px] h-[700px] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">规则管理器</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-card)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Tab切换 + 搜索 + 添加按钮 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-4">
            <div className="flex">
              {RULE_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => { setActiveCategory(cat.key); setSearchQuery(''); }}
                  className={`px-4 py-2 text-sm font-medium transition-all ${
                    activeCategory === cat.key
                      ? 'text-[var(--gold)] border-b-2 border-[var(--gold)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索规则名称或内容..."
                className="pl-8 pr-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--gold)] focus:outline-none w-48"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {canAdd && (
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {currentTab?.addLabel}
            </button>
          )}
        </div>

        {/* 翻译规则提示 */}
        {activeCategory === 'translate' && (
          <div className="px-6 py-2 bg-[var(--bg-card)]/50 text-xs text-[var(--text-muted)]">
            💡 翻译规则用于配置翻译引擎的行为
          </div>
        )}

        {/* 规则列表 */}
        <div className="h-[calc(100%-140px)] overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-[var(--text-muted)]">加载中...</div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              {searchQuery ? '未找到匹配「' + searchQuery + '」的规则' : '暂无规则'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <th className="pb-2 w-20">状态</th>
                  <th className="pb-2 w-40">规则名称</th>
                  <th className="pb-2">规则内容</th>
                  <th className="pb-2 w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map(rule => (
                  <tr key={rule.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-card)]/50">
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule)}
                        className="w-4 h-4 accent-[var(--gold)]"
                      />
                    </td>
                    <td className="py-3 text-sm text-[var(--text-primary)]">{rule.name}</td>
                    <td className="py-3 text-sm text-[var(--text-secondary)] truncate max-w-md" title={rule.systemPrompt}>
                      {rule.systemPrompt.substring(0, 60)}...
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="p-1.5 hover:bg-[var(--bg-card)] rounded-lg transition-all"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            关闭
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 添加规则弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] w-[600px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">添加规则</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-[var(--bg-card)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">规则名称</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                  placeholder="输入规则名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">规则类型</label>
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                >
                  {RULE_CATEGORIES.filter(c => c.addLabel !== null).map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">分类</label>
                <input
                  type="text"
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                  placeholder="输入或选择分类（可留空）"
                  list="category-suggestions"
                />
                <datalist id="category-suggestions">
                  <option value="通用" />
                  <option value="人像" />
                  <option value="风景" />
                  <option value="产品" />
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">规则内容</label>
                <textarea
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none resize-none"
                  placeholder="输入规则内容"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[var(--text-primary)]">小助手上显示</span>
                <Toggle enabled={addShowOnAssistant} onChange={setAddShowOnAssistant} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleAddSubmit}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-all flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑规则弹窗 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] w-[600px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">编辑规则</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-[var(--bg-card)] rounded-lg">
                <X className="w-5 h-5 text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">规则名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                  placeholder="输入规则名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">规则类型</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                >
                  {RULE_CATEGORIES.filter(c => c.addLabel !== null).map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">分类</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none"
                  placeholder="输入或选择分类（可留空）"
                  list="edit-category-suggestions"
                />
                <datalist id="edit-category-suggestions">
                  <option value="通用" />
                  <option value="人像" />
                  <option value="风景" />
                  <option value="产品" />
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">规则内容</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:border-[var(--gold)] focus:outline-none resize-none"
                  placeholder="输入规则内容"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[var(--text-primary)]">小助手上显示</span>
                <Toggle enabled={editShowOnAssistant} onChange={setEditShowOnAssistant} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-color)]">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              >
                取消
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={saving}
                className="px-4 py-2 bg-[var(--gold)] text-black text-sm font-medium rounded-lg hover:bg-[var(--gold-hover)] transition-all flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
