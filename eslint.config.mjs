import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginReactRefresh from 'eslint-plugin-react-refresh'

// Prettier 相关
import eslintPluginPrettier from 'eslint-plugin-prettier'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  // ============================================
  // 1. 基础配置
  // ============================================

  // ESLint 官方推荐配置
  eslint.configs.recommended,

  // TypeScript ESLint 推荐配置
  ...tseslint.configs.recommended,

  // ============================================
  // 2. 全局变量配置
  // ============================================
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser, // 前端 (web/)
        ...globals.node, // MCP Server (src/)
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },

  // ============================================
  // 3. React 配置 (packages/mcp-server/web/)
  // ============================================
  {
    files: ['**/web/**/*.{jsx,tsx}', '**/*.{jsx,tsx}'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'react-refresh': pluginReactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React 基础规则
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs['jsx-runtime'].rules, // React 17+ JSX Transform

      // React Hooks 规则
      ...pluginReactHooks.configs.recommended.rules,

      // React Refresh 规则（Vite HMR）
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // 自定义 React 规则
      'react/prop-types': 'off', // TypeScript 已处理类型检查
      'react/react-in-jsx-scope': 'off', // React 17+ 不需要导入 React
    },
  },

  // ============================================
  // 4. TypeScript 项目特定配置
  // ============================================
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },

  // ============================================
  // 5. MCP Server 特定配置 (packages/mcp-server/src/)
  // ============================================
  {
    files: ['**/src/**/*.{js,ts}'],
    rules: {
      // Server 端允许 console.error (MCP 使用 stderr 日志)
      'no-console': ['warn', { allow: ['error', 'warn'] }],

      // 允许 Node.js 特定模式
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // ============================================
  // 6. 通用代码质量规则
  // ============================================
  {
    rules: {
      // 控制台和调试器
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

      // 代码质量
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'warn',
      'prefer-arrow-callback': 'warn',

      // 避免错误
      'no-duplicate-imports': 'error',
      'no-template-curly-in-string': 'warn',
    },
  },

  // ============================================
  // 7. Prettier 配置（必须放在最后！）
  // ============================================

  // 禁用与 Prettier 冲突的规则
  eslintConfigPrettier,

  // 开启 Prettier 插件
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },

  // ============================================
  // 8. 全局忽略文件
  // ============================================
  {
    ignores: [
      // 构建输出
      '**/dist/',
      '**/build/',
      '**/web-dist/',
      '**/out/',

      // 依赖
      '**/node_modules/',

      // 缓存和临时文件
      '**/*.tsbuildinfo',
      '.vscode/',
      '.idea/',

      // AI 工具配置
      '.ai/',
      '.claude/',
      '.codex/',
      '.agent/',
      'docs/',

      // 系统文件
      '.DS_Store',
      'Thumbs.db',

      // 配置文件
      'eslint.config.mjs',
      'prettier.config.mjs',
      'commitlint.config.js',

      // 日志
      '*.log',
      'npm-debug.log*',
      'pnpm-debug.log*',
    ],
  },
)
