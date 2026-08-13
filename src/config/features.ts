/**
 * 16个AI功能配置定义
 * 每个功能对应云端API、本地ComfyUI（15个）、本地大模型（1个）
 */

// ==================== 功能定义 ====================

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'image' | '3d' | 'video' | 'chat';
  defaultCloudProvider: string;
  defaultLocalProvider: 'comfyui' | 'ollama';
  priority: ('cloud' | 'local')[];
  autoFallback: boolean;
}

export const FEATURE_DEFINITIONS: Record<string, FeatureDefinition> = {
  // ========== 图片生成类 ==========
  'text2img': {
    id: 'text2img',
    name: '文案生图',
    description: '根据文本描述生成图片',
    icon: 'Image',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'product-refine': {
    id: 'product-refine',
    name: '产品精修',
    description: 'AI智能精修产品图片',
    icon: 'Sparkles',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'multi-image': {
    id: 'multi-image',
    name: '多图融合',
    description: '多张图片融合创意合成',
    icon: 'Layers',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'one-click-design': {
    id: 'one-click-design',
    name: '一键设计',
    description: '智能一键生成设计方案',
    icon: 'Zap',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'multi-view': {
    id: 'multi-view',
    name: '生成多视图',
    description: '生成商品多角度视图',
    icon: 'Box',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'sketch-realistic': {
    id: 'sketch-realistic',
    name: '线稿/写实',
    description: '线稿图转换为写实照片',
    icon: 'Pencil',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'free-creation': {
    id: 'free-creation',
    name: '自由创作区',
    description: '自由发挥的AI创作空间',
    icon: 'Palette',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'remove-background': {
    id: 'remove-background',
    name: '移除背景',
    description: 'AI智能移除图片背景',
    icon: 'Eraser',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'upscale': {
    id: 'upscale',
    name: '高清放大',
    description: 'AI超分辨率图片放大',
    icon: 'Maximize2',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'remove-watermark': {
    id: 'remove-watermark',
    name: '去除水印',
    description: 'AI智能去除图片水印',
    icon: 'Wand2',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  
  // ========== 3D类 ==========
  'relief': {
    id: 'relief',
    name: '浮雕图生成',
    description: '生成敦煌风格浮雕效果',
    icon: 'Mountain',
    category: '3d',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'image-3d': {
    id: 'image-3d',
    name: '3D模型生成',
    description: '图片转换为3D模型',
    icon: 'Box',
    category: '3d',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  'stereo': {
    id: 'stereo',
    name: '图像转立体',
    description: '生成深度立体效果',
    icon: 'Scan',
    category: '3d',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
  
  // ========== 视频类 ==========
  'text2video': {
    id: 'text2video',
    name: '文生视频',
    description: '文本描述生成视频',
    icon: 'Video',
    category: 'video',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: false,
  },
  'image2video': {
    id: 'image2video',
    name: '图生视频',
    description: '图片生成动态视频',
    icon: 'Film',
    category: 'video',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: false,
  },
  
  // ========== 对话类 ==========
  'ai-chat': {
    id: 'ai-chat',
    name: 'AI对话',
    description: '智能AI对话助手',
    icon: 'MessageCircle',
    category: 'chat',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'ollama',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },

  // ========== 佩戴效果 (新增 2026-08-03) ==========
  // 业务侧: src/components/workspace/TryOnEffect.tsx、算力 25、Sidebar/WorkspacePanel 已挂载
  // 这里补齐 FEATURE_DEFINITIONS + FEATURE_LIST,使其在功能管理、算力配置等统一管线可见
  'tryon': {
    id: 'tryon',
    name: '佩戴效果',
    description: 'AI虚拟试戴效果生成(珠宝/服饰/模特佩戴)',
    icon: 'Shirt',
    category: 'image',
    defaultCloudProvider: 'minimax',
    defaultLocalProvider: 'comfyui',
    priority: ['cloud', 'local'],
    autoFallback: true,
  },
};

// ==================== 功能列表 ====================

export const FEATURE_LIST = [
  { id: 'relief', order: 1 },
  { id: 'image-3d', order: 2 },
  { id: 'stereo', order: 3 },
  { id: 'text2img', order: 4 },
  { id: 'product-refine', order: 5 },
  { id: 'multi-image', order: 6 },
  { id: 'one-click-design', order: 7 },
  { id: 'multi-view', order: 8 },
  { id: 'sketch-realistic', order: 9 },
  { id: 'free-creation', order: 10 },
  { id: 'text2video', order: 11 },
  { id: 'image2video', order: 12 },
  { id: 'remove-background', order: 13 },
  { id: 'upscale', order: 14 },
  { id: 'remove-watermark', order: 15 },
  { id: 'ai-chat', order: 16 },
  { id: 'tryon', order: 17 },
];

// ==================== 获取功能信息 ===================

export function getFeature(id: string): FeatureDefinition | undefined {
  return FEATURE_DEFINITIONS[id];
}

export function getAllFeatures(): FeatureDefinition[] {
  return FEATURE_LIST.map(f => FEATURE_DEFINITIONS[f.id]).filter(Boolean);
}

export function getFeaturesByCategory(category: FeatureDefinition['category']): FeatureDefinition[] {
  return getAllFeatures().filter(f => f.category === category);
}
