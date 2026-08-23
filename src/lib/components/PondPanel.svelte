<script lang="ts">
	import { POND_MAX, POND_MAX_LEVEL } from '$lib/game/config';
	import { pondIncomePerSecond, pondLevelCost, pondRate } from '$lib/game/engine';
	import { speciesPrice } from '$lib/game/market';
	import { game } from '$lib/game/state.svelte';
	import Num from './Num.svelte';

	const g = $derived(game.state);
	const full = $derived(g.ponds.length >= POND_MAX);
</script>

{#if game.pondsOpen}
	<section class="panel">
		<h2>Ponds</h2>

		<p class="muted intro">
			A deckhand lands whatever comes up. A pond lands exactly what you told it to. Dig one, stock
			it with a fish you have caught, and it breeds that fish for you — awake or asleep.
		</p>

		<p class="faint small">
			A pond is a machine for producing one species, and the market charges for exactly that. Stock
			six ponds with the same fish and you will watch its price fall all run. Spread them, or leave
			one fallow while its price comes back. Restocking is free and takes effect at once.
		</p>

		{#if g.ponds.length === 0}
			<p class="muted empty">No ponds yet.</p>
		{:else}
			<ul class="ponds">
				{#each g.ponds as pond, index (index)}
					{@const maxed = pond.level.gte(POND_MAX_LEVEL)}
					{@const cost = pondLevelCost(pond.level)}
					<li>
						<div class="text">
							<h3 class="name">
								Pond {index + 1}
								<span class="level">lv {pond.level.toFixed(0)}{maxed ? ' · max' : ''}</span>
							</h3>

							<label class="stock">
								<span class="faint">Stocked with</span>
								<select
									value={pond.species ?? ''}
									onchange={(event) => game.stockPond(index, event.currentTarget.value || null)}
								>
									<option value="">Nothing</option>
									{#each game.stockable as name (name)}
										<option value={name}>{name}</option>
									{/each}
								</select>
							</label>

							{#if pond.species}
								<p class="effect">
									<Num value={pondRate(pond)} /> / s · <Num
										value={pondIncomePerSecond(g, pond).times(game.modifiers.sellMultiplier)}
										tone="coin"
									/> / s
									<span class="faint">
										· market ×{speciesPrice(g, pond.species).toNumber().toFixed(3)}
									</span>
								</p>
							{:else}
								<p class="effect faint">Empty. It breeds nothing until you stock it.</p>
							{/if}
						</div>

						{#if !maxed}
							<button
								aria-label="Deepen pond {index + 1}"
								onclick={() => game.upgradePond(index)}
								disabled={g.coins.lt(cost)}
							>
								<Num value={cost} tone="coin" />
							</button>
						{:else}
							<button disabled aria-label="Pond {index + 1}: max depth">Max</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<div class="row">
			<div class="text">
				<h3 class="name">Dig another pond</h3>
				<p class="desc muted">
					{#if full}
						There is no more room on the land. {POND_MAX} is all of it.
					{:else}
						{g.ponds.length} of {POND_MAX} dug. Each one costs more than the last.
					{/if}
				</p>
			</div>
			<button
				aria-label={full ? 'No room for another pond' : 'Dig another pond'}
				onclick={() => game.digPond()}
				disabled={full || g.coins.lt(game.nextPondPrice)}
			>
				{#if full}
					Full
				{:else}
					<Num value={game.nextPondPrice} tone="coin" />
				{/if}
			</button>
		</div>
	</section>
{/if}

<style>
	.intro,
	.small {
		max-width: 62ch;
	}

	.small {
		font-size: 0.78rem;
	}

	.empty {
		font-size: 0.85rem;
		margin-top: 0.8rem;
	}

	.ponds {
		display: grid;
		gap: 0.5rem;
		margin: 0.9rem 0;
	}

	.ponds li,
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		padding: 0.5rem 0.6rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	.name {
		font-size: 0.92rem;
		margin: 0;
	}

	.level {
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}

	.stock {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.3rem;
		font-size: 0.78rem;
	}

	select {
		font: inherit;
		color: var(--ink);
		background: var(--hull-raised);
		border: 1px solid var(--edge);
		border-radius: var(--radius-sm);
		padding: 0.2rem 0.35rem;
		max-width: 14rem;
	}

	.effect {
		font-size: 0.78rem;
		margin: 0.3rem 0 0;
		font-variant-numeric: tabular-nums;
	}

	.desc {
		font-size: 0.78rem;
		margin: 0.2rem 0 0;
	}
</style>
