'use client';

import { Droplet } from 'lucide-react';
import { ImageWorkspace, ImageWorkspaceConfig } from './ImageWorkspace';
import { WorkspaceProps } from '@/constants/workspace';

const config: ImageWorkspaceConfig = {
  featureId: 'watermark',
  title: '去除水印',
  buttonText: '开始去水印',
  deductReason: '去除水印',
  downloadPrefix: 'remove-watermark',
  emptyIcon: <Droplet className="w-12 h-12 text-[var(--text-muted)]" />,
  buttonIcon: <Droplet className="w-4 h-4" />,
  emptyTitle: '上传图片自动去除水印',
  emptyDesc: '智能识别，精准去除',
  buildApiParams: ({ image, resolution, ratio }) => ({
    image,
    resolution,
    ratio,
  }),
};

export default function RemoveWatermark(props: WorkspaceProps) {
  return <ImageWorkspace {...props} config={config} />;
}
