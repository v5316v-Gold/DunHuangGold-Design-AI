/**
 * Stage 0 · Vitest 烟雾测试
 * 验证 Vitest + jsdom + @testing-library/jest-dom 能跑
 */
import { describe, it, expect } from 'vitest';

describe('Stage 0 · 基础设施', () => {
  it('Vitest 自身能跑', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom 提供了 DOM', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  it('RTL matchers 加载（jest-dom 扩展 expect）', () => {
    // @testing-library/jest-dom 提供 toBeInTheDocument
    const div = document.createElement('div');
    div.textContent = 'Stage 0 OK';
    document.body.appendChild(div);
    // @testing-library/jest-dom 扩展 expect
    // 用类型断言避免类型问题
    (expect(div) as unknown as { toBeInTheDocument: () => void }).toBeInTheDocument();
  });
});
