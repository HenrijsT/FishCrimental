<script lang="ts">
	import { MAP_MAX_LEVEL } from '$lib/game/config';
	import { chartedSources, mapAccuracy, mapOffset, sourceBlocker } from '$lib/game/engine';
	import { SCENES } from '$lib/game/scenes';
	import { sources } from '$lib/fishing_sources';
	import { game } from '$lib/game/state.svelte';
	import Num from './Num.svelte';

	const g = $derived(game.state);
	const level = $derived(g.mapLevel);
	const maxed = $derived(level.gte(MAP_MAX_LEVEL));
	const accuracy = $derived(mapAccuracy(level));

	/** Home sits where the mud pool is, because that is the whole story. */
	const HOME = { x: 0.06, y: 0.9 };

	const charted = $derived(
		chartedSources(g).map((source) => {
			const truth = SCENES[source].at;
			const drift = mapOffset(source, g.startedAt, level);
			return {
				source,
				open: g.unlocked[source],
				blocked: sourceBlocker(g, source, game.modifiers),
				x: Math.min(0.97, Math.max(0.03, truth.x + drift.dx)),
				y: Math.min(0.94, Math.max(0.06, truth.y + drift.dy))
			};
		})
	);

	/** The paper runs out somewhere past the last thing you know about. */
	const edge = $derived(Math.min(1, Math.max(...charted.map((p) => p.x)) + 0.12));
</script>

<section class="panel">
	<div class="head">
		<h2>The chart</h2>
		<span class="level">
			{#if maxed}
				surveyed properly
			{:else}
				{Math.round(accuracy * 100)}% accurate
			{/if}
		</span>
	</div>

	<svg viewBox="0 0 100 60" role="img" aria-label="A chart of the water you know about">
		<rect x="0" y="0" width="100" height="60" class="paper" />

		<!-- Beyond the edge of the paper there is nothing drawn, because as far
		     as this chart is concerned there is nothing there. -->
		{#if edge < 1}
			<rect x={edge * 100} y="0" width={(1 - edge) * 100} height="60" class="unknown" />
			<line x1={edge * 100} y1="0" x2={edge * 100} y2="60" class="edge" />
			<text x={Math.min(97, edge * 100 + 2)} y="30" class="edge-label">?</text>
		{/if}

		<!-- Home. -->
		<g class="place home" transform="translate({HOME.x * 100} {HOME.y * 60})">
			<path d="M -2.6 1.6 L 0 -1.4 L 2.6 1.6 Z" />
			<rect x="-1.8" y="1.4" width="3.6" height="2.4" />
			<text y="7">Home</text>
		</g>

		{#each charted as place (place.source)}
			{@const cx = place.x * 100}
			{@const cy = place.y * 60}
			<g
				class="place"
				class:open={place.open}
				class:active={g.activeSource === place.source}
				class:blocked={place.blocked !== null}
				transform="translate({cx} {cy})"
			>
				<circle r={place.open ? 2.4 : 1.8} />
				<text y={-3.4}>{sources[place.source].name}</text>
			</g>
		{/each}
	</svg>

	<ul class="places">
		{#each charted as place (place.source)}
			<li>
				<button
					class:active={g.activeSource === place.source}
					disabled={!place.open || place.blocked !== null}
					onclick={() => game.setSource(place.source)}
				>
					<span class="name">{sources[place.source].name}</span>
					{#if !place.open}
						<span class="tag faint">not yours yet</span>
					{:else if place.blocked === 'fuel'}
						<span class="tag">no fuel</span>
					{:else if place.blocked === 'boat'}
						<span class="tag">needs a boat</span>
					{:else if place.blocked === 'licence'}
						<span class="tag">needs paper</span>
					{:else if g.activeSource === place.source}
						<span class="tag here">you are here</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>

	<div class="buy">
		<p class="muted small">
			{#if maxed}
				Everything is where the chart says it is, and the paper reaches as far as you can.
			{:else}
				Places are drawn roughly where they are, and the paper runs out early. A better chart moves
				them closer to the truth and shows more of what is out there — it will not tell you what
				anything is worth.
			{/if}
		</p>
		{#if !maxed}
			<button onclick={() => game.buyMap()} disabled={g.coins.lt(game.mapPrice)}>
				Better chart · <Num value={game.mapPrice} tone="coin" />
			</button>
		{/if}
	</div>
</section>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	h2 {
		font-size: 1rem;
	}

	.level {
		font-size: 0.72rem;
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
		margin: 0.5rem 0;
		border: 1px solid var(--edge);
		border-radius: var(--radius-sm);
	}

	.paper {
		fill: #12283f;
	}

	.unknown {
		fill: #0a1a2a;
	}

	.edge {
		stroke: var(--edge);
		stroke-width: 0.3;
		stroke-dasharray: 1.2 1.2;
	}

	.edge-label {
		fill: var(--ink-faint);
		font-size: 4px;
		text-anchor: middle;
		dominant-baseline: middle;
	}

	.place circle {
		fill: #23496f;
		stroke: var(--edge);
		stroke-width: 0.4;
	}

	.place.open circle {
		fill: var(--foam);
		stroke: none;
	}

	.place.blocked circle {
		fill: var(--brass-dim);
	}

	.place.active circle {
		fill: var(--brass);
		stroke: var(--ink);
		stroke-width: 0.5;
	}

	.place text {
		fill: var(--ink-dim);
		font-size: 3px;
		text-anchor: middle;
	}

	.place.open text {
		fill: var(--ink);
	}

	.home path,
	.home rect {
		fill: var(--ink-dim);
	}

	.places {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.places button {
		display: inline-flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.78rem;
		padding: 0.25rem 0.55rem;
	}

	.places button.active {
		border-color: var(--brass);
		background: rgba(242, 181, 68, 0.16);
	}

	.tag {
		font-size: 0.62rem;
		color: var(--brass);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.tag.here {
		color: var(--foam);
	}

	.buy {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		flex-wrap: wrap;
		border-top: 1px solid var(--edge);
		padding-top: 0.6rem;
	}

	.small {
		font-size: 0.75rem;
		max-width: 58ch;
	}
</style>
