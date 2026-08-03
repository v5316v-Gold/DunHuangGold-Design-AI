'use client';

/**
 * 模型中心页面（任务三）
 * 独立路由页：/admin/models
 * UI 复用 ModelsManagementView（与 admin 后台「模型中心」tab 同一组件）
 */

import ModelsManagementView from '@/components/admin/ModelsManagementView';

export default function ModelsPage() {
  return <ModelsManagementView />;
}
