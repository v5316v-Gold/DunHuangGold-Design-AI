/**
 * 本地文件存储工具
 * 使用统一的 storage-config.ts 配置
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import {
  UPLOAD_DIR,
  BASE_URL,
  getFileTypeDir,
  type FileType,
} from './storage-config';

export type { FileType };

/**
 * 确保目录存在
 */
async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * 下载远程图片并保存到本地
 * @param imageUrl 远程图片URL
 * @param type 保存类型 (images/generated/avatars/thumbnails)
 * @returns 本地访问URL，失败返回null
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  type: FileType = 'images'
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[local-storage] 下载失败: ${response.status} - ${imageUrl}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}.png`;

    const targetDir = getFileTypeDir(type);
    await ensureDir(targetDir);

    const filepath = path.join(targetDir, filename);
    await writeFile(filepath, buffer);

    // 返回本地访问 URL
    const localUrl = `${BASE_URL}/api/download?type=${type}&filename=${filename}`;
    console.log(`[local-storage] 已保存: ${type}/${filename}`);
    return localUrl;
  } catch (error) {
    console.error(`[local-storage] 保存图片出错:`, error);
    return null;
  }
}

/**
 * 批量下载并保存图片（并行）
 * @param imageUrls 远程图片URL数组
 * @param type 保存类型
 * @returns 本地URL数组（只保留成功保存的）
 */
export async function downloadAndSaveImages(
  imageUrls: string[],
  type: FileType = 'generated'
): Promise<{ localUrls: string[]; failedUrls: string[] }> {
  // 并行下载所有图片
  const results = await Promise.all(
    imageUrls.map(async (url) => {
      const localUrl = await downloadAndSaveImage(url, type);
      return { url, localUrl };
    })
  );

  const localUrls = results
    .filter((r) => r.localUrl !== null)
    .map((r) => r.localUrl as string);

  const failedUrls = results
    .filter((r) => r.localUrl === null)
    .map((r) => r.url);

  return { localUrls, failedUrls };
}

/**
 * 保存 Base64 图片到本地
 */
export async function saveBase64Image(
  base64Data: string,
  type: FileType = 'generated'
): Promise<string | null> {
  try {
    // 去掉 data:image/png;base64, 前缀
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}.png`;

    const targetDir = getFileTypeDir(type);
    await ensureDir(targetDir);

    const filepath = path.join(targetDir, filename);
    await writeFile(filepath, buffer);

    const localUrl = `${BASE_URL}/api/download?type=${type}&filename=${filename}`;
    console.log(`[local-storage] Base64图片已保存: ${type}/${filename}`);
    return localUrl;
  } catch (error) {
    console.error(`[local-storage] 保存Base64图片出错:`, error);
    return null;
  }
}

/**
 * 获取上传目录路径（向后兼容）
 * @deprecated 使用 UPLOAD_DIR from storage-config 代替
 */
export function getUploadDir(): string {
  return UPLOAD_DIR;
}
