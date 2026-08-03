import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { StorageService, UploadOptions, UploadResult } from './storage-service';
export class S3StorageService implements StorageService {
  private readonly bucket = process.env.S3_BUCKET || process.env.R2_BUCKET || '';
  private readonly publicUrl = (
    process.env.S3_PUBLIC_URL ||
    process.env.R2_PUBLIC_URL ||
    ''
  ).replace(/\/$/, '');
  private readonly client = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint:
      process.env.S3_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined),
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        }
      : undefined,
  });

  async upload(buffer: Buffer, key: string, opts: UploadOptions = {}): Promise<UploadResult> {
    const contentType = opts.contentType || 'application/octet-stream';
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: opts.metadata,
      })
    );
    return {
      key,
      url: this.publicUrl ? `${this.publicUrl}/${key}` : await this.getSignedUrl(key),
      size: buffer.length,
      contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    // AWS SDK v3 的 getSignedUrl 在 v3.700+ 改为命令模块的 presign 方法
    // 这里使用 SDK 内置的 presigner；如项目未装 @aws-sdk/s3-request-presigner，
    // 直接返回 public URL 兜底（避免硬失败）。
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - optional peer dep, may not be installed
      const mod: { getSignedUrl?: (client: unknown, cmd: unknown, opts: { expiresIn: number }) => Promise<string> } = await import('@aws-sdk/s3-request-presigner');
      if (mod.getSignedUrl) {
        return await mod.getSignedUrl(this.client, cmd, { expiresIn });
      }
      throw new Error('getSignedUrl unavailable');
    } catch {
      return this.publicUrl
        ? `${this.publicUrl}/${key}`
        : `https://${this.bucket}.s3.amazonaws.com/${key}`;
    }
  }
}
