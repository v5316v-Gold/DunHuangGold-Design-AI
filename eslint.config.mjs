import nextTs from 'eslint-config-next/typescript';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Downgrade no-explicit-any to warning (historical technical debt, fix gradually)
  { rules: { '@typescript-eslint/no-explicit-any': 'warn' } },
  // 未使用变量豁免规则（社区标准）：
  //   - varsIgnorePattern: '_' 前缀 = 明确占位（如解构剔除 _drop）
  //   - argsIgnorePattern: 同上（如 catch (e) 中未用 e）
  //   - caughtErrorsIgnorePattern: catch 参数豁免（try/catch 常需占位）
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|e|err)$',
          args: 'after-used',
        },
      ],
    },
  },
  // Disable set-state-in-effect rule - many established patterns use this legitimately
  // and fixing all occurrences would require significant architectural refactoring
  { rules: { 'react-hooks/set-state-in-effect': 'off' } },
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
    // Root-level CommonJS/JS utility scripts:
    'check-apikeys.js',
    'check-users.js',
    'find-admin.js',
    'find-missing-creds.js',
    'get-token.js',
    'reset-admin.js',
    'test-api-full.js',
    'test-api.js',
    'test-api.ps1',
    'test-cookie.js',
    'test-direct-minimax.ts',
    'test-minimax.ts',
    'test-qwen-api.mjs',
    'test_stream.js',
    'verify-image.js',
    'cleanup_unused_v2.txt',
    'gen-hash.js',
    'login-admin.ts',
    'reset-admin.ts',
  ]),
]);

export default eslintConfig;
