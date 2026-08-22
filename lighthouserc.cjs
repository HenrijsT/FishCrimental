/**
 * `pnpm audit:ui` — Lighthouse against the production preview build.
 *
 * Thresholds come from the build brief: performance, accessibility and
 * best-practices must all score at least 0.9.
 */
module.exports = {
	ci: {
		collect: {
			startServerCommand: 'pnpm preview --port 4173',
			startServerReadyPattern: 'Local:',
			url: ['http://localhost:4173/'],
			numberOfRuns: 3,
			settings: {
				preset: 'desktop',
				chromeFlags: '--no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage'
			}
		},
		assert: {
			assertions: {
				'categories:performance': ['error', { minScore: 0.9 }],
				'categories:accessibility': ['error', { minScore: 0.9 }],
				'categories:best-practices': ['error', { minScore: 0.9 }]
			}
		},
		upload: { target: 'filesystem', outputDir: './build/lighthouse' }
	}
};
