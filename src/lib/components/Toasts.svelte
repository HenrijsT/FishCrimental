<script lang="ts">
	import { ACHIEVEMENTS_BY_ID } from '$lib/game/achievements';
	import { game } from '$lib/game/state.svelte';
</script>

<div class="toasts" aria-live="polite">
	{#each game.newAchievements as id (id)}
		{@const achievement = ACHIEVEMENTS_BY_ID.get(id)}
		{#if achievement}
			<button class="toast" onclick={() => game.dismissAchievement(id)}>
				<span class="kicker">Record</span>
				<span class="name">{achievement.name}</span>
				<span class="desc">{achievement.description}</span>
			</button>
		{/if}
	{/each}

	{#each game.newlyUnlockedSpecies as fish (fish.name)}
		<button class="toast species" onclick={() => game.dismissNewSpecies()}>
			<span class="kicker">New in the Fishdex</span>
			<span class="name">{fish.name}</span>
			<span class="desc">{fish.description}</span>
		</button>
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
		display: grid;
		gap: 0.15rem;
		text-align: left;
		padding: 0.6rem 0.75rem;
		border-color: var(--brass);
		background: linear-gradient(180deg, rgba(242, 181, 68, 0.2), rgba(13, 33, 53, 0.95));
		box-shadow: 0 0.6rem 1.4rem rgba(0, 0, 0, 0.45);
	}

	.toast.species {
		border-color: var(--foam);
		background: linear-gradient(180deg, rgba(79, 209, 197, 0.2), rgba(13, 33, 53, 0.95));
	}

	.kicker {
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
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
</style>
