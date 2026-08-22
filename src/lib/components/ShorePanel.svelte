<script lang="ts">
	import {
		ASSISTANT_COST,
		BICYCLE_COST,
		BUCKET_MAX_LEVEL,
		TOWN_TRIP_SECONDS,
		TRADER_RATE
	} from '$lib/game/config';
	import { bucketCapacity, traderInStock } from '$lib/game/engine';
	import CastBar from './CastBar.svelte';
	import { game } from '$lib/game/state.svelte';
	import { D } from '$lib/decimal';
	import Num from './Num.svelte';

	const g = $derived(game.state);
	const worth = $derived(g.holdValue.times(game.modifiers.sellMultiplier));
	const traderPays = $derived(worth.times(TRADER_RATE));

	const canRide = $derived(g.hasBicycle && !game.inTown && g.holdValue.gt(0));

	const maxedBucket = $derived(g.bucketLevel.gte(BUCKET_MAX_LEVEL));
	const hasBike = $derived(traderInStock(g, 'bicycle'));
	const hasBucketOffer = $derived(traderInStock(g, 'bucket'));
	const hasAssistantOffer = $derived(traderInStock(g, 'assistant'));
	const nextBucket = $derived(bucketCapacity(g.bucketLevel.plus(1)));
</script>

<section class="panel">
	<h2>The shore</h2>

	<p class="muted intro">
		A fisherman with no transport sells to whoever comes past, at whatever they feel like paying.
		Getting to town yourself is worth {Math.round((1 / TRADER_RATE - 1) * 100)}% more — and costs
		you the time it takes to get there and back.
	</p>

	<div class="trader">
		<div class="trader-head">
			<h3 class="name">The next trader</h3>
			<span class="countdown">{Math.ceil(game.traderLeft)}s</span>
		</div>
		<CastBar progress={game.traderFill} label="Time until the next trader" active />
		<p class="desc muted">
			He takes the whole bucket at {Math.round(TRADER_RATE * 100)}% of what it is worth — right now
			that is <Num value={traderPays} tone="coin" /> — and brings whatever he happens to be carrying.
		</p>
		{#if game.lastTraderEarned}
			<p class="last">Last trader paid <Num value={game.lastTraderEarned} tone="coin" />.</p>
		{/if}
	</div>

	{#if g.hasBicycle}
		<div class="row">
			<div class="text">
				<h3 class="name">Ride into town</h3>
				<p class="desc muted">
					Full price.
					{#if g.hasAssistant}
						The Assistant runs it in, so you never leave the water.
					{:else}
						You are off the water for {TOWN_TRIP_SECONDS}s — the crew keep fishing.
					{/if}
				</p>
				{#if game.inTown}
					<p class="trip">Back in {Math.ceil(game.townLeft)}s.</p>
				{/if}
			</div>
			<button onclick={() => game.ride()} disabled={!canRide}>
				{#if game.inTown}
					In town
				{:else}
					<Num value={worth} tone="coin" />
				{/if}
			</button>
		</div>
	{:else}
		<div class="row">
			<div class="text">
				<h3 class="name">A bicycle</h3>
				<p class="desc muted">
					Sell in town at full price instead of taking what the trader offers. The ride keeps you
					off the water for {TOWN_TRIP_SECONDS}s.
				</p>
			</div>
			<button
				onclick={() => game.purchaseBicycle()}
				disabled={!hasBike || g.coins.lt(BICYCLE_COST)}
			>
				{#if hasBike}
					<Num value={D(BICYCLE_COST)} tone="coin" />
				{:else}
					Not in stock
				{/if}
			</button>
		</div>
	{/if}

	{#if !g.hasAssistant}
		<div class="row">
			<div class="text">
				<h3 class="name">
					A bigger bucket
					<span class="level">lv {g.bucketLevel.toFixed(0)}{maxedBucket ? ' · max' : ''}</span>
				</h3>
				<p class="desc muted">
					Holds <Num value={game.bucketSize} /> fish.
					{#if !maxedBucket}
						The next one holds <Num value={nextBucket} />.
					{/if}
					A full bucket stops the crew as well as you.
				</p>
			</div>
			{#if !maxedBucket}
				<button
					onclick={() => game.upgradeBucket()}
					disabled={!hasBucketOffer || g.coins.lt(game.bucketPrice)}
				>
					{#if hasBucketOffer}
						<Num value={game.bucketPrice} tone="coin" />
					{:else}
						Not in stock
					{/if}
				</button>
			{/if}
		</div>

		<div class="row">
			<div class="text">
				<h3 class="name">An Assistant</h3>
				<p class="desc muted">
					Someone to mind the catch. Sells at full price with no trip and no cooldown, and empties
					the bucket as fast as you fill it.
				</p>
			</div>
			<button
				onclick={() => game.purchaseAssistant()}
				disabled={!hasAssistantOffer || g.coins.lt(ASSISTANT_COST)}
			>
				{#if hasAssistantOffer}
					<Num value={D(ASSISTANT_COST)} tone="coin" />
				{:else}
					Not in stock
				{/if}
			</button>
		</div>
	{:else}
		<p class="hired">The Assistant handles the selling. Full price, no trip, no bucket.</p>
	{/if}
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

	.trader {
		display: grid;
		gap: 0.4rem;
		padding: 0.6rem 0;
		border-top: 1px solid var(--edge);
	}

	.trader-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.countdown {
		font-size: 0.85rem;
		color: var(--brass);
		font-variant-numeric: tabular-nums;
	}

	.last {
		font-size: 0.75rem;
		color: var(--foam);
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		flex-wrap: wrap;
		padding: 0.6rem 0;
		border-top: 1px solid var(--edge);
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

	.desc {
		font-size: 0.75rem;
		max-width: 58ch;
		margin-top: 0.15rem;
	}

	.trip {
		font-size: 0.75rem;
		color: var(--brass);
		margin-top: 0.2rem;
		font-variant-numeric: tabular-nums;
	}

	.hired {
		font-size: 0.78rem;
		color: var(--foam);
		border-top: 1px solid var(--edge);
		padding-top: 0.6rem;
	}

	button {
		white-space: nowrap;
	}
</style>
