<script lang="ts">
	import { FISH_TYPES, fishTypeBaseValue } from '$lib/fish_types';
	import { sources } from '$lib/fishing_sources';
	import {
		ALL_SPECIES,
		DEX_BONUS_PER_SPECIES,
		SPECIES_BY_TYPE,
		dexMultiplier
	} from '$lib/game/engine';
	import { game } from '$lib/game/state.svelte';
	import { formatPercent } from '$lib/format';
	import Num from './Num.svelte';

	// Named `g`, not `state`: in a Svelte component `$state` would be read as a
	// store subscription to a local called `state`, which collides with the rune.
	const g = $derived(game.state);
	const found = $derived(game.discovered);
	const total = ALL_SPECIES.length;

	let expanded = $state<string | null>(null);

	function caught(name: string) {
		return g.dex[name];
	}
</script>

<section class="panel">
	<div class="head">
		<h2>Fishdex</h2>
		<p class="score">
			{found} / {total} ·
			<span class="bonus">sale value <Num value={dexMultiplier(g)} />×</span>
		</p>
	</div>

	<p class="muted intro">
		Landing a species for the first time writes it up here and adds a permanent
		{formatPercent(DEX_BONUS_PER_SPECIES, 2)} to everything you sell.
	</p>

	{#each FISH_TYPES as type (type)}
		{@const species = SPECIES_BY_TYPE[type]}
		{#if species.length > 0}
			<h3 class="group">
				{type}
				<span class="worth faint">
					{#if fishTypeBaseValue[type] === 0}
						worth nothing
					{:else}
						{fishTypeBaseValue[type]} coins base
					{/if}
				</span>
			</h3>

			<ul class="grid">
				{#each species as fish (fish.name)}
					{@const count = caught(fish.name)}
					{@const known = count !== undefined && count.gte(1)}
					<li>
						<button
							class="entry"
							class:known
							aria-expanded={expanded === fish.name}
							disabled={!known}
							onclick={() => (expanded = expanded === fish.name ? null : fish.name)}
						>
							<span class="fish-name">{known ? fish.name : '???'}</span>
							{#if known}
								<span class="count faint"><Num value={count} /></span>
							{/if}
						</button>

						{#if expanded === fish.name && known}
							<div class="detail">
								<p>{fish.description}</p>
								<p class="where faint">
									Found in: {fish.sources.map((source) => sources[source].name).join(', ')}
								</p>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/each}

	{#if found >= total}
		<p class="complete">
			Every species logged. There is nothing left in the water you have not met.
		</p>
	{/if}
</section>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--gap);
		flex-wrap: wrap;
	}

	.score {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.bonus {
		color: var(--foam);
	}

	.intro {
		font-size: 0.78rem;
		margin: 0.35rem 0 0.8rem;
		max-width: 62ch;
	}

	.group {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0.9rem 0 0.35rem;
	}

	.worth {
		font-size: 0.68rem;
		text-transform: none;
		letter-spacing: 0;
	}

	.grid {
		display: grid;
		gap: 0.3rem;
		grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
	}

	.entry {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: 0.4rem;
		align-items: baseline;
		font-size: 0.8rem;
		padding: 0.3rem 0.5rem;
		text-align: left;
		background: rgba(4, 16, 27, 0.5);
		border-color: transparent;
	}

	.entry:disabled {
		opacity: 0.35;
		color: var(--ink-faint);
	}

	.entry.known {
		border-color: var(--edge);
	}

	.fish-name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		font-size: 0.7rem;
	}

	.detail {
		grid-column: 1 / -1;
		font-size: 0.78rem;
		line-height: 1.5;
		padding: 0.5rem 0.6rem;
		margin-top: 0.25rem;
		border-left: 2px solid var(--brass);
		background: rgba(4, 16, 27, 0.5);
		display: grid;
		gap: 0.35rem;
	}

	.where {
		font-size: 0.72rem;
	}

	.complete {
		margin-top: 1rem;
		color: var(--brass);
		font-size: 0.85rem;
	}
</style>
