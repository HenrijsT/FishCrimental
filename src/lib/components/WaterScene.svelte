<script lang="ts">
	import type { FishingSources } from '$lib/fishing_sources';
	import { SCENES } from '$lib/game/scenes';

	interface Props {
		source: FishingSources;
		/** `idle` waiting, `casting` line in the water, `landing` a fish coming up. */
		phase?: 'idle' | 'casting' | 'landing';
		/** 0 → 1 through the current cast. */
		progress?: number;
		still?: boolean;
	}

	let { source, phase = 'idle', progress = 0, still = false }: Props = $props();

	const scene = $derived(SCENES[source]);
	const has = $derived((feature: string) => scene.features.includes(feature as never));

	const W = 320;
	const H = 150;
	const waterline = $derived(H * scene.horizon);

	/** The float arcs out on the cast and sits still while the line is down. */
	const floatX = $derived(96 + 150 * Math.min(1, progress * 3));
	const floatLift = $derived(
		phase === 'casting' && progress < 0.34 ? Math.sin(progress * 9.2) * 26 : 0
	);

	function wave(y: number, amplitude: number, offset: number): string {
		const step = W / 4;
		let path = `M -${step} ${y}`;
		for (let i = -1; i < 5; i++) {
			path += ` q ${step / 2} ${i % 2 === 0 ? -amplitude : amplitude} ${step} 0`;
		}
		return path + ` L ${W + step} ${H} L -${step} ${H} Z` + (offset ? '' : '');
	}

	/** Deterministic scatter so the scene does not reshuffle on every render. */
	function scatter(index: number, seed: number): number {
		return (((Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453) % 1) + 1) % 1;
	}
</script>

