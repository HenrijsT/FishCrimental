<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { FishType } from '$lib/fish_types';
	import { RARITY_LABEL } from '$lib/game/engine';
	import Num from './Num.svelte';
</script>

<section class="panel ticker" aria-live="polite" aria-label="Recent catches">
	<h3>On your line</h3>
	{#if game.recentCatches.length === 0}
		<p class="faint idle">Nothing yet. Hold the rod and something will turn up.</p>
	{:else}
		<ul>
			{#each game.recentCatches as entry (entry.id)}
				<li class="rarity-{entry.rarity}" class:jelly={entry.fish.category === FishType.Jelly}>
					<span class="pip" aria-hidden="true"></span>
					<span class="what" title={RARITY_LABEL[entry.rarity]}>{entry.fish.name}</span>
					{#if entry.count.gt(1)}<span class="faint count">×<Num value={entry.count} /></span>{/if}
					<span class="worth">
						{#if entry.fish.category === FishType.Jelly}
							<span class="faint">nothing</span>
						{:else}
							<Num value={entry.value} tone="coin" />
						{/if}
					</span>
				</li>
			{/each}
		</ul>
		<p class="legend faint">
			<span class="key rarity-common"><span class="pip"></span>common</span>
			<span class="key rarity-rare"><span class="pip"></span>rare</span>
			<span class="key rarity-mythic"><span class="pip"></span>one in a million</span>
		</p>
	{/if}
</section>

<style>
	.ticker {
		font-size: 0.82rem;
	}

	.idle {
		margin-top: 0.4rem;
		font-size: 0.78rem;
	}

	ul {
		display: grid;
		gap: 0.15rem;
		margin-top: 0.5rem;
	}

	li {
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
	}

	.pip {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 999px;
		background: var(--ink-faint);
		flex: none;
	}

	.what {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		font-size: 0.75rem;
	}

	.jelly .what {
		color: var(--ink-faint);
	}

	.worth {
		font-variant-numeric: tabular-nums;
	}

	.rarity-uncommon .pip {
		background: #6fb3d8;
	}

	.rarity-rare .pip {
		background: var(--foam);
	}
	.rarity-rare .what {
		color: var(--foam);
	}

	.rarity-exotic .pip {
		background: var(--pearl);
	}
	.rarity-exotic .what {
		color: var(--pearl);
		font-weight: 600;
	}

	.rarity-mythic .pip {
		background: var(--brass);
		box-shadow: 0 0 0.4rem var(--brass);
	}
	.rarity-mythic .what {
		color: var(--brass);
		font-weight: 700;
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 0.6rem;
		font-size: 0.66rem;
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}
</style>
