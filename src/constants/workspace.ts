// 图片比例选项
export const IMAGE_RATIOS = [
  { value: 'auto', label: 'Auto', sub: '自动' },
  { value: '1:1', label: '1:1', sub: '方形' },
  { value: '2:3', label: '2:3', sub: '竖版' },
  { value: '3:2', label: '3:2', sub: '横版' },
  { value: '3:4', label: '3:4', sub: '竖版' },
  { value: '4:3', label: '4:3', sub: '横版' },
  { value: '4:5', label: '4:5', sub: '竖版' },
  { value: '5:4', label: '5:4', sub: '横版' },
  { value: '9:16', label: '9:16', sub: '手机' },
  { value: '16:9', label: '16:9', sub: '宽屏' },
  { value: '21:9', label: '21:9', sub: '超宽' },
];

// 图片分辨率选项
export const IMAGE_RESOLUTIONS = [
  { value: '1k', label: '1K', desc: '快速' },
  { value: '2k', label: '2K', desc: '推荐' },
  { value: '4k', label: '4K', desc: '最高质量' },
];

// 视频分辨率选项
export const VIDEO_RESOLUTIONS = [
  { value: '480p', label: '480P', desc: '标清' },
  { value: '720p', label: '720P', desc: '高清' },
  { value: '1080p', label: '1080P', desc: '全高清' },
];

// 视频比例选项
export const VIDEO_RATIOS = [
  { value: '9:16', label: '9:16', sub: '竖屏' },
  { value: '16:9', label: '16:9', sub: '横屏' },
  { value: '1:1', label: '1:1', sub: '方形' },
];

// 工作区组件 Props 类型
export interface WorkspaceProps {
  power: number;
  onDeductPower: (amount: number, reason: string) => void;
}
