<script lang="ts">
	import {
		BOAT_COST,
		BOAT_MIN_EFFICIENCY,
		BOAT_SOURCES,
		BOAT_UPGRADES,
		BOAT_UPGRADE_IDS,
		FUEL_PRICE,
		LICENCES,
		LICENCE_IDS
	} from '$lib/game/config';
	import { boatUpgradeCost, fuelRoom, hasLicence, repairCost } from '$lib/game/engine';
	import { CULL_KEEP_FROM, EXAMS } from '$lib/game/exams';
	import CastBar from './CastBar.svelte';
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import Decimal from 'break_eternity.js';
	import Num from './Num.svelte';

	// Named `g` rather than `state` — see the note in Fishdex.svelte.
	const g = $derived(game.state);
	const boat = $derived(g.boat);
	const exam = $derived(game.exam);

	let sounderGuess = $state(50);
	let sounderSaid = $state<string | null>(null);

	// The sounder's last answer belongs to the attempt that produced it. Walking
	// away and sitting again — which is free, and which the panel encourages —
	// used to open the fresh attempt still showing "Last call: deeper" against a
	// depth that had been re-rolled.
	$effect(() => {
		if (game.exam?.kind !== 'sounder') sounderSaid = null;
	});

	function callSounder() {
		const said = game.sounderCall(sounderGuess);
		sounderSaid = said === 'found' ? 'found it' : said;
	}
	const room = $derived(fuelRoom(g, game.modifiers));
	const tankFraction = $derived(
		game.modifiers.fuelCapacity.lte(0)
			? 0
			: Math.min(1, boat.fuel.div(game.modifiers.fuelCapacity).toNumber() || 0)
	);
	const castsLeft = $derived(boat.fuel.div(game.modifiers.fuelPerCast).floor());
	const repair = $derived(repairCost(g));
	/**
	 * What pressing Repair will actually take.
	 *
	 * `repairBoat` falls back to a partial repair for whatever the player has,
	 * so a short player was shown the full price and charged every coin they
	 * owned. The fuel button one line above already clamps; this one did not.
	 */
	const repairCharge = $derived(Decimal.min(repair, g.coins));
	const partialRepair = $derived(repair.gt(g.coins) && g.coins.gt(0));
</script>

