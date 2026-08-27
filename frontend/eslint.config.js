import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Flat config (ESLint 10).
 *
 * `tsc` already enforces types, unused locals and unused parameters via
 * tsconfig.app.json, so nothing here duplicates that. What ESLint adds on top is
 * the rules a type checker cannot express: rules of hooks, fast-refresh safety,
 * and the promise mistakes that are easy to make in a fetch-heavy app.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'eslint.config.js'] },

  // ------------------------------------------------------------- application
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Vite's fast refresh only works when a module exports components and
      // nothing else. Constant exports are common and harmless, so they are
      // allowed rather than flagged.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // The `_`-prefix escape hatch, matching the convention tsc uses.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Every page loads its data with `useCallback` + `useEffect(() => { void
      // load(); })`, and the `setLoading(true)` at the top of that callback is
      // what this rule objects to. The pattern is deliberate and used in 18
      // places, so it stays a warning: worth seeing when writing a new effect,
      // not worth failing the build over until the pages move to a data layer
      // that fetches outside of render.
      'react-hooks/set-state-in-effect': 'warn',

      // A dropped promise in an event handler fails silently in the UI — the
      // error never reaches a catch and the user sees nothing happen.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },

  // ------------------------------------------------------------ build config
  // vite.config.ts runs in Node and belongs to a different tsconfig.
  {
    files: ['vite.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
