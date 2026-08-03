import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// 用户设置存储（内存中，生产环境应使用数据库）
const userSettings: Record<string, {
  darkMode: boolean;
  goldCursor: boolean;
  notifications: boolean;
  publicProfile: boolean;
  publicHistory: boolean;
}> = {};

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const settings = userSettings[payload.userId] || {
      darkMode: false,
      goldCursor: true,
      notifications: true,
      publicProfile: false,
      publicHistory: false,
    };

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[User Settings GET] Error:', error);
    return NextResponse.json({ success: false, error: '获取设置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { darkMode, goldCursor, notifications, publicProfile, publicHistory } = body;

    // 初始化用户设置
    if (!userSettings[payload.userId]) {
      userSettings[payload.userId] = {
        darkMode: false,
        goldCursor: true,
        notifications: true,
        publicProfile: false,
        publicHistory: false,
      };
    }

    // 更新设置
    if (darkMode !== undefined) userSettings[payload.userId].darkMode = darkMode;
    if (goldCursor !== undefined) userSettings[payload.userId].goldCursor = goldCursor;
    if (notifications !== undefined) userSettings[payload.userId].notifications = notifications;
    if (publicProfile !== undefined) userSettings[payload.userId].publicProfile = publicProfile;
    if (publicHistory !== undefined) userSettings[payload.userId].publicHistory = publicHistory;

    return NextResponse.json({ success: true, data: userSettings[payload.userId] });
  } catch (error) {
    console.error('[User Settings PUT] Error:', error);
    return NextResponse.json({ success: false, error: '保存设置失败' }, { status: 500 });
  }
}
