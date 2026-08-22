<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { formatDuration } from '$lib/format';
	import Num from './Num.svelte';

	const state = $derived(game.state);
</script>

<header class="bar">
	<div class="brand">
		<h1>FishCrimental</h1>
		<p class="faint tagline">a fishing incremental</p>
	</div>

	<dl class="readout">
		<div>
			<dt>MarketCoins</dt>
			<dd><Num value={state.coins} tone="coin" /></dd>
		</div>
		<div>
			<dt>Crew income</dt>
			<dd><Num value={game.incomePerSecond} tone="coin" />/s</dd>
		</div>
		<div>
			<dt>At sea</dt>
			<dd>{formatDuration(state.playTime)}</dd>
		</div>
	</dl>
</header>

<style>
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--gap);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--edge);
	}

	.tagline {
		font-size: 0.72rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.readout {
		display: flex;
		flex-wrap: wrap;
		gap: 1.1rem;
		margin: 0;
	}

	dt {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}

	dd {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
