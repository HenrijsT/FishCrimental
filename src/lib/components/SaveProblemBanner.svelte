<script lang="ts">
	import { game } from '$lib/game/state.svelte';

	const problem = $derived(game.saveProblem);

	let copied = $state('');

	/**
	 * Every one of these states ends with the player possibly losing a save, so
	 * the banner carries the backup rather than pointing at Settings — which,
	 * for a corrupt or future save, would have exported the blank replacement.
	 */
	async function copyBackup() {
		const blob = game.exportBlob();
		try {
			await navigator.clipboard.writeText(blob);
			copied = 'Copied. Paste it somewhere safe.';
		} catch {
			copied = 'Clipboard blocked — use Export in Settings instead.';
		}
	}
</script>

{#if problem}
	<div class="banner" role="alert">
		<div>
			<strong>
				{#if problem.kind === 'future'}
					Save from a newer version
				{:else if problem.kind === 'conflict'}
					Open in another tab
				{:else if problem.kind === 'write-failed'}
					This browser is not storing your save
				{:else}
					Save could not be read
				{/if}
			</strong>
			<p>{problem.message}</p>
			{#if copied}<p class="copied">{copied}</p>{/if}
		</div>
		<div class="actions">
			<button onclick={copyBackup}>Copy backup</button>
			{#if problem.kind === 'conflict'}
				<button onclick={() => location.reload()}>Reload</button>
			{/if}
			<button onclick={() => game.dismissSaveProblem()}>Dismiss</button>
		</div>
	</div>
{/if}

<style>
	.banner {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap);
		align-items: center;
		justify-content: space-between;
		border: 1px solid var(--coral);
		border-radius: var(--radius);
		background: rgba(242, 105, 92, 0.12);
		padding: 0.7rem 0.85rem;
	}

	strong {
		display: block;
		font-size: 0.9rem;
		color: var(--coral);
	}

	p {
		font-size: 0.8rem;
		color: var(--ink-dim);
		max-width: 62ch;
		margin-top: 0.15rem;
	}

	.copied {
		color: var(--ink);
		margin-top: 0.3rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
</style>