<div class="scene" class:still class:landing={phase === 'landing'} data-source={source}>
	<svg viewBox="0 0 {W} {H}" role="img" aria-label={scene.mood} preserveAspectRatio="none">
		<defs>
			<linearGradient id="sky-{source}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color={scene.sky[0]} />
				<stop offset="100%" stop-color={scene.sky[1]} />
			</linearGradient>
			<linearGradient id="water-{source}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color={scene.water[0]} />
				<stop offset="45%" stop-color={scene.water[1]} />
				<stop offset="100%" stop-color={scene.water[2]} />
			</linearGradient>
			<linearGradient id="ray-{source}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color={scene.accent} stop-opacity="0.24" />
				<stop offset="100%" stop-color={scene.accent} stop-opacity="0" />
			</linearGradient>
			<clipPath id="clip-{source}">
				<rect x="0" y={waterline} width={W} height={H - waterline} />
			</clipPath>
		</defs>

		<rect width={W} height={waterline + 2} fill="url(#sky-{source})" />

		{#if has('sun')}
			<circle cx="252" cy={waterline * 0.42} r="11" fill={scene.accent} opacity="0.85" />
		{/if}

		{#if has('stars')}
			{#each Array(14), i (i)}
				<circle
					cx={scatter(i, 3) * W}
					cy={scatter(i, 7) * waterline * 0.9}
					r={0.6 + scatter(i, 11) * 0.9}
					fill={scene.accent}
					opacity={0.35 + scatter(i, 13) * 0.5}
				/>
			{/each}
		{/if}

		{#if has('hills')}
			<path
				d="M 0 {waterline} L 44 {waterline - 15} L 86 {waterline - 5} L 128 {waterline -
					20} L 182 {waterline - 7} L 240 {waterline - 17} L 320 {waterline} Z"
				fill={scene.shore}
				opacity="0.55"
			/>
		{/if}

		{#if has('trees')}
			{#each Array(7), i (i)}
				{@const x = 6 + i * 46 + scatter(i, 5) * 14}
				{@const h = 14 + scatter(i, 9) * 12}
				<path
					d="M {x} {waterline} l -6 -{h * 0.55} l 3 0 l -4 -{h * 0.5} l 3 0 l -3 -{h *
						0.45} l 6 0 l -3 {h * 0.45} l 3 0 l -4 {h * 0.5} l 3 0 l -6 {h * 0.55} Z"
					fill={scene.shore}
					opacity="0.7"
				/>
			{/each}
		{/if}

		{#if has('gulls')}
			{#each Array(3), i (i)}
				{@const x = 40 + i * 84}
				{@const y = waterline * (0.28 + scatter(i, 4) * 0.3)}
				<path
					class="gull"
					style="--i: {i}"
					d="M {x} {y} q 5 -4 9 0 q 4 -4 9 0"
					fill="none"
					stroke={scene.shore}
					stroke-width="1.2"
					opacity="0.6"
				/>
			{/each}
		{/if}

		<!-- Water column -->
		<rect x="0" y={waterline} width={W} height={H - waterline} fill="url(#water-{source})" />

		<g clip-path="url(#clip-{source})">
			{#if has('rays')}
				{#each Array(3), i (i)}
					<polygon
						class="ray"
						style="--i: {i}"
						points="{60 + i * 90},{waterline} {84 + i * 90},{waterline} {110 + i * 90},{H} {44 +
							i * 90},{H}"
						fill="url(#ray-{source})"
					/>
				{/each}
			{/if}

			<!-- Depth banding: the deeper the source, the more of the column is dark -->
			<rect
				x="0"
				y={waterline + (H - waterline) * (1 - scene.depth) * 0.8}
				width={W}
				height={H}
				fill={scene.water[2]}
				opacity={0.25 + scene.depth * 0.55}
			/>

			{#if has('sandbar')}
				<path
					d="M 0 {H - 14} q 80 -18 160 -4 q 80 14 160 -6 L 320 {H} L 0 {H} Z"
					fill="#e8dcb0"
					opacity="0.75"
				/>
			{/if}

			{#if has('pebbles')}
				{#each Array(12), i (i)}
					<ellipse
						cx={scatter(i, 2) * W}
						cy={H - 4 - scatter(i, 6) * 10}
						rx={2 + scatter(i, 8) * 3}
						ry={1.4 + scatter(i, 10) * 1.6}
						fill={scene.shore}
						opacity="0.5"
					/>
				{/each}
			{/if}

			{#if has('boulders')}
				{#each Array(4), i (i)}
					<ellipse
						cx={30 + i * 82 + scatter(i, 1) * 20}
						cy={H - 6 - scatter(i, 3) * 16}
						rx={12 + scatter(i, 5) * 10}
						ry={7 + scatter(i, 7) * 5}
						fill={scene.shore}
						opacity="0.72"
					/>
				{/each}
			{/if}

			{#if has('coral')}
				{#each Array(5), i (i)}
					{@const x = 24 + i * 62}
					<path
						d="M {x} {H} l 0 -14 m 0 6 l -7 -8 m 7 2 l 8 -9"
						stroke="#e8746a"
						stroke-width="2.4"
						fill="none"
						opacity="0.7"
						stroke-linecap="round"
					/>
				{/each}
			{/if}

			{#if has('kelp')}
				{#each Array(4), i (i)}
					<path
						class="kelp"
						style="--i: {i}"
						d="M {26 + i * 84} {H} q 8 -22 -2 -40 q -8 -18 4 -34"
						stroke={scene.shore}
						stroke-width="3"
						fill="none"
						opacity="0.5"
						stroke-linecap="round"
					/>
				{/each}
			{/if}

			{#if has('reeds')}
				{#each Array(9), i (i)}
					{@const x = 4 + i * 12 + scatter(i, 1) * 6}
					{@const h = 22 + scatter(i, 4) * 20}
					<path
						class="reed"
						style="--i: {i}"
						d="M {x} {H} q 3 -{h * 0.6} 1 -{h}"
						stroke="#3f6b34"
						stroke-width="2"
						fill="none"
						stroke-linecap="round"
					/>
				{/each}
				{#each Array(6), i (i)}
					{@const x = W - 6 - i * 13 - scatter(i, 2) * 8}
					{@const h = 20 + scatter(i, 6) * 18}
					<path
						class="reed"
						style="--i: {i + 4}"
						d="M {x} {H} q -3 -{h * 0.6} -1 -{h}"
						stroke="#3f6b34"
						stroke-width="2"
						fill="none"
						stroke-linecap="round"
					/>
				{/each}
			{/if}

			<!-- The shoal -->
			{#each Array(scene.shoal), i (i)}
				{@const y = waterline + 12 + scatter(i, 21) * (H - waterline - 20)}
				{@const s = 0.7 + scatter(i, 23) * 0.9}
				<g class="fish" style="--i: {i}; --delay: {-scatter(i, 27) * 26}s">
					<path
						d="M 0 0 q 7 -4 14 0 q -7 4 -14 0 M 14 0 l 5 -3 l 0 6 Z"
						transform="translate(0 {y}) scale({s})"
						fill={scene.water[2]}
						opacity={0.45 + scatter(i, 29) * 0.3}
					/>
				</g>
			{/each}
		</g>

		{#if has('lilypads')}
			{#each Array(4), i (i)}
				{@const x = 22 + i * 74 + scatter(i, 15) * 18}
				{@const y = waterline + 8 + scatter(i, 17) * 22}
				<ellipse class="lily" style="--i: {i}" cx={x} cy={y} rx="13" ry="4.4" fill="#2f6b3a" />
				<path d="M {x} {y} l 0 -4" stroke="#2f6b3a" stroke-width="1" />
			{/each}
		{/if}

		{#if has('jetty')}
			<g opacity="0.85">
				<rect x="0" y={waterline - 4} width="74" height="4" fill={scene.shore} />
				{#each Array(3), i (i)}
					<rect x={12 + i * 24} y={waterline - 2} width="3" height="14" fill={scene.shore} />
				{/each}
			</g>
		{/if}

		{#if has('buoy')}
			<g class="buoy">
				<rect x="262" y={waterline - 14} width="6" height="16" rx="2" fill={scene.accent} />
				<circle cx="265" cy={waterline - 17} r="3.4" fill="#e8746a" />
			</g>
		{/if}

		<!-- Surface -->
		<path
			class="surface back"
			d={wave(waterline + 1, scene.swell * 0.6, 0)}
			fill={scene.water[0]}
			opacity="0.55"
		/>
		<path
			class="surface front"
			d={wave(waterline + 3, scene.swell, 1)}
			fill={scene.water[0]}
			opacity="0.85"
		/>

		{#if has('current')}
			{#each Array(5), i (i)}
				<path
					class="current"
					style="--i: {i}"
					d="M {-20 + i * 70} {waterline + 12 + i * 4} q 18 -3 36 0"
					stroke={scene.accent}
					stroke-width="1.2"
					fill="none"
					opacity="0.35"
				/>
			{/each}
		{/if}

		<!-- The rod, the line and the float -->
		{#if phase !== 'idle'}
			<g class="tackle">
				<path
					d="M 22 {waterline + 18} L 96 {waterline - 40}"
					stroke="#c8a469"
					stroke-width="2.4"
					stroke-linecap="round"
				/>
				<path
					d="M 96 {waterline - 40} Q {(96 + floatX) / 2} {waterline -
						40 -
						floatLift} {floatX} {waterline - 2}"
					stroke={scene.accent}
					stroke-width="1"
					fill="none"
					opacity="0.8"
				/>
				<circle cx={floatX} cy={waterline - 2} r="3.6" fill="#e8746a" />
				<circle cx={floatX} cy={waterline - 2} r="1.6" fill="#fff" opacity="0.9" />
				{#if progress > 0.35}
					<ellipse
						class="ripple"
						cx={floatX}
						cy={waterline + 1}
						rx="10"
						ry="3"
						fill="none"
						stroke={scene.accent}
						stroke-width="1"
						opacity="0.5"
					/>
				{/if}
			</g>
		{/if}

		{#if phase === 'landing'}
			<g class="splash">
				<ellipse
					cx={floatX}
					cy={waterline}
					rx="16"
					ry="5"
					fill="none"
					stroke={scene.accent}
					stroke-width="1.6"
				/>
				<path
					d="M {floatX - 9} {waterline - 3} l -3 -9 M {floatX} {waterline - 5} l 0 -12 M {floatX +
						9} {waterline - 3} l 3 -9"
					stroke={scene.accent}
					stroke-width="1.6"
					stroke-linecap="round"
				/>
			</g>
		{/if}
	</svg>
</div>

<style>
	.scene {
		position: relative;
		border-radius: var(--radius);
		overflow: hidden;
		border: 1px solid var(--edge);
		line-height: 0;
	}

	svg {
		width: 100%;
		height: clamp(7rem, 22vw, 10.5rem);
		display: block;
	}

	.surface {
		animation: drift 9s linear infinite;
	}

	.surface.back {
		animation-duration: 14s;
		animation-direction: reverse;
	}

	.fish {
		animation: swim 26s linear infinite;
		animation-delay: var(--delay);
	}

	.reed,
	.kelp {
		transform-origin: bottom center;
		animation: sway 6s ease-in-out infinite;
		animation-delay: calc(var(--i) * -0.7s);
	}

	.kelp {
		animation-duration: 9s;
	}

	.lily {
		animation: bob 5s ease-in-out infinite;
		animation-delay: calc(var(--i) * -1.2s);
	}

	.buoy {
		transform-origin: center bottom;
		animation: bob 3.4s ease-in-out infinite;
	}

	.gull {
		animation: glide 22s linear infinite;
		animation-delay: calc(var(--i) * -7s);
	}

	.current {
		animation: rush 3.2s linear infinite;
		animation-delay: calc(var(--i) * -0.6s);
	}

	.ray {
		animation: shimmer 8s ease-in-out infinite;
		animation-delay: calc(var(--i) * -2.6s);
	}

	.ripple {
		animation: spread 1.6s ease-out infinite;
	}

	.splash {
		animation: pop 420ms ease-out;
	}

	@keyframes drift {
		to {
			transform: translateX(-80px);
		}
	}

	@keyframes swim {
		from {
			transform: translateX(-30px);
		}
		to {
			transform: translateX(350px);
		}
	}

	@keyframes sway {
		0%,
		100% {
			transform: rotate(-3deg);
		}
		50% {
			transform: rotate(3deg);
		}
	}

	@keyframes bob {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}

	@keyframes glide {
		from {
			transform: translateX(-40px);
		}
		to {
			transform: translateX(360px);
		}
	}

	@keyframes rush {
		from {
			transform: translateX(0);
			opacity: 0;
		}
		25% {
			opacity: 0.4;
		}
		to {
			transform: translateX(70px);
			opacity: 0;
		}
	}

	@keyframes shimmer {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	@keyframes spread {
		from {
			transform: scale(0.4);
			opacity: 0.7;
		}
		to {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	@keyframes pop {
		from {
			transform: scale(0.5);
			opacity: 1;
		}
		to {
			transform: scale(1.5);
			opacity: 0;
		}
	}

	/* The in-game setting and the OS preference both stop everything moving. */
	.still :global(*),
	:global(.reduce-motion) .scene :global(*) {
		animation: none !important;
	}

	@media (prefers-reduced-motion: reduce) {
		.scene :global(*) {
			animation: none !important;
		}
	}
</style>
