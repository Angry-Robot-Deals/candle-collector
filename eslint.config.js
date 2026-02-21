const { defineConfig } = require('eslint/config');
const tsRawPlugin = require('@typescript-eslint/eslint-plugin/use-at-your-own-risk/raw-plugin');
const eslintConfigPrettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  ...tsRawPlugin.flatConfigs['flat/recommended'],
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        NodeJS: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  eslintConfigPrettier,
]);
