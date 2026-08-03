import { describe, it, expect } from 'vitest';
import {
  generateImageSchema,
  productRefineSchema,
  multiImageSchema,
  reliefSchema,
  upscaleSchema,
  text2VideoSchema,
  safeParse,
  sanitizeError,
} from '../lib/validators';

describe('validators - schema parsing', () => {
  describe('generateImageSchema', () => {
    it('should parse valid data', () => {
      const result = safeParse(generateImageSchema, {
        prompt: '敦煌风格首饰设计',
        count: 2,
        resolution: '2k',
        ratio: '1:1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe('敦煌风格首饰设计');
        expect(result.data.count).toBe(2);
        expect(result.data.resolution).toBe('2k');
      }
    });

    it('should apply defaults', () => {
      const result = safeParse(generateImageSchema, { prompt: 'test' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(1);
        expect(result.data.resolution).toBe('2k');
        expect(result.data.ratio).toBe('auto');
      }
    });

    it('should reject empty prompt', () => {
      const result = safeParse(generateImageSchema, { prompt: '' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid resolution', () => {
      const result = safeParse(generateImageSchema, { prompt: 'test', resolution: '8k' });
      expect(result.success).toBe(false);
    });

    it('should reject count > 4', () => {
      const result = safeParse(generateImageSchema, { prompt: 'test', count: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('productRefineSchema', () => {
    it('should parse valid data', () => {
      const result = safeParse(productRefineSchema, {
        imageUrl: 'https://example.com/image.jpg',
        prompt: 'enhance quality',
        strength: 0.7,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = safeParse(productRefineSchema, { imageUrl: 'not-a-url' });
      expect(result.success).toBe(false);
    });

    it('should reject strength > 1', () => {
      const result = safeParse(productRefineSchema, {
        imageUrl: 'https://example.com/image.jpg',
        strength: 1.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('multiImageSchema', () => {
    it('should require at least 2 images', () => {
      const result = safeParse(multiImageSchema, {
        images: ['https://example.com/1.jpg'],
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid image array', () => {
      const result = safeParse(multiImageSchema, {
        images: [
          'https://example.com/1.jpg',
          'https://example.com/2.jpg',
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject more than 10 images', () => {
      const images = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.jpg`);
      const result = safeParse(multiImageSchema, { images });
      expect(result.success).toBe(false);
    });
  });

  describe('reliefSchema', () => {
    it('should accept valid data', () => {
      const result = safeParse(reliefSchema, {
        imageUrl: 'https://example.com/image.jpg',
        depth: 7,
        style: 'emboss',
      });
      expect(result.success).toBe(true);
    });

    it('should apply default style', () => {
      const result = safeParse(reliefSchema, {
        imageUrl: 'https://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.style).toBe('emboss');
        expect(result.data.depth).toBe(5);
      }
    });

    it('should reject invalid style', () => {
      const result = safeParse(reliefSchema, {
        imageUrl: 'https://example.com/image.jpg',
        style: 'invalid-style',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('upscaleSchema', () => {
    it('should accept scale 2,3,4', () => {
      [2, 3, 4].forEach(scale => {
        const result = safeParse(upscaleSchema, {
          imageUrl: 'https://example.com/image.jpg',
          scale,
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject scale > 4', () => {
      const result = safeParse(upscaleSchema, {
        imageUrl: 'https://example.com/image.jpg',
        scale: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('text2VideoSchema', () => {
    it('should apply defaults', () => {
      const result = safeParse(text2VideoSchema, { prompt: 'test video' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.duration).toBe(4);
        expect(result.data.fps).toBe(30);
      }
    });

    it('should reject duration > 10', () => {
      const result = safeParse(text2VideoSchema, {
        prompt: 'test',
        duration: 15,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('validators - sanitizeError', () => {
  it('should return dev error message in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const result = sanitizeError(new Error('detailed error'), 'fallback');
    expect(result.message).toBe('detailed error');
    process.env.NODE_ENV = originalEnv;
  });

  it('should sanitize internal URLs in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const result = sanitizeError(new Error('Error at http://localhost:3000'), 'generic error');
    expect(result.message).toBe('generic error');
    process.env.NODE_ENV = originalEnv;
  });

  it('should sanitize API keys in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const result = sanitizeError(new Error('Failed with API key sk-abc123'), 'generic error');
    expect(result.message).toBe('generic error');
    process.env.NODE_ENV = originalEnv;
  });

  it('should map known error codes to user-friendly messages', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const result = sanitizeError(new Error('ECONNREFUSED'), 'fallback');
    expect(result.message).toBe('服务暂时不可用，请稍后重试');
    process.env.NODE_ENV = originalEnv;
  });
});
