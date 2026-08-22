import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: [vitePreprocess({})],

	kit: {
		// Every route is prerendered, so no SPA fallback is needed — one used to
		// be configured, and it overwrote the prerendered index.html with an
		// empty shell.
		adapter: adapterStatic({
			pages: 'build/static',
			assets: 'build/static'
		}),

		prerender: {
			handleHttpError: 'warn'
		}
	}
};

export default config;
