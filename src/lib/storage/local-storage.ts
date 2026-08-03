import { mkdir, access, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';
import type { StorageService, UploadOptions, UploadResult } from './storage-service';
const root = path.join(process.cwd(), 'public', 'uploads');
export class LocalStorageService implements StorageService {
  private file(key: string) {
    return path.join(root, key.replace(/^[/\\]+/, '').replace(/\.\.(?=[/\\])/g, ''));
  }
  async upload(buffer: Buffer, key: string, opts: UploadOptions = {}): Promise<UploadResult> {
    const file = this.file(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buffer);
    return {
      key,
      url: `/uploads/${key.replace(/\\/g, '/')}`,
      size: buffer.length,
      contentType: opts.contentType || 'application/octet-stream',
    };
  }
  async delete(key: string) {
    await unlink(this.file(key)).catch(() => undefined);
  }
  async exists(key: string) {
    try {
      await access(this.file(key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
  async getSignedUrl(key: string) {
    return `/uploads/${key.replace(/\\/g, '/')}`;
  }
}
