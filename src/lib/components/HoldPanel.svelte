<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { FISH_TYPES, FishType, fishTypeBaseValue } from '$lib/fish_types';
	import Num from './Num.svelte';

	const state = $derived(game.state);
	const visible = $derived(FISH_TYPES.filter((type) => state.hold[type].gt(0)));
</script>

<section class="panel">
	<div class="head">
		<h2>The hold</h2>
		<button onclick={() => game.sell()} disabled={state.holdValue.lte(0)}>
			Sell · <Num value={state.holdValue.times(game.modifiers.sellMultiplier)} tone="coin" />
		</button>
	</div>

	<p class="faint note">
		Fish are sorted by size. The bigger the fish the more it fetches, and where you caught it
		matters more than what it is.
	</p>

	{#if visible.length === 0}
		<p class="muted empty">Empty. Hold the rod and put something in it.</p>
	{:else}
		<ul class="types">
			{#each visible as type (type)}
				<li class:worthless={fishTypeBaseValue[type] === 0}>
					<span class="label">{type}</span>
					<Num value={state.hold[type]} />
					{#if type === FishType.Jelly}
						<span class="faint tag">worthless</span>
					{:else if type === FishType.Erotic}
						<span class="tag rare">!</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		flex-wrap: wrap;
	}

	.note {
		font-size: 0.72rem;
		margin-top: 0.35rem;
		max-width: 56ch;
	}

	.empty {
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}

	.types {
		display: grid;
		gap: 0.25rem;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		margin-top: 0.6rem;
	}

	.types li {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		font-size: 0.85rem;
		padding: 0.25rem 0.45rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
	}

	.label {
		color: var(--ink-dim);
		flex: 1;
	}

	.worthless {
		opacity: 0.6;
	}

	.tag {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tag.rare {
		color: var(--coral);
		font-weight: 700;
	}
</style>
