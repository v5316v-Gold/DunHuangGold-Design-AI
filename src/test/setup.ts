import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ============================================================
// 环境变量 mocks
// ============================================================
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
// JWT_SECRET 必须 >= 32 字符，否则 auth.ts 会拒绝启动
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-validation-32chars';
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.COMFYUI_HOST = 'http://localhost:8188';

// ============================================================
// fetch mock（防止真实 HTTP 调用）
// ============================================================
global.fetch = vi.fn();

// ============================================================
// localStorage mock
// ============================================================
const localStorageStore: Record<string, string> = {};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value; },
    removeItem: (key: string) => { delete localStorageStore[key]; },
    clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
  },
});

// ============================================================
// window.matchMedia mock
// ============================================================
// node 环境（vitest.node.config.ts / @vitest-environment node）下无 window，必须守卫
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ============================================================
// React / Next.js router mocks
// ============================================================
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
