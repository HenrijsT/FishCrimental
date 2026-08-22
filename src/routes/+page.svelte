<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from '$lib/game/state.svelte';
	import { SOURCE_CONFIG, SOURCE_ORDER } from '$lib/game/config';
	import { FISH_TYPES } from '$lib/fish_types';
	import { sources } from '$lib/fishing_sources';
	import { formatDuration, formatNumber } from '$lib/format';

	onMount(() => {
		game.init();
		return () => game.stop();
	});

	const state = $derived(game.state);
	const report = $derived(game.offlineReport);
</script>

<svelte:head>
	<title>FishCrimental</title>
	<meta name="description" content="A fishing incremental. Cast, sell, upgrade, go deeper." />
</svelte:head>

<main>
	<h1>FishCrimental</h1>

	{#if report}
		<section class="modal">
			<h2>While you were away</h2>
			<p>
				Your crew worked for {formatDuration(report.cappedSeconds)} and landed
				{formatNumber(report.fish)} fish, sold dockside for
				<strong>{formatNumber(report.coins)}</strong> MarketCoins.
			</p>
			<button onclick={() => game.dismissOfflineReport()}>Back to it</button>
		</section>
	{/if}

	<p class="coins">{formatNumber(state.coins)} MarketCoins</p>
	<p>Income: {formatNumber(game.incomePerSecond)}/s · Played {formatDuration(state.playTime)}</p>

	<label>
		Source
		<select
			value={state.activeSource}
			onchange={(event) => game.setSource(event.currentTarget.value as never)}
		>
			{#each SOURCE_ORDER as source (source)}
				{#if state.unlocked[source]}
					<option value={source}>{sources[source].name}</option>
				{/if}
			{/each}
		</select>
	</label>

	<div class="bar" role="progressbar" aria-valuenow={Math.round(game.castProgress * 100)}>
		<div class="fill" style:width="{game.castProgress * 100}%"></div>
	</div>

	<button
		onpointerdown={() => game.beginCast()}
		onpointerup={() => game.endCast()}
		onpointerleave={() => game.endCast()}
	>
		Hold to fish ({game.activeCastSeconds.toFixed(2)}s)
	</button>
	<button onclick={() => game.sell()}>Sell hold ({formatNumber(state.holdValue)})</button>

	<ul>
		{#each FISH_TYPES as type (type)}
			<li>{type}: {formatNumber(state.hold[type])}</li>
		{/each}
	</ul>

	<p>
		Deckhands: {formatNumber(state.deckhands[state.activeSource])} · Unlock cost of next source:
		{formatNumber(SOURCE_CONFIG[state.activeSource].unlockCost)}
	</p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 1rem;
	}

	.coins {
		font-size: 1.5rem;
		font-weight: 600;
	}

	.bar {
		height: 0.75rem;
		border: 1px solid #3a6ea5;
		border-radius: 0.5rem;
		overflow: hidden;
		margin: 0.75rem 0;
	}

	.fill {
		height: 100%;
		background: #3a6ea5;
	}

	.modal {
		border: 1px solid #3a6ea5;
		padding: 1rem;
		border-radius: 0.5rem;
	}
</style>
