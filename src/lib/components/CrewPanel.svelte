<script lang="ts">
	import { SOURCE_ORDER, UPGRADES } from '$lib/game/config';
	import { deckhandBulkCost, sourceIncomePerSecond, upgradeBulkCost } from '$lib/game/engine';
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import { catchTable } from '$lib/game/engine';
	import BuyAmountPicker from './BuyAmountPicker.svelte';
	import Num from './Num.svelte';

	const state = $derived(game.state);
	const open = $derived(SOURCE_ORDER.filter((source) => state.unlocked[source]));

	/** What the player earns per second holding the rod at the active source. */
	const manualIncome = $derived.by(() => {
		const source = state.activeSource;
		const table = catchTable(source, game.modifiers.luck);
		return game.modifiers.fishPerCast
			.times(table.averageSourceValue)
			.times(game.modifiers.sellMultiplier)
			.div(game.modifiers.castSeconds[source]);
	});

	const crewLevel = $derived(state.upgrades.crew);
	const crewStep = $derived(game.upgradeStep('crew'));
	const crewCost = $derived(crewStep.gt(0) ? upgradeBulkCost('crew', crewLevel, crewStep) : null);
	// A shopkeeper ceiling is not the top of the track. This panel said "Maxed"
	// at crew 9 of 60 while the Gear tab said "Not sold here · better is stocked
	// at the Stream" about the same upgrade.
	const crewMaxed = $derived(crewLevel.gte(UPGRADES.crew.maxLevel));
	const crewStockedAt = $derived(game.stockedAt.crew);
</script>

<section class="panel">
	<div class="head">
		<h2>The crew</h2>
		<BuyAmountPicker />
	</div>

	<p class="muted intro">
		Deckhands fish a source on their own at
		{Math.round(
			game.modifiers.deckhandCastsPerSecond[state.activeSource] *
				game.modifiers.castSeconds[state.activeSource] *
				100
		)}% of your speed. They keep working while the tab is closed.
	</p>

	<ul class="list">
		{#each open as source (source)}
			{@const owned = state.deckhands[source]}
			{@const step = game.deckhandStep(source)}
			{@const cost = step.gt(0) ? deckhandBulkCost(source, owned, step) : null}
			{@const affordable = cost !== null && state.coins.gte(cost)}
			{@const income = sourceIncomePerSecond(state, game.modifiers, source)}
			<li class="crew">
				<div class="text">
					<h3 class="name">
						{sources[source].name}
						<span class="level">{owned.toFixed(0)} aboard</span>
					</h3>
					<p class="effect">
						{#if income.gt(0)}
							<Num value={income} tone="coin" />/s
						{:else}
							<span class="faint">nobody working here</span>
						{/if}
					</p>
				</div>

				<button
					aria-label="Hire a deckhand at the {sources[source].name}"
					disabled={!affordable || step.lte(0)}
					onclick={() => game.hire(source)}
				>
					{#if step.lte(0) || cost === null}
						Not yet
					{:else}
						<span class="amount">hire {step.toFixed(0)}</span>
						<Num value={cost} tone="coin" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>

	<div class="quarters">
		<div class="text">
			<h3 class="name">
				{UPGRADES.crew.name}
				<span class="level">lv {crewLevel.toFixed(0)}</span>
			</h3>
			<p class="desc muted">{UPGRADES.crew.description}</p>
			<p class="effect">{UPGRADES.crew.format(crewLevel.toNumber())}</p>
			{#if !crewMaxed && crewCost === null}
				<p class="desc muted">
					The best one anyone around here sells.
					{#if crewStockedAt}Better is stocked at the <strong>{crewStockedAt}</strong>.{/if}
				</p>
			{/if}
		</div>
		<button
			aria-label="Buy {UPGRADES.crew.name}"
			disabled={crewCost === null || !state.coins.gte(crewCost)}
			onclick={() => game.buy('crew')}
		>
			{#if crewMaxed}
				Maxed
			{:else if crewCost === null}
				Not sold here
			{:else}
				<span class="amount">+{crewStep.toFixed(0)}</span>
				<Num value={crewCost} tone="coin" />
			{/if}
		</button>
	</div>

	<dl class="split">
		<div>
			<dt>You, holding the rod</dt>
			<dd><Num value={manualIncome} tone="coin" />/s</dd>
		</div>
		<div>
			<dt>The crew, without you</dt>
			<dd><Num value={game.incomePerSecond} tone="coin" />/s</dd>
		</div>
	</dl>

	{#if game.incomePerSecond.gt(manualIncome) && manualIncome.gt(0)}
		<p class="handover">
			The crew out-earn you now. You can put the rod down —
			<Num value={game.incomePerSecond.div(manualIncome)} />× over.
		</p>
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

	.intro {
		font-size: 0.78rem;
		margin: 0.4rem 0 0.7rem;
		max-width: 60ch;
	}

	.list {
		display: grid;
		gap: 0.4rem;
	}

	.crew,
	.quarters {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		padding: 0.5rem 0.65rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
	}

	.quarters {
		margin-top: 0.7rem;
		border: 1px solid rgba(79, 209, 197, 0.3);
	}

	.name {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: 0.9rem;
		color: var(--ink);
		text-transform: none;
		letter-spacing: 0;
	}

	.level {
		font-size: 0.7rem;
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}

	.desc,
	.effect {
		font-size: 0.75rem;
	}

	.effect {
		color: var(--ink-dim);
	}

	button {
		display: grid;
		gap: 0.05rem;
		justify-items: center;
		min-width: 6.5rem;
		font-size: 0.8rem;
	}

	.amount {
		font-size: 0.68rem;
		color: var(--ink-faint);
	}

	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin: 0.8rem 0 0;
	}

	dt {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--ink-faint);
	}

	dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.handover {
		margin-top: 0.6rem;
		font-size: 0.8rem;
		color: var(--foam);
	}
</style>
