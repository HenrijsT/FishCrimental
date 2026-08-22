<script lang="ts">
	import {
		PEARL_MULTIPLIER_SCALE,
		PRESTIGE_THRESHOLD,
		PRESTIGE_UPGRADES,
		PRESTIGE_UPGRADE_IDS
	} from '$lib/game/config';
	import { pearlMultiplier, pearlsFor, prestigeUpgradeCost } from '$lib/game/engine';
	import { game } from '$lib/game/state.svelte';
	import Num from './Num.svelte';

	// Named `g` rather than `state` — see the note in Fishdex.svelte.
	const g = $derived(game.state);
	const pending = $derived(pearlsFor(g.lifetimeCoins));
	// The bonus multiplies `fishPerCast` and `sellMultiplier` alike, so income
	// moves by its square. The panel used to print the single application and
	// understate the real effect by that factor.
	const pearlBonus = $derived(pearlMultiplier(g.pearls));
	const pearlIncome = $derived(pearlBonus.times(pearlBonus));

	const progress = $derived(Math.min(1, g.lifetimeCoins.div(PRESTIGE_THRESHOLD).toNumber() || 0));

	let confirming = $state(false);

	function commit() {
		confirming = false;
		game.prestige();
	}
</script>

<section class="panel">
	<h2>Pearls</h2>

	<p class="muted intro">
		Sail out to the Ocean, earn <Num value={PRESTIGE_THRESHOLD} tone="coin" /> across a single run, and
		trade the whole operation in for Pearls. You keep the Fishdex, the Pearls and everything you bought
		with them; the coins, the gear, the crew and the charts go back to the Pond.
	</p>

	<dl class="stats">
		<div>
			<dt>Pearls held</dt>
			<dd><Num value={g.pearls} tone="pearl" /></dd>
		</div>
		<div>
			<dt>All time</dt>
			<dd><Num value={g.allTimePearls} tone="pearl" /></dd>
		</div>
		<div>
			<dt>Runs completed</dt>
			<dd><Num value={g.prestigeCount} /></dd>
		</div>
		<div>
			<dt>Pearl bonus</dt>
			<dd><Num value={pearlBonus} />× twice</dd>
		</div>
		<div>
			<dt>Income effect</dt>
			<dd><Num value={pearlIncome} />×</dd>
		</div>
	</dl>

	<p class="faint small">
		The Pearl bonus lands on both halves of the sum — every cast lands
		<Num value={pearlBonus} />× the fish, and every fish sells for
		<Num value={pearlBonus} />× as much — so what you actually earn moves by the square, <Num
			value={pearlIncome}
		/>×.
	</p>

	<div class="progress">
		<div class="bar" role="presentation">
			<div class="fill" style:width="{progress * 100}%"></div>
		</div>
		<p class="faint small">
			<Num value={g.lifetimeCoins} tone="coin" /> of
			<Num value={PRESTIGE_THRESHOLD} tone="coin" /> this run
			{#if !g.unlocked.Ocean}· the Ocean is still closed{/if}
		</p>
	</div>

	{#if confirming}
		<div class="confirm">
			<p>
				Cash in for <strong><Num value={pending} tone="pearl" /></strong> Pearls? The run ends here.
			</p>
			<div class="row">
				<button class="go" onclick={commit}>Trade it all in</button>
				<button onclick={() => (confirming = false)}>Not yet</button>
			</div>
		</div>
	{:else}
		<button class="go wide" disabled={!game.prestigeReady} onclick={() => (confirming = true)}>
			{#if game.prestigeReady}
				Prestige for <Num value={pending} tone="pearl" /> Pearls
			{:else}
				Not ready to prestige
			{/if}
		</button>
	{/if}

	<h3 class="tree-heading">Spend Pearls</h3>
	<p class="faint small">
		Each Pearl also adds {PEARL_MULTIPLIER_SCALE} to a permanent catch-and-sell multiplier on its own,
		whether you spend it or not.
	</p>

	<ul class="tree">
		{#each PRESTIGE_UPGRADE_IDS as id (id)}
			{@const config = PRESTIGE_UPGRADES[id]}
			{@const level = g.prestigeUpgrades[id]}
			{@const maxed = level.gte(config.maxLevel)}
			{@const cost = prestigeUpgradeCost(id, level)}
			<li class:maxed>
				<div class="text">
					<h3 class="name">
						{config.name}
						<span class="level">lv {level.toFixed(0)}{maxed ? ' · max' : ''}</span>
					</h3>
					<p class="desc muted">{config.description}</p>
					<p class="effect">
						{config.format(level.toNumber())}
						{#if !maxed}
							<span class="faint">→</span>
							<span class="next">{config.format(level.plus(1).toNumber())}</span>
						{/if}
					</p>
				</div>
				<button disabled={maxed || g.pearls.lt(cost)} onclick={() => game.buyPearlUpgrade(id)}>
					{#if maxed}
						Maxed
					{:else}
						<Num value={cost} tone="pearl" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	.intro {
		font-size: 0.8rem;
		margin: 0.4rem 0 0.8rem;
		max-width: 62ch;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
		gap: 0.6rem;
		margin: 0 0 0.8rem;
	}

	dt {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--ink-faint);
	}

	dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.progress {
		display: grid;
		gap: 0.3rem;
		margin-bottom: 0.8rem;
	}

	.bar {
		height: 0.5rem;
		border-radius: 999px;
		background: rgba(4, 16, 27, 0.7);
		border: 1px solid var(--edge);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, #7f6bb0, var(--pearl));
	}

	.small {
		font-size: 0.74rem;
	}

	.go {
		border-color: #8f7cc0;
		background: rgba(216, 199, 238, 0.14);
		font-weight: 600;
	}

	.go:hover:not(:disabled) {
		background: rgba(216, 199, 238, 0.24);
	}

	.wide {
		width: 100%;
		padding: 0.7rem;
	}

	.confirm {
		display: grid;
		gap: 0.5rem;
		padding: 0.7rem;
		border: 1px solid #8f7cc0;
		border-radius: var(--radius-sm);
		background: rgba(127, 107, 176, 0.12);
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.tree-heading {
		margin-top: 1.2rem;
	}

	.tree {
		display: grid;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.tree li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		padding: 0.5rem 0.65rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
		border: 1px solid transparent;
	}

	.tree li.maxed {
		border-color: rgba(216, 199, 238, 0.4);
	}

	.name {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: 0.88rem;
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
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.next {
		color: var(--pearl);
	}

	.tree button {
		min-width: 5rem;
	}
</style>
