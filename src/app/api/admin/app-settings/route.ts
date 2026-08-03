/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并目标: /api/admin/settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      console.error('[app-settings] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const settings = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1);
    
    if (settings.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }
    
    return NextResponse.json({ success: true, data: settings[0] });
  } catch (error) {
    console.error('获取设置失败:', error);
    return NextResponse.json({ success: false, error: '获取设置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      console.error('[app-settings] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const body = await request.json();
    const { translate_settings, interface_settings, system_settings, feature_switches, selected_services } = body;
    
    const updateData: any = { updated_at: new Date() };
    
    if (translate_settings !== undefined) updateData.translate_settings = JSON.stringify(translate_settings);
    if (interface_settings !== undefined) updateData.interface_settings = JSON.stringify(interface_settings);
    if (system_settings !== undefined) updateData.system_settings = JSON.stringify(system_settings);
    if (feature_switches !== undefined) updateData.feature_switches = JSON.stringify(feature_switches);
    if (selected_services !== undefined) updateData.selected_services = JSON.stringify(selected_services);
    
    await db.update(appSettings).set(updateData).where(eq(appSettings.id, 'default'));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存设置失败:', error);
    return NextResponse.json({ success: false, error: '保存设置失败' }, { status: 500 });
  }
}
