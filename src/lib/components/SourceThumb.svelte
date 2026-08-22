<script lang="ts">
	import type { FishingSources } from '$lib/fishing_sources';
	import { SCENES } from '$lib/game/scenes';

	interface Props {
		source: FishingSources;
		dimmed?: boolean;
	}

	let { source, dimmed = false }: Props = $props();

	const scene = $derived(SCENES[source]);
	const W = 48;
	const H = 32;
	const waterline = $derived(H * scene.horizon + 3);
</script>

<!-- The same palette as the full scene, so a source is recognisable in the list. -->
<svg class="thumb" class:dimmed viewBox="0 0 {W} {H}" aria-hidden="true">
	<defs>
		<linearGradient id="t-sky-{source}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={scene.sky[0]} />
			<stop offset="100%" stop-color={scene.sky[1]} />
		</linearGradient>
		<linearGradient id="t-water-{source}" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color={scene.water[0]} />
			<stop offset="100%" stop-color={scene.water[2]} />
		</linearGradient>
	</defs>
	<rect width={W} height={H} rx="4" fill="url(#t-sky-{source})" />
	<path
		d="M 0 {waterline} q 12 -{scene.swell} 24 0 q 12 {scene.swell} 24 0 L {W} {H} L 0 {H} Z"
		fill="url(#t-water-{source})"
	/>
	<rect
		x="0"
		y={H - (H - waterline) * scene.depth * 0.85}
		width={W}
		height={H}
		fill={scene.water[2]}
		opacity="0.5"
	/>
	<rect width={W} height={H} rx="4" fill="none" stroke="rgba(0,0,0,0.35)" />
</svg>

<style>
	.thumb {
		width: 3rem;
		height: 2rem;
		border-radius: 0.28rem;
		flex: none;
	}

	.dimmed {
		filter: grayscale(0.7) brightness(0.6);
	}
</style>
