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

	/**
	 * Exactly one Modal is ever mounted — `ModalHost` guarantees it — so this is
	 * the only Escape handler in the document. Three sibling modals used to
	 * mount three of these, and one Escape closed every open dialog at once.
	 */
	function onwindowkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onclose();
	}

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function focusable(): HTMLElement[] {
		if (!dialog) return [];
		return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
	}

	/**
	 * Keep Tab inside the dialog. Without this the second Tab press already
	 * reached a toast button — painted *behind* the backdrop, since the toasts
	 * sit at a lower z-index than it does.
	 */
	function ontrap(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const items = focusable();
		if (items.length === 0) {
			event.preventDefault();
			dialog?.focus();
			return;
		}

		const first = items[0];
		const last = items[items.length - 1];
		const current = document.activeElement;

		if (event.shiftKey && (current === first || current === dialog)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && current === last) {
			event.preventDefault();
			first.focus();
		}
	}

	$effect(() => {
		// Hand focus back to whatever raised the dialog. After closing, the
		// active element used to be BODY, which drops a keyboard user at the top
		// of the page with no idea where they were.
		const previous = document.activeElement as HTMLElement | null;
		dialog?.focus();

		return () => previous?.focus?.();
	});
</script>

<svelte:window onkeydown={onwindowkeydown} />

<div class="backdrop">
	<div
		class="panel dialog"
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
		bind:this={dialog}
		onkeydown={ontrap}
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
