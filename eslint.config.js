// ESLint 9 flat config for the Zameen monorepo.
// Enforces TS strict + stylistic, blocks em-dashes in string literals,
// blocks cross-app @/components imports, applies React rules to .tsx,
// and runs tailwindcss class-order plugin.
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tailwind from 'eslint-plugin-tailwindcss';
import noRawConsoleLog from './tools/eslint-rules/no-raw-console-log.cjs';

const EM_DASH = '—';

const zameenPlugin = {
  rules: {
    'no-raw-console-log': noRawConsoleLog,
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'supabase/.branches/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  ...tailwind.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
    },
    plugins: {
      zameen: zameenPlugin,
    },
    rules: {
      'zameen/no-raw-console-log': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${EM_DASH}/]`,
          message:
            'Em-dashes are banned in source literals (project convention). Use a hyphen or rephrase.',
        },
        {
          selector: `TemplateElement[value.raw=/${EM_DASH}/]`,
          message:
            'Em-dashes are banned in template literals (project convention). Use a hyphen or rephrase.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/*', '@/app/*', '@/lib/*'],
              message:
                'Cross-app imports via "@/..." are not allowed across apps. Move shared code into packages/ instead.',
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.int.test.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
