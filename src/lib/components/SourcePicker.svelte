<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { SOURCE_CONFIG, SOURCE_ORDER } from '$lib/game/config';
	import { catchTable, nextLockedSource } from '$lib/game/engine';
	import { sources } from '$lib/fishing_sources';
	import Num from './Num.svelte';

	const state = $derived(game.state);
	const next = $derived(nextLockedSource(state));
</script>

<section class="panel">
	<h2>Where you are fishing</h2>

	<ul class="sources">
		{#each SOURCE_ORDER as source (source)}
			{@const config = SOURCE_CONFIG[source]}
			{@const open = state.unlocked[source]}
			{@const isNext = next === source}
			{#if open || isNext}
				<li>
					{#if open}
						<button
							class="source"
							class:active={state.activeSource === source}
							aria-pressed={state.activeSource === source}
							onclick={() => game.setSource(source)}
						>
							<span class="name">{sources[source].name}</span>
							<span class="stats faint">
								{game.modifiers.castSeconds[source].toFixed(2)}s ·
								<Num
									value={catchTable(source, game.modifiers.luck).averageSourceValue}
									tone="coin"
								/> a fish
							</span>
						</button>
					{:else}
						<button
							class="source locked"
							disabled={!state.coins.gte(config.unlockCost)}
							onclick={() => game.unlock(source)}
						>
							<span class="name">Open the {sources[source].name}</span>
							<span class="stats faint">
								<Num value={config.unlockCost} tone="coin" /> MarketCoins
							</span>
						</button>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>

	<p class="blurb muted">{sources[state.activeSource].description.trim()}</p>
</section>

<style>
	.sources {
		display: grid;
		gap: 0.4rem;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
		margin: 0.6rem 0;
	}

	.source {
		width: 100%;
		display: grid;
		gap: 0.1rem;
		text-align: left;
		padding: 0.45rem 0.6rem;
	}

	.source.active {
		border-color: var(--brass);
		background: rgba(242, 181, 68, 0.12);
	}

	.source.locked {
		border-style: dashed;
	}

	.name {
		font-weight: 600;
		font-size: 0.92rem;
	}

	.stats {
		font-size: 0.75rem;
	}

	.blurb {
		font-size: 0.82rem;
		max-width: 60ch;
	}
</style>
