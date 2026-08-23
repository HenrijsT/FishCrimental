<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { FISH_TYPES, FishType, fishTypeBaseValue } from '$lib/fish_types';
	import Num from './Num.svelte';

	const state = $derived(game.state);
	const visible = $derived(FISH_TYPES.filter((type) => state.hold[type].gt(0)));

	const held = $derived(game.holdSize);
	// What it fetches today, not what it was worth when it was landed.
	const worth = $derived(game.holdWorth);

	/** Fish would move; there is somewhere for them to go. */
	const canList = $derived(held.gt(0) && (game.listedRoom === null || game.listedRoom.gt(0)));
	/** The bicycle takes the bucket *and* the quay in one trip. */
	const rideWorth = $derived(worth.plus(game.listedWorth));
	const canRide = $derived(state.hasBicycle && rideWorth.gt(0) && !game.inTown);
</script>

<section class="panel">
	<div class="head">
		<h2>
			The bucket
			{#if game.holdRoom !== null}
				<span class="cap"><Num value={held} /> / <Num value={game.bucketSize} /></span>
			{/if}
		</h2>

		<div class="actions">
			{#if state.hasAssistant}
				<button onclick={() => game.sell()} disabled={held.lte(0)}>
					Sell · <Num value={worth} tone="coin" />
				</button>
			{:else}
				<button class="secondary" onclick={() => game.sell()} disabled={!canList}>
					{#if game.listedRoom !== null && game.listedRoom.lte(0)}
						Quay full
					{:else}
						List for the merchant
					{/if}
				</button>
				{#if state.hasBicycle}
					<button onclick={() => game.ride()} disabled={!canRide}>
						{#if game.inTown}
							In town · {Math.ceil(game.townLeft)}s
						{:else}
							Ride to town · <Num value={rideWorth} tone="coin" />
						{/if}
					</button>
				{/if}
			{/if}
		</div>
	</div>

	<p class="faint note">
		Fish are sorted by size. The bigger the fish the more it fetches, and where you caught it
		matters more than what it is.
	</p>

	{#if game.holdRoom !== null && game.holdRoom.lte(0)}
		<p class="full">
			The bucket is full. Nothing else will fit until it is emptied — the crew have stopped too.
		</p>
	{/if}

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

	{#if !state.hasAssistant}
		<div class="quay">
			<h3>
				On the quay
				{#if game.listedRoom !== null}
					<span class="cap"><Num value={game.listedSize} /> / <Num value={game.bucketSize} /></span>
				{/if}
			</h3>

			{#if game.listedSize.lte(0)}
				<p class="faint small">
					Listing takes fish out of the bucket now and pays when the merchant arrives. He takes
					whatever is waiting for him, at his own price.
				</p>
			{:else}
				<p class="small">
					<Num value={game.listedSize} /> fish, worth
					<Num value={game.listedWorth.times(game.merchantRate)} tone="coin" /> to the merchant.
					<span class="faint">
						He is due in {Math.ceil(game.traderLeft)}s, and pays for them at the price on the day —
						not the price when you listed them.
					</span>
				</p>
				<p class="faint small">
					Nobody comes while the game is shut. Listed fish sit and wait for you.
				</p>
			{/if}
		</div>
	{/if}
</section>

<style>
	.actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.quay {
		margin-top: 0.9rem;
		padding-top: 0.7rem;
		border-top: 1px solid var(--edge);
	}

	.quay h3 {
		font-size: 0.9rem;
		margin: 0 0 0.3rem;
	}

	.small {
		font-size: 0.78rem;
		margin: 0.2rem 0;
		max-width: 60ch;
	}

	.cap {
		font-size: 0.7rem;
		font-weight: 400;
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}

	.full {
		font-size: 0.78rem;
		color: var(--brass);
		border: 1px dashed var(--brass-dim);
		border-radius: var(--radius-sm);
		padding: 0.4rem 0.6rem;
	}

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
