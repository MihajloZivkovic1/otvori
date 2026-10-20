import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    rules: {
      // Context providers export their hook (useAuth, useToast, useRestaurantContext, …) from the same file by design.
      'react-refresh/only-export-components': 'off',
      // react-hook-form's watch() trips the React Compiler preset; the CMS is not compiled with it.
      'react-hooks/incompatible-library': 'off',
    },
  },
])
