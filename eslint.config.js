const js = require('@eslint/js');
const react = require('eslint-plugin-react');

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  js.configs.recommended,
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: { module: 'readonly', require: 'readonly' },
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    settings: { react: { version: 'detect' } },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        Blob: 'readonly',
        URL: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
];
