<script lang="ts">
	import { AUTO_FISHER, AUTO_FISHER_OFFLINE_COST } from '$lib/game/config';
	import { autoFisherCost, autoFisherFraction } from '$lib/game/engine';
	import { formatNumber } from '$lib/format';
	import { game } from '$lib/game/state.svelte';
	import { D } from '$lib/decimal';
	import Num from './Num.svelte';

	const g = $derived(game.state);
	const level = $derived(g.autoFisher);
	const owned = $derived(level.gt(0));
	const maxed = $derived(level.gte(AUTO_FISHER.maxLevel));

	const speed = $derived(game.autoFisherSpeed);
	const nextSpeed = $derived(maxed ? speed : autoFisherFraction(level.plus(1)));
	const cost = $derived(autoFisherCost(level));
	const affordable = $derived(g.coins.gte(cost));

	const offlineCost = $derived(D(AUTO_FISHER_OFFLINE_COST));
	const canBuyOffline = $derived(owned && !g.autoFisherOffline && g.coins.gte(offlineCost));

	/** "one cast every 2.4s", which is what the player actually sees happen. */
	function cadence(rate: number): string {
		if (!Number.isFinite(rate) || rate <= 0) return 'never';
		if (rate >= 1) return `${formatNumber(D(rate))} casts a second`;
		return `one cast every ${(1 / rate).toFixed(1)}s`;
	}

	const humanRate = $derived(1 / game.activeCastSeconds);
	const rigRate = $derived(humanRate * speed);
</script>

<section class="panel">
	<h2>{AUTO_FISHER.name}</h2>

	<p class="muted intro">
		{AUTO_FISHER.description} It works whichever water you have chosen — unlike a deckhand, who only ever
		fishes their own. It stands down while you are holding the rod yourself, so it can catch up to your
		hand but never adds to it.
	</p>

	{#if owned}
		<dl class="readout">
			<div>
				<dt>Speed</dt>
				<dd>{Math.round(speed * 100)}% of your own</dd>
			</div>
			<div>
				<dt>Working the</dt>
				<dd>{g.activeSource}</dd>
			</div>
			<div>
				<dt>Its rate</dt>
				<dd>{cadence(rigRate)}</dd>
			</div>
			<div>
				<dt>Your rate</dt>
				<dd>{cadence(humanRate)}</dd>
			</div>
		</dl>
	{/if}

	<div class="row">
		<div class="text">
			<h3 class="name">
				{owned ? 'Tune the rig' : 'Buy the rig'}
				<span class="level">lv {level.toFixed(0)}{maxed ? ' · max' : ''}</span>
			</h3>
			<p class="effect">
				<span class="now">{Math.round(speed * 100)}% of hand speed</span>
				{#if !maxed}
					<span class="arrow faint">→</span>
					<span class="next">{Math.round(nextSpeed * 100)}%</span>
				{/if}
			</p>
			{#if maxed}
				<p class="muted small">
					It now casts at exactly your speed. It will never be quicker than you are — that is the
					ceiling, by design.
				</p>
			{/if}
		</div>

		<button
			class="buy"
			aria-label={maxed ? 'The rig: maxed' : 'Buy a level of the rig'}
			disabled={maxed || !affordable}
			onclick={() => game.buyRig()}
		>
			{#if maxed}
				Maxed
			{:else}
				<span class="amount">{owned ? '+1' : 'Buy'}</span>
				<Num value={cost} tone="coin" />
			{/if}
		</button>
	</div>

	<div class="row offline" class:done={g.autoFisherOffline}>
		<div class="text">
			<h3 class="name">Night shift</h3>
			<p class="desc muted">
				A timer and a lamp, so the rig keeps working while the game is shut. Your deckhands already
				fish while you are away; this sends your own rod out with them.
			</p>
			{#if g.autoFisherOffline}
				<p class="effect"><span class="now">Fitted — the rig works offline</span></p>
			{/if}
		</div>

		{#if !g.autoFisherOffline}
			<button
				class="buy"
				aria-label={owned ? 'Buy the night shift' : 'Night shift: needs a rig'}
				disabled={!canBuyOffline}
				onclick={() => game.buyRigOffline()}
			>
				{#if !owned}
					Needs a rig
				{:else}
					<Num value={offlineCost} tone="coin" />
				{/if}
			</button>
		{/if}
	</div>
</section>

<style>
	h2 {
		font-size: 1rem;
	}

	.intro {
		font-size: 0.8rem;
		max-width: 62ch;
		margin: 0.3rem 0 0.75rem;
	}

	.readout {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.readout dt {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-dim);
	}

	.readout dd {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		flex-wrap: wrap;
		padding: 0.6rem 0;
		border-top: 1px solid var(--rule);
	}

	.text {
		min-width: 0;
		flex: 1 1 16rem;
	}

	.name {
		font-size: 0.85rem;
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.level {
		font-size: 0.68rem;
		color: var(--ink-dim);
		font-weight: 400;
	}

	.desc,
	.small {
		font-size: 0.75rem;
		max-width: 58ch;
		margin-top: 0.15rem;
	}

	.effect {
		font-size: 0.78rem;
		margin-top: 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
		font-variant-numeric: tabular-nums;
	}

	.now {
		color: var(--ink-dim);
	}

	.next {
		color: var(--brass);
		font-weight: 600;
	}

	.buy {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.amount {
		font-weight: 600;
	}

	.offline.done .text {
		opacity: 0.85;
	}
</style>
