<script lang="ts">
	import { UPGRADES, UPGRADE_IDS } from '$lib/game/config';
	import { upgradeBulkCost } from '$lib/game/engine';
	import { game } from '$lib/game/state.svelte';
	import BuyAmountPicker from './BuyAmountPicker.svelte';
	import Num from './Num.svelte';

	const state = $derived(game.state);
</script>

<section class="panel">
	<div class="head">
		<h2>Gear</h2>
		<BuyAmountPicker />
	</div>

	<ul class="list">
		{#each UPGRADE_IDS as id (id)}
			{@const config = UPGRADES[id]}
			{@const level = state.upgrades[id]}
			{@const maxed = level.gte(config.maxLevel)}
			{@const step = game.upgradeStep(id)}
			{@const cost = step.gt(0) ? upgradeBulkCost(id, level, step) : null}
			{@const affordable = cost !== null && state.coins.gte(cost)}
			<li class="upgrade" class:maxed>
				<div class="text">
					<h3 class="name">
						{config.name}
						<span class="level">lv {level.toFixed(0)}{maxed ? ' · max' : ''}</span>
					</h3>
					<p class="desc muted">{config.description}</p>
					<p class="effect">
						<span class="now">{config.format(level.toNumber())}</span>
						{#if !maxed && step.gt(0)}
							<span class="arrow faint">→</span>
							<span class="next">{config.format(level.plus(step).toNumber())}</span>
						{/if}
					</p>
				</div>

				<button
					class="buy"
					disabled={maxed || !affordable || step.lte(0)}
					onclick={() => game.buy(id)}
				>
					{#if maxed}
						Maxed
					{:else if step.lte(0) || cost === null}
						Not yet
					{:else}
						<span class="amount">+{step.toFixed(0)}</span>
						<Num value={cost} tone="coin" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}

	.list {
		display: grid;
		gap: 0.45rem;
	}

	.upgrade {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		padding: 0.55rem 0.65rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
		border: 1px solid transparent;
	}

	.upgrade.maxed {
		border-color: rgba(242, 181, 68, 0.4);
	}

	.text {
		min-width: 0;
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

	.desc {
		font-size: 0.75rem;
	}

	.effect {
		font-size: 0.75rem;
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin-top: 0.15rem;
	}

	.now {
		color: var(--ink-dim);
	}

	.next {
		color: var(--foam);
	}

	.buy {
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
</style>
