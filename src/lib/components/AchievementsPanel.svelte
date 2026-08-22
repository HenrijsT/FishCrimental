<script lang="ts">
	import { ACHIEVEMENTS } from '$lib/game/achievements';
	import { game } from '$lib/game/state.svelte';

	const g = $derived(game.state);
	const earned = $derived(new Set(g.achievements));
	const visible = $derived(ACHIEVEMENTS.filter((a) => !a.secret || earned.has(a.id)));
	const hiddenCount = $derived(ACHIEVEMENTS.length - visible.length);
</script>

<section class="panel">
	<div class="head">
		<h2>Records</h2>
		<p class="score">{earned.size} / {ACHIEVEMENTS.length}</p>
	</div>

	<ul class="list">
		{#each visible as achievement (achievement.id)}
			<li class:got={earned.has(achievement.id)}>
				<span class="mark" aria-hidden="true">{earned.has(achievement.id) ? '●' : '○'}</span>
				<div>
					<p class="name">{achievement.name}</p>
					<p class="desc muted">{achievement.description}</p>
				</div>
			</li>
		{/each}
	</ul>

	{#if hiddenCount > 0}
		<p class="faint hidden-note">
			{hiddenCount} record{hiddenCount === 1 ? '' : 's'} still hidden. You will know it when it happens.
		</p>
	{/if}
</section>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--gap);
	}

	.score {
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}

	.list {
		display: grid;
		gap: 0.3rem;
		margin-top: 0.7rem;
	}

	li {
		display: flex;
		gap: 0.55rem;
		align-items: flex-start;
		padding: 0.4rem 0.55rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
		opacity: 0.55;
	}

	li.got {
		opacity: 1;
		border-left: 2px solid var(--brass);
	}

	.mark {
		color: var(--brass);
		font-size: 0.7rem;
		line-height: 1.6;
	}

	.name {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.desc {
		font-size: 0.75rem;
	}

	.hidden-note {
		margin-top: 0.7rem;
		font-size: 0.75rem;
	}
</style>
