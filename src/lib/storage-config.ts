/**
 * 存储配置 - 统一管理上传目录
 * 
 * 使用环境变量 UPLOAD_DIR 配置，跨平台兼容
 */

import path from 'path';
import os from 'os';

// 默认上传目录（跨平台兼容）
const getDefaultUploadDir = () => {
  // Windows: C:\Users\<username>\AppData\Local\dunhuang-design\uploads
  // Linux/Mac: ~/.dunhuang-design/uploads
  return path.join(os.homedir(), '.dunhuang-design', 'uploads');
};

// 从环境变量读取，或使用默认路径
export const UPLOAD_DIR = process.env.UPLOAD_DIR || getDefaultUploadDir();

// 公开访问的基础 URL
export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// 文件类型目录配置
export const FILE_TYPE_DIRS = {
  images: 'images',
  generated: 'generated',
  avatars: 'avatars',
  thumbnails: 'thumbnails',
} as const;

export type FileType = keyof typeof FILE_TYPE_DIRS;

/**
 * 获取指定类型的完整目录路径
 */
export function getFileTypeDir(type: FileType): string {
  return path.join(UPLOAD_DIR, FILE_TYPE_DIRS[type]);
}

/**
 * 获取下载访问 URL
 */
export function getDownloadUrl(type: FileType, filename: string): string {
  return `${BASE_URL}/api/download?type=${type}&filename=${filename}`;
}
