<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		onclose: () => void;
		closeLabel?: string;
		children: Snippet;
	}

	let { title, onclose, closeLabel = 'Close', children }: Props = $props();

	let dialog = $state<HTMLDivElement | null>(null);

	$effect(() => {
		dialog?.focus();
	});

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

<div class="backdrop">
	<div
		class="panel dialog"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		bind:this={dialog}
	>
		<h2>{title}</h2>
		{@render children()}
		<button class="close" onclick={onclose}>{closeLabel}</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		padding: 1rem;
		background: rgba(3, 12, 20, 0.78);
	}

	.dialog {
		width: min(30rem, 100%);
		max-height: 85vh;
		overflow-y: auto;
		display: grid;
		gap: 0.75rem;
		box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.5);
	}

	.close {
		justify-self: end;
	}
</style>
