import { FishingSources } from '$lib/fishing_sources';

export type SceneFeature =
	| 'reeds'
	| 'lilypads'
	| 'boulders'
	| 'pebbles'
	| 'current'
	| 'trees'
	| 'hills'
	| 'jetty'
	| 'sandbar'
	| 'coral'
	| 'gulls'
	| 'buoy'
	| 'swell'
	| 'kelp'
	| 'sun'
	| 'rays'
	| 'stars';

export interface SceneConfig {
	/** Top and bottom of the sky gradient. */
	sky: [string, string];
	/** Surface, mid and deep water. */
	water: [string, string, string];
	/** Silhouettes, reeds, rocks — everything drawn against the water. */
	shore: string;
	/** Highlight colour: sun, foam, buoy. */
	accent: string;
	/** 0 → a puddle, 1 → the abyss. Drives the depth banding. */
	depth: number;
	/** Height of the surface waves, in SVG units. */
	swell: number;
	/** Where the waterline sits, 0 (top) to 1 (bottom). */
	horizon: number;
	features: SceneFeature[];
	/** How many drifting fish shapes live in the water column. */
	shoal: number;
	/** One line, shown under the scene. */
	mood: string;
}

/**
 * Eight scenes built from the same skeleton but tuned so no two read alike:
 * a warm shallow pond with reeds and lilies at one end, a near-black ocean
 * swell under starlight at the other. Everything is inline SVG and CSS — the
 * page ships no image files at all.
 */
export const SCENES: Record<FishingSources, SceneConfig> = {
	[FishingSources.MudPool]: {
		// Browner and flatter than anything else, and shallower than the Pond's
		// 0.12 — `guide.test.ts` asserts depth increases along SOURCE_ORDER.
		sky: ['#d8cfae', '#b3a276'],
		water: ['#8a7146', '#6b5533', '#4a3a22'],
		shore: '#3d3120',
		accent: '#c9b678',
		depth: 0.04,
		swell: 0.6,
		horizon: 0.3,
		features: ['reeds', 'pebbles', 'sun'],
		shoal: 2,
		mood: 'Brown, still, and barely knee deep. Whatever lives here is not hiding.'
	},
	[FishingSources.Pond]: {
		sky: ['#bfe3c4', '#8cc79c'],
		water: ['#6f9d5e', '#4e7a45', '#33552f'],
		shore: '#2c4429',
		accent: '#f6e27a',
		depth: 0.12,
		swell: 1.4,
		horizon: 0.34,
		features: ['reeds', 'lilypads', 'sun'],
		shoal: 3,
		mood: 'Flat, warm and shallow. You can see the bottom.'
	},
	[FishingSources.Stream]: {
		sky: ['#cfe6f2', '#9dc6dd'],
		water: ['#7fb4b0', '#4f8a8b', '#2f5c62'],
		shore: '#3a4a3c',
		accent: '#eaf6ff',
		depth: 0.2,
		swell: 1.1,
		horizon: 0.3,
		features: ['boulders', 'pebbles', 'current', 'trees'],
		shoal: 4,
		mood: 'Fast, clear and cold. The water never stops moving.'
	},
	[FishingSources.River]: {
		sky: ['#b9d3e6', '#8fb2cf'],
		water: ['#5f8fa8', '#3f6a83', '#264557'],
		shore: '#2f3f36',
		accent: '#dceaf5',
		depth: 0.34,
		swell: 1.8,
		horizon: 0.28,
		features: ['trees', 'current', 'boulders'],
		shoal: 5,
		mood: 'Wide and pulling. Something big uses this channel.'
	},
	[FishingSources.Lake]: {
		sky: ['#a8c4e0', '#7d9ec4'],
		water: ['#4a76a0', '#2f577f', '#16324a'],
		shore: '#25323f',
		accent: '#f2d9a0',
		depth: 0.46,
		swell: 0.9,
		horizon: 0.26,
		features: ['hills', 'jetty', 'rays'],
		shoal: 6,
		mood: 'Still enough to mirror the far shore. Deeper than it looks.'
	},
	[FishingSources.Lagoon]: {
		sky: ['#bfe9ee', '#7fd0d8'],
		water: ['#3fbfbf', '#1f97a8', '#12657a'],
		shore: '#1d4b52',
		accent: '#ffe9a8',
		depth: 0.5,
		swell: 1.2,
		horizon: 0.24,
		features: ['sandbar', 'coral', 'sun', 'rays'],
		shoal: 7,
		mood: 'Turquoise over white sand, walled off from the open sea.'
	},
	[FishingSources.Sea]: {
		sky: ['#9fbdd8', '#6f92b8'],
		water: ['#2f6f9e', '#1c4b76', '#0e2c49'],
		shore: '#1a2a3a',
		accent: '#f0f6ff',
		depth: 0.66,
		swell: 3.2,
		horizon: 0.22,
		features: ['gulls', 'swell', 'rays'],
		shoal: 7,
		mood: 'Salt in the air and no bottom in sight.'
	},
	[FishingSources.Offshore]: {
		sky: ['#7f93aa', '#54687f'],
		water: ['#1f4f78', '#123655', '#081d31'],
		shore: '#101b26',
		accent: '#ffd27a',
		depth: 0.82,
		swell: 4.6,
		horizon: 0.2,
		features: ['buoy', 'swell', 'gulls', 'kelp'],
		shoal: 6,
		mood: 'Grey water, long swell, and the coast well out of sight.'
	},
	[FishingSources.Ocean]: {
		sky: ['#2c3b52', '#16202f'],
		water: ['#123a5e', '#0b2740', '#03101d'],
		shore: '#080f18',
		accent: '#cfe3ff',
		depth: 1,
		swell: 6,
		horizon: 0.18,
		features: ['stars', 'swell', 'kelp', 'rays'],
		shoal: 5,
		mood: 'Black water under a cold sky. Whatever is down there is enormous.'
	}
};
