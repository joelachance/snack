import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
	js.configs.recommended,
	prettierConfig,
	{
		ignores: ['.wrangler/**', 'dist/**', 'node_modules/**'],
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json',
			},
			globals: {
				// Cloudflare Workers globals
				Request: 'readonly',
				Response: 'readonly',
				Headers: 'readonly',
				URL: 'readonly',
				URLSearchParams: 'readonly',
				FormData: 'readonly',
				Blob: 'readonly',
				File: 'readonly',
				ReadableStream: 'readonly',
				WritableStream: 'readonly',
				TransformStream: 'readonly',
				CompressionStream: 'readonly',
				DecompressionStream: 'readonly',
				TextEncoder: 'readonly',
				TextDecoder: 'readonly',
				crypto: 'readonly',
				fetch: 'readonly',
				console: 'readonly',
				process: 'readonly',
				// Cloudflare Workers types
				KVNamespace: 'readonly',
				RequestInit: 'readonly',
				// TypeScript types
				Env: 'readonly',
				ExecutionContext: 'readonly',
				ExportedHandler: 'readonly',
				IncomingRequestCfProperties: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
			prettier: prettier,
		},
		rules: {
			// Disable base no-unused-vars in favor of TypeScript version
			'no-unused-vars': 'off',

			// Ban 'any' type usage - temporarily disabled for development
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',

			// Additional strict TypeScript rules
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/no-unnecessary-type-assertion': 'error',
			'@typescript-eslint/no-non-null-assertion': 'error',

			// General TypeScript recommendations
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/explicit-function-return-type': 'warn',

			// Prettier integration
			'prettier/prettier': 'error',
		},
	},
	{
		files: ['**/*.js'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				// Cloudflare Workers globals
				Request: 'readonly',
				Response: 'readonly',
				Headers: 'readonly',
				URL: 'readonly',
				URLSearchParams: 'readonly',
				FormData: 'readonly',
				Blob: 'readonly',
				File: 'readonly',
				ReadableStream: 'readonly',
				WritableStream: 'readonly',
				TransformStream: 'readonly',
				CompressionStream: 'readonly',
				DecompressionStream: 'readonly',
				TextEncoder: 'readonly',
				TextDecoder: 'readonly',
				crypto: 'readonly',
				fetch: 'readonly',
				console: 'readonly',
				process: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
		},
	},
];
