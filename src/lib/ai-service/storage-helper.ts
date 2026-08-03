/**
 * AI 服务层 — 存储辅助函数
 *
 * 从 generate-image 等路由中提取的图片保存逻辑。
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getFileTypeDir } from '@/lib/storage-config';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('storage-helper');

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * 安全地将 imageUrl 解析为可 fetch 的绝对 URL
 *
 * 修复 P0-3：原实现直接 fetch(imageUrl)，当 URL 包含中文 subfolder（如
 *   /api/comfyui-image?filename=X&subfolder=敦煌金）
 * 时，Node fetch 不自动编码非 ASCII 字符，抛出
 *   TypeError [ERR_UNESCAPED_CHARACTERS]: Invalid character in header content
 * 或 Failed to parse URL。
 *
 * 解决：用 WHATWG URL 解析并序列化，自动 percent-encode 非安全字符。
 *
 * @param imageUrl 任意形式的 image URL（绝对 / 相对 / 含中文 query）
 * @returns 可被 fetch 接受的绝对 URL；解析失败返回 null
 */
export function toSafeFetchUrl(imageUrl: string): string | null {
  try {
    // 已经是绝对 URL
    if (/^https?:\/\//i.test(imageUrl)) {
      const u = new URL(imageUrl);
      // 重新序列化触发自动 percent-encode（不改变 path，只编码 query）
      return u.toString();
    }
    // 相对路径：基于 BASE_URL 拼接
    const base = new URL(BASE_URL);
    // new URL(rel, base) 会自动处理 query 中的非 ASCII 字符
    return new URL(imageUrl, base).toString();
  } catch (err) {
    logger.warn('URL 解析失败', { imageUrl: imageUrl.substring(0, 80), err });
    return null;
  }
}

/**
 * 从 URL 下载图片并保存到本地 generated 目录
 * @returns 本地访问 URL
 */
export async function saveImageFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const safeUrl = toSafeFetchUrl(imageUrl);
    if (!safeUrl) {
      logger.error('图片 URL 非法，跳过保存', { imageUrl: imageUrl.substring(0, 80) });
      return null;
    }

    const response = await fetch(safeUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}.png`;

    const targetDir = getFileTypeDir('generated');
    await ensureDir(targetDir);

    const filepath = path.join(targetDir, filename);
    await writeFile(filepath, buffer);

    return `${BASE_URL}/api/download?type=generated&filename=${filename}`;
  } catch (error) {
    logger.error('保存图片失败', error);
    return null;
  }
}

/**
 * 并行保存多张图片
 * @returns { localUrls: 成功保存的 URL 列表, failedUrls: 失败的 URL 列表 }
 */
export async function saveImagesFromUrls(
  imageUrls: string[]
): Promise<{ localUrls: string[]; failedUrls: string[] }> {
  if (!imageUrls.length) return { localUrls: [], failedUrls: [] };

  const results = await Promise.all(
    imageUrls.map(async (url) => {
      const localUrl = await saveImageFromUrl(url);
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
