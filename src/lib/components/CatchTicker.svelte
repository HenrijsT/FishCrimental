<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { FishType } from '$lib/fish_types';
	import Num from './Num.svelte';
</script>

<section class="panel ticker" aria-live="polite" aria-label="Recent catches">
	<h3>On the line</h3>
	{#if game.recentCatches.length === 0}
		<p class="faint idle">Nothing yet.</p>
	{:else}
		<ul>
			{#each game.recentCatches as entry (entry.id)}
				<li class:jelly={entry.fish.category === FishType.Jelly}>
					<span class="what">{entry.fish.name}</span>
					{#if entry.count.gt(1)}<span class="faint">×<Num value={entry.count} /></span>{/if}
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
	{/if}
</section>

<style>
	.ticker {
		font-size: 0.82rem;
	}

	.idle {
		margin-top: 0.4rem;
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

	.what {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.jelly .what {
		color: var(--ink-faint);
	}

	.worth {
		font-variant-numeric: tabular-nums;
	}
</style>
