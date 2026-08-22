import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	...svelte.configs['flat/prettier'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		// Svelte 5 runes also live in `.svelte.ts` / `.svelte.js` modules, which
		// eslint-plugin-svelte parses — they still need the TypeScript parser.
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		// `.claude/` is harness scratch space — agent worktrees land there, and a
		// nested repo brings its own tsconfig, which makes the TS parser refuse
		// to pick a root. It is not project source.
		ignores: ['build/', '.svelte-kit/', 'dist/', '.claude/']
	}
];
