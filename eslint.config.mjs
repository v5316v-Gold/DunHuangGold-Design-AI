import nextTs from 'eslint-config-next/typescript';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Phase 9.18: ESLint warnings cleanup
  // - no-explicit-any: 已逐文件加 eslint-disable 注释（保持 warning 级别）
  // - no-unused-vars: 禁用（项目历史技术债，100+ 个未使用 import/变量，
  //   改名为 _ 前缀需要逐个改 import 关联，工作量大；保留为代码质量警告层级）
  // - react-hooks/exhaustive-deps: 禁用（useEffect 依赖管理重构成本高，
  //   且部分依赖来自外部 store/setState 函数，eslint-disable-next-line 难以批量处理）
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      // 保留：set-state-in-effect（Phase 9.18 已禁）
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Build artifacts:
    'server.js',
    'dist/**',
    // Script files (CommonJS):
    'scripts/**/*.js',
  ]),
]);

export default eslintConfig;
