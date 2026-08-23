import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ============================================================
// 环境变量 mocks
// ============================================================
// 测试环境复用本地 dev DB（dunhuang1/dunhuang2026）。
// 原占位 'postgresql://test:test@localhost:5432/test' 在容器化后
// 找不到 test 用户，全部报 'password authentication failed for user test'。
// 复用 dev DB 是 O5 阶段最务实的修复，副作用是测试可能写少量幂等测试数据。
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
  || 'postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang';
// JWT_SECRET 必须 >= 32 字符，否则 auth.ts 会拒绝启动
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-validation-32chars';
process.env.NODE_ENV = 'test';
// E2E_BASE_URL 优先（避免改硬编码默认值），默认 localhost:5000（dev server）
process.env.NEXT_PUBLIC_APP_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';
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
