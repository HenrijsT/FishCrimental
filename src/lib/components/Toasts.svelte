<script lang="ts">
	import { ACHIEVEMENTS_BY_ID } from '$lib/game/achievements';
	import type { TabId } from '$lib/game/guide';
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import { describeTrack } from '$lib/game/setbacks';
	import Num from './Num.svelte';

	interface Props {
		/** Jump to a tab, and optionally to something inside it. */
		onnavigate: (tab: TabId, focus?: string) => void;
	}

	let { onnavigate }: Props = $props();
</script>

<div class="toasts" aria-live="polite">
	{#each game.setbackHits as hit (hit.id)}
		<div class="toast setback">
			<div class="body plain">
				<span class="kicker">Setback</span>
				<span class="name">{hit.name}</span>
				<span class="desc">
					{hit.blow}
					<br />
					{hit.levels === 1 ? 'One level' : `${hit.levels} levels`} of {describeTrack(hit.track)} gone,
					{Math.round(hit.seconds)} seconds of income with them{#if hit.refunded.gt(0)}, and
						<Num value={hit.refunded} tone="coin" /> back for the rest{/if}.
				</span>
			</div>
			<button
				class="dismiss"
				aria-label="Dismiss {hit.name}"
				onclick={() => game.dismissSetbackHit(hit.id)}>×</button
			>
		</div>
	{/each}

	{#each game.setbackNotices as notice (notice.id)}
		<div class="toast notice">
			<div class="body plain">
				<span class="kicker">Word on the water</span>
				<span class="name">{notice.name}</span>
				<span class="desc">{notice.notice} The longer this goes on, the worse it will be.</span>
			</div>
			<button
				class="dismiss"
				aria-label="Dismiss the word about {notice.name}"
				onclick={() => game.dismissSetbackNotice(notice.id)}>×</button
			>
		</div>
	{/each}

	{#if game.lastBust}
		{@const caught = game.lastBust}
		<div class="toast bust">
			<div class="body plain">
				<span class="kicker">Caught</span>
				<span class="name">A warden on the {sources[caught.source].name}</span>
				<span class="desc">
					{#if caught.confiscated.gt(0)}
						<Num value={caught.confiscated} tone="coin" /> of catch back in the water.
					{/if}
					{#if caught.fine.gt(0)}
						Fined <Num value={caught.fine} tone="coin" />.
					{:else}
						A warning, this time.
					{/if}
					Off the water for a minute, and put ashore at the {sources[caught.movedTo].name}.
				</span>
			</div>
			<button class="dismiss" aria-label="Dismiss the warden" onclick={() => game.dismissBust()}
				>×</button
			>
		</div>
	{/if}

	{#each game.newAchievements as id (id)}
		{@const achievement = ACHIEVEMENTS_BY_ID.get(id)}
		{#if achievement}
			<div class="toast">
				<button
					class="body"
					onclick={() => {
						game.dismissAchievement(id);
						onnavigate('records', id);
					}}
				>
					<span class="kicker">Record · tap to see it</span>
					<span class="name">{achievement.name}</span>
					<span class="desc">{achievement.description}</span>
				</button>
				<button
					class="dismiss"
					aria-label="Dismiss {achievement.name}"
					onclick={() => game.dismissAchievement(id)}>×</button
				>
			</div>
		{/if}
	{/each}

	{#each game.newlyUnlockedSpecies as fish (fish.name)}
		<div class="toast species">
			<button
				class="body"
				onclick={() => {
					game.dismissNewSpecies();
					onnavigate('dex', fish.name);
				}}
			>
				<span class="kicker">New in the Fishdex · tap to read it</span>
				<span class="name">{fish.name}</span>
				<span class="desc">{fish.description}</span>
			</button>
			<button
				class="dismiss"
				aria-label="Dismiss {fish.name}"
				onclick={() => game.dismissSpecies(fish.name)}>×</button
			>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 15;
		display: grid;
		gap: 0.5rem;
		width: min(20rem, calc(100vw - 2rem));
	}

	.toast {
		display: flex;
		align-items: stretch;
		border: 1px solid var(--brass);
		border-radius: var(--radius-sm);
		background: linear-gradient(180deg, rgba(242, 181, 68, 0.2), rgba(13, 33, 53, 0.96));
		box-shadow: 0 0.6rem 1.4rem rgba(0, 0, 0, 0.45);
		overflow: hidden;
	}

	.toast.species {
		border-color: var(--foam);
		background: linear-gradient(180deg, rgba(79, 209, 197, 0.2), rgba(13, 33, 53, 0.96));
	}

	.body {
		flex: 1;
		display: grid;
		gap: 0.15rem;
		text-align: left;
		padding: 0.6rem 0.75rem;
		border: 0;
		background: none;
		border-radius: 0;
		min-width: 0;
	}

	.dismiss {
		border: 0;
		border-left: 1px solid rgba(255, 255, 255, 0.12);
		background: none;
		border-radius: 0;
		padding: 0 0.7rem;
		font-size: 1.1rem;
		line-height: 1;
		color: var(--ink-dim);
	}

	.kicker {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: var(--ink-faint);
	}

	.name {
		font-weight: 700;
		font-size: 0.92rem;
	}

	.desc {
		font-size: 0.74rem;
		color: var(--ink-dim);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.toast.bust,
	.toast.setback {
		border-color: var(--coral);
	}

	.toast.notice {
		border-color: var(--brass-dim);
	}

	.body.plain {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		text-align: left;
		padding: 0.5rem 0.6rem;
	}
</style>
