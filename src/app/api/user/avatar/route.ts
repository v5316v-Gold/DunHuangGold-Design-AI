import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const dynamic = 'force-dynamic';

/**
 * 上传用户头像
 * POST /api/user/avatar
 * Body: FormData with 'avatar' field (image file)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const formData = await request.formData();
    const avatarFile = formData.get('avatar') as File | null;

    if (!avatarFile) {
      return NextResponse.json({ success: false, error: '请选择图片' }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(avatarFile.type)) {
      return NextResponse.json({ success: false, error: '只支持 JPG/PNG/GIF/WebP 格式' }, { status: 400 });
    }

    // 验证文件大小 (最大 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (avatarFile.size > maxSize) {
      return NextResponse.json({ success: false, error: '图片大小不能超过 2MB' }, { status: 400 });
    }

    // 保存文件
    const bytes = await avatarFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 生成唯一文件名
    const ext = avatarFile.name.split('.').pop() || 'jpg';
    const fileName = `avatar_${user.userId}_${Date.now()}.${ext}`;
    
    // 上传目录
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
    
    // 确保目录存在
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 保存文件
    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // 更新数据库
    const avatarUrl = `/uploads/avatars/${fileName}`;
    
    if (db) {
      await db.update(users)
        .set({ avatar: avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, user.userId));
    }

    return NextResponse.json({
      success: true,
      data: { avatar: avatarUrl }
    });

  } catch (error) {
    console.error('[avatar] 上传失败:', error);
    return NextResponse.json({ success: false, error: '上传失败' }, { status: 500 });
  }
}
