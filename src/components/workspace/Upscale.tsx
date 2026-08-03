'use client';

import { Maximize2 } from 'lucide-react';
import { ImageWorkspace, ImageWorkspaceConfig } from './ImageWorkspace';
import { WorkspaceProps } from '@/constants/workspace';

const config: ImageWorkspaceConfig = {
  featureId: 'upscale',
  title: '高清放大',
  buttonText: '开始增强',
  deductReason: '高清放大',
  downloadPrefix: 'upscale',
  emptyIcon: <Maximize2 className="w-12 h-12 text-[var(--text-muted)]" />,
  buttonIcon: <Maximize2 className="w-4 h-4" />,
  emptyTitle: '上传图片进行高清放大',
  emptyDesc: '4K超清画质增强',
  buildApiParams: ({ image, resolution, ratio }) => ({
    image,
    scale: resolution === '4K' ? 4 : resolution === '2K' ? 2 : 1,
    resolution,
    ratio,
  }),
};

export default function Upscale(props: WorkspaceProps) {
  return <ImageWorkspace {...props} config={config} />;
}
