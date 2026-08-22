<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { SOURCE_CONFIG, SOURCE_ORDER } from '$lib/game/config';
	import { catchTable, nextLockedSource } from '$lib/game/engine';
	import { sources } from '$lib/fishing_sources';
	import { SCENES } from '$lib/game/scenes';
	import Num from './Num.svelte';
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
				<li>
					<button
						class="source"
						class:active={g.activeSource === source}
						class:locked={!open}
						aria-pressed={open ? g.activeSource === source : undefined}
						disabled={!open && !affordable}
						onclick={() => (open ? game.setSource(source) : game.unlock(source))}
					>
						<SourceThumb {source} dimmed={!open} />
						<span class="text">
							<span class="name">
								{sources[source].name}
								{#if !open}<span class="tag">locked</span>{/if}
							</span>
							{#if open}
								<span class="stats faint">
									{game.modifiers.castSeconds[source].toFixed(2)}s a cast ·
									<Num
										value={catchTable(source, game.modifiers.luck).averageSourceValue}
										tone="coin"
									/> a fish
								</span>
							{:else}
								<span class="stats faint">
									Opens for <Num value={config.unlockCost} tone="coin" /> ·
									{affordable ? 'you can afford it' : 'keep selling'}
								</span>
							{/if}
						</span>
					</button>
				</li>
			{/if}
		{/each}
	</ul>

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
</style>
