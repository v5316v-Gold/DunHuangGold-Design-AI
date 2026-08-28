import { describe, it, expect } from 'vitest';
import { FEATURE_DEFINITIONS, FEATURE_LIST, getFeature, getAllFeatures, getFeaturesByCategory } from '../config/features';

describe('features.ts', () => {
  describe('FEATURE_DEFINITIONS', () => {
    it('should have all required features defined', () => {
      const requiredIds = [
        'text2img', 'refine', 'blend', 'oneclick', 'multiview', 'sketch',
        'free', 'removebg', 'upscale', 'watermark', 'relief', 'image3d',
        '2dto3d', 'text2video', 'img2video', 'dialogue', 'tryon',
      ];
      requiredIds.forEach(id => {
        expect(FEATURE_DEFINITIONS).toHaveProperty(id);
      });
    });

    it('each feature should have required fields', () => {
      Object.entries(FEATURE_DEFINITIONS).forEach(([id, feature]) => {
        expect(feature.id).toBe(id);
        expect(typeof feature.name).toBe('string');
        expect(typeof feature.description).toBe('string');
        expect(typeof feature.icon).toBe('string');
        expect(['image', '3d', 'video', 'chat']).toContain(feature.category);
        expect(Array.isArray(feature.priority)).toBe(true);
        expect(typeof feature.autoFallback).toBe('boolean');
      });
    });

    it('should have correct priority arrays', () => {
      Object.values(FEATURE_DEFINITIONS).forEach(feature => {
        expect(feature.priority).toContain('cloud');
        expect(feature.priority).toContain('local');
      });
    });
  });

  describe('FEATURE_LIST', () => {
    it('should have all 17 features (含 tryon 佩戴效果)', () => {
      expect(FEATURE_LIST).toHaveLength(17);
    });

    it('should have dialogue at order 0 (灵感与创作组内置顶，DB sortOrder=0 同步生效)', () => {
      // 2026-08-20 设计变更：dialogue 归入「灵感与创作」分组并置顶，
      // FEATURE_LIST 中 order=0 表示「Sidebar 渲染优先级最高」，
      // DB features 表 sort_order 也保持 0 保证一致性。
      // 其余 16 个功能保持 1-16 顺序连续（tryon=16）。
      const dialogueEntry = FEATURE_LIST.find(f => f.id === 'dialogue');
      expect(dialogueEntry).toBeDefined();
      expect(dialogueEntry?.order).toBe(0);
    });

    it('should have sequential order values 1-16 for non-dialogue features', () => {
      // 排除 dialogue 后，其他 16 个 feature 应保持 1-16 连续顺序
      const nonDialogue = FEATURE_LIST.filter(f => f.id !== 'dialogue');
      expect(nonDialogue).toHaveLength(16);
      nonDialogue.forEach((f, i) => {
        expect(f.order).toBe(i + 1);
      });
    });

    it('should reference valid feature ids', () => {
      FEATURE_LIST.forEach(f => {
        expect(FEATURE_DEFINITIONS).toHaveProperty(f.id);
      });
    });
  });

  describe('getFeature', () => {
    it('should return feature by id', () => {
      const feature = getFeature('text2img');
      expect(feature).toBeDefined();
      expect(feature?.name).toBe('文案生图');
    });

    it('should return undefined for unknown id', () => {
      expect(getFeature('unknown-feature')).toBeUndefined();
    });
  });

  describe('getAllFeatures', () => {
    it('should return all features', () => {
      const features = getAllFeatures();
      expect(features).toHaveLength(17);
    });
  });

  describe('getFeaturesByCategory', () => {
    it('should return image features', () => {
      const imageFeatures = getFeaturesByCategory('image');
      expect(imageFeatures.length).toBeGreaterThan(0);
      imageFeatures.forEach(f => {
        expect(f.category).toBe('image');
      });
    });

    it('should return 3d features', () => {
      const features3d = getFeaturesByCategory('3d');
      expect(features3d.length).toBe(3);
      features3d.forEach(f => expect(f.category).toBe('3d'));
    });

    it('should return video features', () => {
      const videoFeatures = getFeaturesByCategory('video');
      expect(videoFeatures).toHaveLength(2);
      videoFeatures.forEach(f => expect(f.category).toBe('video'));
    });

    it('should return chat features', () => {
      const chatFeatures = getFeaturesByCategory('chat');
      expect(chatFeatures).toHaveLength(1);
    });
  });
});
