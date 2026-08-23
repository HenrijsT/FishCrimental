<script lang="ts">
	import { HELP_TOPICS } from '$lib/game/help';
	import type { TabId } from '$lib/game/guide';
	import { game } from '$lib/game/state.svelte';
	import Modal from './Modal.svelte';

	interface Props {
		/** The topic to explain, or null for nothing. */
		topic: string | null;
		onclose: () => void;
		onhelp: (tab: TabId) => void;
	}

	let { topic, onclose, onhelp }: Props = $props();

	const entry = $derived(HELP_TOPICS.find((item) => item.id === topic));
</script>

{#if entry && game.state.settings.unlockGuides}
	<Modal title={entry.title} closeLabel="Got it" {onclose}>
		<p class="lead">Something new. Here is the short version.</p>
		{#each entry.body.slice(0, 2) as paragraph (paragraph)}
			<p>{paragraph}</p>
		{/each}
		<p class="faint small">
			All of this lives in Help, along with everything else you have unlocked.
			<button
				class="link"
				onclick={() => {
					onclose();
					onhelp('help');
				}}>Open Help</button
			>
		</p>
	</Modal>
{/if}

<style>
	.lead {
		color: var(--ink-dim);
		font-size: 0.8rem;
		margin: 0 0 0.5rem;
	}

	p {
		font-size: 0.88rem;
		max-width: 60ch;
	}

	.small {
		font-size: 0.75rem;
	}

	.link {
		border: 0;
		background: none;
		padding: 0;
		color: var(--brass);
		text-decoration: underline;
		font: inherit;
		cursor: pointer;
	}
</style>
