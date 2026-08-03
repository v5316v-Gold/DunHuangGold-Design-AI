import { LocalStorageService } from './local-storage';
import { S3StorageService } from './s3-storage';
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'public-read' | 'private';
}
export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}
export interface StorageService {
  upload(buffer: Buffer, key: string, opts?: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
export function getStorageService(): StorageService {
  return process.env.STORAGE_TYPE === 's3' || Boolean(process.env.R2_ACCOUNT_ID)
    ? new S3StorageService()
    : new LocalStorageService();
}
