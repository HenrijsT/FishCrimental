<script lang="ts">
	import { nextStep } from '$lib/game/guide';
	import { game } from '$lib/game/state.svelte';

	interface Props {
		onnavigate: (tab: string) => void;
	}

	let { onnavigate }: Props = $props();

	const step = $derived(nextStep(game.state));
</script>

{#if step}
	<div class="step">
		<span class="mark" aria-hidden="true">▸</span>
		<p>{step.text}</p>
		{#if step.tab}
			<button onclick={() => onnavigate(step.tab!)}>Take me there</button>
		{/if}
	</div>
{/if}

<style>
	.step {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
		padding: 0.5rem 0.75rem;
		border: 1px solid rgba(79, 209, 197, 0.4);
		border-left-width: 3px;
		border-radius: var(--radius-sm);
		background: rgba(79, 209, 197, 0.08);
	}

	.mark {
		color: var(--foam);
	}

	p {
		flex: 1;
		min-width: 12rem;
		font-size: 0.83rem;
	}

	button {
		font-size: 0.75rem;
		padding: 0.25rem 0.6rem;
	}
</style>
