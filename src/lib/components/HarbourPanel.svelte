<script lang="ts">
	import {
		BOAT_COST,
		BOAT_SOURCES,
		BOAT_UPGRADES,
		BOAT_UPGRADE_IDS,
		FUEL_PRICE,
		LICENCES,
		LICENCE_IDS
	} from '$lib/game/config';
	import { boatUpgradeCost, fuelRoom, hasLicence, repairCost } from '$lib/game/engine';
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import Decimal from 'break_eternity.js';
	import Num from './Num.svelte';

	// Named `g` rather than `state` — see the note in Fishdex.svelte.
	const g = $derived(game.state);
	const boat = $derived(g.boat);
	const room = $derived(fuelRoom(g, game.modifiers));
	const tankFraction = $derived(
		game.modifiers.fuelCapacity.lte(0)
			? 0
			: Math.min(1, boat.fuel.div(game.modifiers.fuelCapacity).toNumber() || 0)
	);
	const castsLeft = $derived(boat.fuel.div(game.modifiers.fuelPerCast).floor());
	const repair = $derived(repairCost(g));
</script>

<section class="panel">
	<h2>Harbour</h2>
	<p class="muted intro">
		Water is not just a price. Moving water and salt water need a licence, and past the Sea you need
		a hull under you.
	</p>

	<h3>Licences</h3>
	<ul class="list">
		{#each LICENCE_IDS as id (id)}
			{@const licence = LICENCES[id]}
			{@const held = hasLicence(g, id)}
			{@const blocked = licence.requires !== null && !hasLicence(g, licence.requires)}
			<li class:held>
				<div class="text">
					<h4>
						{licence.name}
						{#if held}<span class="stamp">held</span>{/if}
					</h4>
					<p class="covers faint">
						Covers {licence.covers.map((source) => sources[source].name).join(' and ')}
					</p>
					<p class="flavour muted">{licence.flavour}</p>
					{#if blocked && !held}
						<p class="need">Requires the {LICENCES[licence.requires!].name} first.</p>
					{/if}
				</div>
				{#if !held}
					<button
						disabled={blocked || g.coins.lt(licence.cost)}
						onclick={() => game.takeLicence(id)}
					>
						<Num value={licence.cost} tone="coin" />
					</button>
				{/if}
			</li>
		{/each}
	</ul>

	<h3>The boat</h3>
	{#if !boat.owned}
		<div class="buy-boat">
			<p>
				{BOAT_SOURCES.map((source) => sources[source].name).join(' and ')} are out of reach from the shore.
				A working hull, a tank and a licence plate.
			</p>
			<button class="primary" disabled={g.coins.lt(BOAT_COST)} onclick={() => game.purchaseBoat()}>
				Buy a boat · <Num value={BOAT_COST} tone="coin" />
			</button>
		</div>
	{:else}
		<div class="gauges">
			<div class="gauge">
				<div class="gauge-head">
					<span>Fuel</span>
					<span class="num">
						<Num value={boat.fuel} precision={0} /> / <Num
							value={game.modifiers.fuelCapacity}
							precision={0}
						/> L
					</span>
				</div>
				<div class="bar"><div class="fill fuel" style:width="{tankFraction * 100}%"></div></div>
				<p class="faint small">
					{#if castsLeft.gt(0)}
						Enough for <Num value={castsLeft} /> casts in open water.
					{:else}
						Empty. The crew are working inshore until you fuel up.
					{/if}
				</p>
			</div>

			<div class="gauge">
				<div class="gauge-head">
					<span>Condition</span>
					<span class="num">{boat.condition.toFixed(0)}%</span>
				</div>
				<div class="bar">
					<div
						class="fill condition"
						class:worn={boat.condition < 50}
						style:width="{boat.condition}%"
					></div>
				</div>
				<p class="faint small">
					A worn boat is slow, never dead — it never drops below
					{Math.round(game.modifiers.boatEfficiency * 100)}% today, and 40% at its worst.
				</p>
			</div>
		</div>

		<div class="row">
			<button disabled={room.lte(0) || g.coins.lt(FUEL_PRICE)} onclick={() => game.refuel()}>
				Fill the tank · <Num
					value={Decimal.min(room, g.coins.div(FUEL_PRICE)).times(FUEL_PRICE)}
					tone="coin"
				/>
			</button>
			<button disabled={repair.lte(0) || g.coins.lte(0)} onclick={() => game.repair()}>
				{#if repair.lte(0)}
					Nothing to repair
				{:else}
					Repair · <Num value={repair} tone="coin" />
				{/if}
			</button>
		</div>

		<h3>Fit-out</h3>
		<ul class="list">
			{#each BOAT_UPGRADE_IDS as id (id)}
				{@const config = BOAT_UPGRADES[id]}
				{@const level = boat.upgrades[id]}
				{@const maxed = level.gte(config.maxLevel)}
				{@const cost = boatUpgradeCost(id, level)}
				<li class:held={maxed}>
					<div class="text">
						<h4>
							{config.name}
							{#if config.maxLevel > 1}<span class="lv">lv {level.toFixed(0)}</span>{/if}
						</h4>
						<p class="flavour muted">{config.description}</p>
						<p class="effect">{config.format(level.toNumber())}</p>
					</div>
					<button disabled={maxed || g.coins.lt(cost)} onclick={() => game.upgradeBoat(id)}>
						{#if maxed}
							Done
						{:else}
							<Num value={cost} tone="coin" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.intro {
		font-size: 0.79rem;
		margin: 0.35rem 0 0.9rem;
		max-width: 62ch;
	}

	h3 {
		margin: 1.1rem 0 0.5rem;
	}

	h3:first-of-type {
		margin-top: 0;
	}

	h4 {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		font-size: 0.88rem;
		margin: 0;
		font-weight: 600;
	}

	.list {
		display: grid;
		gap: 0.45rem;
	}

	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap);
		padding: 0.55rem 0.65rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
		border: 1px solid transparent;
	}

	.list li.held {
		border-color: rgba(242, 181, 68, 0.4);
	}

	.text {
		min-width: 0;
	}

	.stamp {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--brass);
	}

	.lv {
		font-size: 0.7rem;
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}

	.covers,
	.flavour,
	.effect,
	.need {
		font-size: 0.74rem;
		margin-top: 0.12rem;
	}

	.flavour {
		max-width: 58ch;
	}

	.effect {
		color: var(--foam);
	}

	.need {
		color: var(--coral);
	}

	.list button {
		min-width: 6rem;
		font-size: 0.8rem;
	}

	.buy-boat {
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem;
		border: 1px dashed var(--edge);
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
	}

	.primary {
		justify-self: start;
		border-color: var(--brass-dim);
		background: rgba(242, 181, 68, 0.14);
	}

	.gauges {
		display: grid;
		gap: 0.7rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.gauge-head {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.78rem;
		margin-bottom: 0.25rem;
	}

	.bar {
		height: 0.55rem;
		border-radius: 999px;
		background: rgba(4, 16, 27, 0.7);
		border: 1px solid var(--edge);
		overflow: hidden;
	}

	.fill {
		height: 100%;
	}

	.fill.fuel {
		background: linear-gradient(90deg, #b3831f, var(--brass));
	}

	.fill.condition {
		background: linear-gradient(90deg, #1d5f7a, var(--foam));
	}

	.fill.condition.worn {
		background: linear-gradient(90deg, #8a3b34, var(--coral));
	}

	.small {
		font-size: 0.72rem;
		margin-top: 0.25rem;
	}

	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.7rem;
	}
</style>
