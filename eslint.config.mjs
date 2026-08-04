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
  ]),
]);

export default eslintConfig;