<section class="panel">
	<h2>Harbour</h2>
	<p class="muted intro">
		Water is not just a price. Moving water and salt water need a licence, and past the Sea you need
		a hull under you. A licence costs nothing — you sit an examination for it, and you can walk away
		and come back as often as you like.
	</p>

	<h3>Licences</h3>

	{#if exam}
		{@const definition = EXAMS[exam.licence]}
		<div class="exam">
			<div class="exam-head">
				<h4>{definition.name}</h4>
				<span class="faint">for the {LICENCES[exam.licence].name}</span>
			</div>
			<p class="flavour muted">{definition.brief}</p>

			<CastBar
				progress={game.examProgress}
				label="Progress through {definition.name}"
				active={!game.examDone}
			/>
			<!--
				The one thing the sounder ever tells you is a word, and there was
				nowhere for a screen reader to hear it. `role="progressbar"` is not
				a live region, so the whole exam — a binary search whose only
				feedback is "deeper" or "shallower" — was unplayable without sight,
				and licences gate everything past the Sea.
			-->
			<p class="progress-line" role="status">
				{exam.progress} of {exam.target}
				{#if exam.attempts > 0}<span class="faint">· {exam.attempts} calls</span>{/if}
				{#if sounderSaid}<span class="said">· last call: {sounderSaid}</span>{/if}
				{#if game.examDone}<span class="passed-inline">· passed</span>{/if}
			</p>

			{#if game.examDone}
				<p class="passed">Passed. The card is yours.</p>
				<div class="row-buttons">
					<button class="go" onclick={() => game.takeLicence()}>Take the licence</button>
				</div>
			{:else if exam.kind === 'quota'}
				<p class="task">
					{#if exam.species}
						Land <strong>{exam.target - exam.progress}</strong> more {exam.species}. Anything that
						lands counts — your rod, the crew, the ponds.
					{:else}
						Land <strong>{exam.target - exam.progress}</strong> more fish. Anything at all.
					{/if}
				</p>
			{:else if exam.kind === 'longline'}
				<p class="task">
					Land <strong>{exam.target - exam.progress}</strong> more fish that are rare or better. Glimmer
					Lure and the Pearl Diver's Eye are what move this along.
				</p>
			{:else if exam.kind === 'cull'}
				<p class="task">
					Keep everything <strong>{CULL_KEEP_FROM} and over</strong>. Put the rest back.
				</p>
				<p class="offer">
					In your hands: <strong>a {exam.offer}</strong>
				</p>
				<div class="row-buttons">
					<button onclick={() => game.cullCall(true)}>Keep it</button>
					<button onclick={() => game.cullCall(false)}>Put it back</button>
				</div>
			{:else if exam.kind === 'sounder'}
				<p class="task">
					Somewhere between <strong>{exam.low}</strong> and <strong>{exam.high}</strong>.
				</p>
				<div class="row-buttons">
					<label class="depth">
						<span class="faint">Call a depth</span>
						<input
							type="number"
							min={exam.low}
							max={exam.high}
							bind:value={sounderGuess}
							onkeydown={(event) => {
								if (event.key === 'Enter') callSounder();
							}}
						/>
					</label>
					<button onclick={callSounder}>Sound it</button>
				</div>
			{/if}

			{#if !game.examDone}
				<div class="row-buttons">
					<button class="quiet" onclick={() => game.abandonExam()}>Walk away</button>
				</div>
				<p class="faint small">
					Walking away costs nothing. Neither does reloading the page — an attempt is not saved, and
					starting again is free.
				</p>
			{/if}
		</div>
	{/if}

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
					{:else if !held && !game.sittable.includes(id)}
						<p class="need faint">
							Sat for when the water in front of you needs it — {EXAMS[id].name}, no fee.
						</p>
					{:else if !held}
						<p class="need faint">{EXAMS[id].name} — no fee.</p>
					{/if}
				</div>
				{#if !held}
					<!--
						`canSit` also refuses a licence the water in front of you does
						not need yet, and `sitExam` returns false without saying so —
						so this button was live and inert from the first second of a
						new game, on the very first licence a player meets.
					-->
					{@const sittable = game.sittable.includes(id)}
					<button disabled={blocked || exam !== null || !sittable} onclick={() => game.sitExam(id)}>
						{#if exam !== null}
							Busy
						{:else if !sittable}
							Not yet
						{:else}
							Sit {EXAMS[id].name}
						{/if}
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
					{Math.round(game.modifiers.boatEfficiency * 100)}% today, and {Math.round(
						BOAT_MIN_EFFICIENCY * 100
					)}% at its worst.
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
				{:else if partialRepair}
					Part-repair · <Num value={repairCharge} tone="coin" />
				{:else}
					Repair · <Num value={repairCharge} tone="coin" />
				{/if}
			</button>
		</div>

		<h3>Fit-out</h3>
		<ul class="list">
			{#each BOAT_UPGRADE_IDS as id (id)}
				{@const config = BOAT_UPGRADES[id]}
				{@const level = boat.upgrades[id]}
				{@const maxed = level.gte(config.maxLevel)}
				{@const capped = !maxed && level.gte(game.boatCeilings[id])}
				{@const cost = boatUpgradeCost(id, level)}
				<li class:held={maxed}>
					<div class="text">
						<h4>
							{config.name}
							{#if config.maxLevel > 1}<span class="lv">lv {level.toFixed(0)}</span>{/if}
						</h4>
						<p class="flavour muted">{config.description}</p>
						<p class="effect">{config.format(level.toNumber())}</p>
						{#if capped}
							<p class="need">No yard around here fits one. Deeper water has a better yard.</p>
						{/if}
					</div>
					<button
						aria-label={maxed
							? `${config.name}: done`
							: capped
								? `${config.name}: not fitted here`
								: `Fit ${config.name}`}
						disabled={maxed || capped || g.coins.lt(cost)}
						onclick={() => game.upgradeBoat(id)}
					>
						{#if maxed}
							Done
						{:else if capped}
							Not fitted here
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

	.exam {
		border: 1px solid var(--brass-dim);
		border-radius: var(--radius-sm);
		padding: 0.7rem 0.8rem;
		margin: 0.6rem 0 1rem;
		background: rgba(4, 16, 27, 0.55);
	}

	.exam-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.exam-head h4 {
		margin: 0;
		font-size: 1rem;
	}

	.progress-line {
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		margin: 0.3rem 0;
	}

	.task,
	.offer {
		font-size: 0.85rem;
		margin: 0.4rem 0;
		max-width: 60ch;
	}

	.offer strong {
		color: var(--brass);
	}

	.passed {
		color: var(--brass);
		font-weight: 600;
		margin: 0.4rem 0;
	}

	.said,
	.passed-inline {
		color: var(--ink-dim);
	}

	.passed-inline {
		color: var(--brass);
	}

	.row-buttons {
		display: flex;
		gap: 0.4rem;
		align-items: flex-end;
		flex-wrap: wrap;
		margin-top: 0.4rem;
	}

	.depth {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.72rem;
	}

	.depth input {
		font: inherit;
		font-size: 0.9rem;
		width: 6rem;
		color: var(--ink);
		background: var(--hull-raised);
		border: 1px solid var(--edge);
		border-radius: var(--radius-sm);
		padding: 0.25rem 0.4rem;
	}

	.small {
		font-size: 0.72rem;
		margin-top: 0.4rem;
	}
</style>
