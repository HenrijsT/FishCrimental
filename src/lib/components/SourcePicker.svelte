<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { SOURCE_CONFIG, SOURCE_ORDER } from '$lib/game/config';
	import { catchTable, missingLicence, nextLockedSource, sourceBlocker } from '$lib/game/engine';
	import { LICENCES, needsBoat } from '$lib/game/config';
	import { sources } from '$lib/fishing_sources';
	import { SCENES } from '$lib/game/scenes';
	import CastBar from './CastBar.svelte';
	import Num from './Num.svelte';
	import { POACH_BUSTED_SECONDS } from '$lib/game/config';
	import { finePercent } from '$lib/game/police';
	import SourceThumb from './SourceThumb.svelte';

	const g = $derived(game.state);
	const next = $derived(nextLockedSource(g));
</script>

<section class="panel">
	<h2>Where you are fishing</h2>
	<p class="muted intro">
		Every source has its own fish and its own pace. A slower cast in deeper water is worth it — the
		fish down there are worth hundreds of times a pond guppy.
	</p>

	<ul class="sources">
		{#each SOURCE_ORDER as source (source)}
			{@const config = SOURCE_CONFIG[source]}
			{@const open = g.unlocked[source]}
			{@const isNext = next === source}
			{#if open || isNext}
				{@const affordable = g.coins.gte(config.unlockCost)}
				{@const licence = missingLicence(g, source)}
				{@const blocker = sourceBlocker(g, source, game.modifiers)}
				{@const usable = open && !blocker}
				<li>
					<button
						class="source"
						class:active={g.activeSource === source}
						class:locked={!open}
						class:blocked={open && !!blocker}
						aria-pressed={usable ? g.activeSource === source : undefined}
						disabled={open
							? !!blocker
							: !affordable || !!licence || (needsBoat(source) && !g.boat.owned)}
						onclick={() => (open ? game.setSource(source) : game.unlock(source))}
					>
						<SourceThumb {source} dimmed={!open} />
						<span class="text">
							<span class="name">
								{sources[source].name}
								{#if !open}<span class="tag">locked</span>{/if}
							</span>
							{#if open && blocker === 'fuel'}
								<span class="stats warn">Tank empty — fuel up at the harbour</span>
							{:else if open && blocker === 'boat'}
								<span class="stats warn">Needs a boat</span>
							{:else if open && blocker === 'licence'}
								<span class="stats warn">
									Needs the {LICENCES[licence!].name} — or a nerve
								</span>
							{:else if open}
								<span class="stats faint">
									{game.modifiers.castSeconds[source].toFixed(2)}s a cast ·
									<Num
										value={catchTable(source, game.modifiers.luck).averageSourceValue}
										tone="coin"
									/> a fish
								</span>
							{:else if licence}
								<span class="stats warn">Needs the {LICENCES[licence].name}</span>
							{:else if needsBoat(source) && !g.boat.owned}
								<span class="stats warn">Needs a boat</span>
							{:else}
								<span class="stats faint">
									Opens for <Num value={config.unlockCost} tone="coin" /> ·
									{affordable ? 'you can afford it' : 'keep selling'}
								</span>
							{/if}
						</span>
					</button>

					{#if open && blocker === 'licence' && !game.busted}
						<button
							class="poach"
							onclick={() => game.poach(source)}
							disabled={g.poaching === source}
						>
							{#if g.poaching === source}
								Poaching — {Math.ceil(game.graceLeft)}s
							{:else}
								Fish it anyway
							{/if}
						</button>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>

	{#if g.poaching}
		<div class="poaching">
			<p class="line">
				<strong>You are poaching the {sources[g.poaching].name}.</strong>
				Nobody has noticed yet. They will in about {Math.ceil(game.graceLeft)} seconds.
			</p>
			<CastBar progress={game.graceFill} label="Time before someone notices" active />
			<p class="line faint">
				When they do: everything you have landed here goes back in the water, they take
				{finePercent(g, g.poaching)}% of your coins, and you are off the water for
				{POACH_BUSTED_SECONDS}s. Leave now and the catch is yours.
			</p>
			<button onclick={() => game.stopPoaching()}>Pack up and go</button>
		</div>
	{/if}

	{#if game.busted}
		<p class="busted">
			A warden has you on the bank. Back on the water in {Math.ceil(game.bustedLeft)}s — the crew
			are still working.
		</p>
	{/if}

	<div class="detail">
		<h3>{sources[g.activeSource].name}</h3>
		<p class="blurb muted">{sources[g.activeSource].description.trim()}</p>
		<p class="mood">{SCENES[g.activeSource].mood}</p>
	</div>
</section>

<style>
	.intro {
		font-size: 0.79rem;
		margin: 0.35rem 0 0.75rem;
		max-width: 62ch;
	}

	.sources {
		display: grid;
		gap: 0.45rem;
		grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr));
	}

	.source {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		text-align: left;
		padding: 0.4rem 0.5rem;
	}

	.source.active {
		border-color: var(--brass);
		background: rgba(242, 181, 68, 0.12);
	}

	.source.locked {
		border-style: dashed;
	}

	.source.blocked {
		border-color: rgba(242, 105, 92, 0.5);
	}

	.warn {
		font-size: 0.72rem;
		color: var(--coral);
	}

	.text {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.name {
		font-weight: 600;
		font-size: 0.9rem;
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}

	.tag {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-faint);
	}

	.stats {
		font-size: 0.72rem;
	}

	.detail {
		margin-top: 0.9rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--edge);
	}

	.blurb {
		font-size: 0.82rem;
		max-width: 62ch;
		margin-top: 0.3rem;
	}

	.mood {
		font-size: 0.78rem;
		color: var(--foam);
		margin-top: 0.35rem;
	}

	.poach {
		width: 100%;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		padding: 0.25rem 0.4rem;
		color: var(--coral);
		border-color: var(--coral);
	}

	.poaching {
		margin: 0.8rem 0 0;
		padding: 0.6rem 0.7rem;
		border: 1px dashed var(--coral);
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.55);
	}

	.poaching .line {
		font-size: 0.8rem;
		margin: 0.25rem 0;
		max-width: 62ch;
	}

	.busted {
		margin: 0.8rem 0 0;
		padding: 0.5rem 0.7rem;
		font-size: 0.82rem;
		color: var(--coral);
		border-left: 2px solid var(--coral);
	}
</style>
