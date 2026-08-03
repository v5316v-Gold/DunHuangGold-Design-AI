/**
 * 统一分类配置 - 作品展示分类与功能 ID 双向映射
 * 以 Gallery 分类为主，这是唯一的真相来源
 */

// Gallery 分类列表（按展示顺序）
export const GALLERY_CATEGORIES = [
  '全部',
  '文案生图',
  '图转浮雕图',
  '图转3D模型',
  '产品精修',
  '多图融合',
  '线稿/写实',
  '平面转雕塑',
  '自由创作区',
  '一键设计',
  '生成多视图',
  '文生视频',
  '图生视频',
] as const;

export type GalleryCategory = typeof GALLERY_CATEGORIES[number];

// 功能 ID → Gallery 分类名 映射
export const FEATURE_TO_CATEGORY: Record<string, GalleryCategory> = {
  // 浮雕圆雕
  text2img: '文案生图',
  relief: '图转浮雕图',
  image3d: '图转3D模型',
  '2dto3d': '平面转雕塑',

  // 灵感创作
  // dialogue (AI对话) 暂不归入 Gallery 分类，如需显示可归入'自由创作区'
  dialogue: '自由创作区',
  refine: '产品精修',
  blend: '多图融合',
  sketch: '线稿/写实',
  oneclick: '一键设计',
  multiview: '生成多视图',
  free: '自由创作区',

  // 视频生成
  text2video: '文生视频',
  img2video: '图生视频',

  // 实用工具 → 归类到产品精修
  removebg: '产品精修',
  upscale: '产品精修',
  watermark: '产品精修',
};

// 反向映射：分类名 → 功能 ID 列表
export const CATEGORY_TO_FEATURES: Record<GalleryCategory | '全部', string[]> = {
  '全部': [
    'text2img', 'relief', 'image3d', '2dto3d',
    'dialogue', 'refine', 'blend', 'sketch', 'oneclick', 'multiview', 'free',
    'text2video', 'img2video',
    'removebg', 'upscale', 'watermark',
  ],
  '文案生图': ['text2img'],
  '图转浮雕图': ['relief'],
  '图转3D模型': ['image3d'],
  '产品精修': ['refine', 'removebg', 'upscale', 'watermark'],
  '多图融合': ['blend'],
  '线稿/写实': ['sketch'],
  '平面转雕塑': ['2dto3d'],
  '自由创作区': ['free', 'dialogue'],
  '一键设计': ['oneclick'],
  '生成多视图': ['multiview'],
  '文生视频': ['text2video'],
  '图生视频': ['img2video'],
};

// 类型对应的图标和颜色（用于 Gallery 展示）
export const CATEGORY_CONFIG: Record<GalleryCategory, { icon: string; color: string }> = {
  '文案生图': { icon: 'Sparkles', color: '#C8A45C' },
  '图转浮雕图': { icon: 'Box', color: '#B8860B' },
  '图转3D模型': { icon: 'Box', color: '#DAA520' },
  '产品精修': { icon: 'Palette', color: '#CD853F' },
  '多图融合': { icon: 'Sparkles', color: '#C8A45C' },
  '线稿/写实': { icon: 'Palette', color: '#CD853F' },
  '平面转雕塑': { icon: 'Box', color: '#DAA520' },
  '自由创作区': { icon: 'Sparkles', color: '#C8A45C' },
  '一键设计': { icon: 'Sparkles', color: '#C8A45C' },
  '生成多视图': { icon: 'Box', color: '#DAA520' },
  '文生视频': { icon: 'Zap', color: '#B8860B' },
  '图生视频': { icon: 'Zap', color: '#B8860B' },
  '全部': { icon: 'Sparkles', color: '#C8A45C' },
};

// 验证功能 ID 是否有效
export function isValidFeatureId(id: string): boolean {
  return id in FEATURE_TO_CATEGORY;
}

// 获取功能对应的分类
export function getCategoryForFeature(featureId: string): GalleryCategory | null {
  return FEATURE_TO_CATEGORY[featureId] || null;
}

// 获取分类对应的所有功能 ID
export function getFeaturesForCategory(category: GalleryCategory | '全部'): string[] {
  return CATEGORY_TO_FEATURES[category] || [];
}

// 判断作品是否符合筛选条件
export function matchesCategoryFilter(
  featureId: string,
  category: GalleryCategory | '全部'
): boolean {
  if (category === '全部') return true;
  const features = CATEGORY_TO_FEATURES[category];
  return features?.includes(featureId) || false;
}
