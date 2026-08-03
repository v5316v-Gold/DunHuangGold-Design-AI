import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('cn (class name utility)', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base active');
  });

  it('should handle false conditions', () => {
    const isActive = false;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base');
  });

  it('should handle undefined', () => {
    const result = cn('base', undefined, 'end');
    expect(result).toBe('base end');
  });

  it('should handle empty strings', () => {
    const result = cn('', 'base', '');
    expect(result).toBe('base');
  });

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toBe('foo bar');
  });

  it('should merge tailwind classes intelligently', () => {
    // clsx+twMerge handles tailwind conflicts
    const result = cn('px-2 px-4', 'py-2');
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
  });
});
