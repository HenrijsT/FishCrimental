import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],

	// Under Vitest, resolve Svelte to its client build.
	//
	// Without this `mount()` comes from `index-server.js` and throws
	// `lifecycle_function_unavailable`, so no test can render a component — which
	// is how a dead `{#if}` in SourcePicker hid an entire subsystem behind six
	// hundred green tests. See `src/lib/components/render.test.ts`.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,

	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Engine tests stay in `node`; component tests opt in per file with
		// `// @vitest-environment jsdom`.
		environment: 'node'
	}
});
