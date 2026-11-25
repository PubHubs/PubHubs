import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{ ignores: ['**/dist/**', '**/node_modules/**'] },

	eslint.configs.recommended,
	tseslint.configs.recommended,
	pluginVue.configs['flat/recommended'],

	// Disable all rules that conflict with prettier
	prettier,

	{
		languageOptions: {
			globals: {
				// Injected by Vite's define plugin (see vite.config.ts)
				_env: 'readonly',
				__APP_VERSION__: 'readonly',
			},
			parserOptions: {
				parser: tseslint.parser,
				extraFileExtensions: ['.vue'],
				sourceType: 'module',
			},
		},
		plugins: {
			'@eslint-community/eslint-comments': eslintComments,
		},
		rules: {
			// Require a description whenever a rule is disabled inline
			'@eslint-community/eslint-comments/require-description': 'error',
			// Disallow unused disable directives
			'@eslint-community/eslint-comments/no-unused-disable': 'error',

			// General
			eqeqeq: ['error', 'smart'],
			'no-console': 'warn',

			// New in ESLint 10; TODO: clean up the 11 hits, then remove this line.
            'no-useless-assignment': 'off',

			// TypeScript
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],

			'vue/attributes-order': 'error',
			'vue/block-order': ['warn', { order: ['template', 'script', 'style'] }],
			'vue/component-api-style': ['error', ['script-setup']],
			'vue/define-macros-order': 'warn',
			'vue/multi-word-component-names': 'off',
			'vue/no-unused-refs': 'warn',
			'vue/no-v-html': 'error',
			// New in eslint-plugin-vue 10; TODO: clean up the 9 hits, then remove this line.
            'vue/no-required-prop-with-default': 'off',
		},
	},
	// TypeScript (vue-tsc) already catches undefined names. typescript-eslint turns no-undef off
    // for .ts files, but not for .vue files.
    {
    	files: ['**/*.vue'],
        rules: { 'no-undef': 'off' },
    },
]);
