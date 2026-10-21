import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';

// Foco em erros reais: identificadores e componentes não definidos (o build do Vite não pega isso).
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
    },
  },
  { files: ['*.config.js'], languageOptions: { globals: { ...globals.node } } },
];
