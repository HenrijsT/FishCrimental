<script lang="ts">
	import { offlineSeconds } from '$lib/game/engine';
	import { game } from '$lib/game/state.svelte';
	import { formatDuration } from '$lib/format';
	import Num from './Num.svelte';

	// Named `g`, not `state` — see the note in Fishdex.svelte.
	const g = $derived(game.state);

	let blob = $state('');
	let importText = $state('');
	let message = $state('');
	let confirmingReset = $state(false);

	function exportSave() {
		blob = game.exportBlob();
		message = 'Save copied into the box below. Keep it somewhere safe.';
	}

	function runImport() {
		if (!importText.trim()) return;
		const ok = game.importBlob(importText);
		message = ok ? 'Save loaded.' : 'That is not a FishCrimental save — nothing was changed.';
		if (ok) importText = '';
	}

	function reset() {
		game.hardReset();
		confirmingReset = false;
		message = 'Everything is gone. Back to the Pond.';
	}
</script>

<section class="panel">
	<h2>Settings</h2>

	<ul class="toggles">
		<li>
			<label>
				<input type="checkbox" bind:checked={g.settings.offlineProgress} />
				<span>
					<strong>Offline progress</strong>
					<span class="muted">
						The crew keep fishing while the tab is closed, up to {formatDuration(
							offlineSeconds(g)
						)}. Nothing else happens — nobody sells, and no merchant calls.
					</span>
				</span>
			</label>
		</li>
		<li>
			<label>
				<input type="checkbox" bind:checked={g.settings.reduceMotion} />
				<span>
					<strong>Reduce motion</strong>
					<span class="muted">Stop the cast bar and panels animating.</span>
				</span>
			</label>
		</li>
		<li>
			<label>
				<input type="checkbox" bind:checked={g.settings.scientificNotation} />
				<span>
					<strong>Scientific notation</strong>
					<span class="muted">
						Show <Num value={1234567} notation="scientific" /> instead of
						<Num value={1234567} notation="short" />.
					</span>
				</span>
			</label>
		</li>
	</ul>

	<h3>Your save</h3>
	<p class="muted small">
		The game saves to this browser every 10 seconds and when you leave the page. Export it as text
		to move it somewhere else.
	</p>

	<div class="row">
		<button onclick={() => game.save()}>Save now</button>
		<button onclick={exportSave}>Export</button>
	</div>

	{#if blob}
		<label class="field">
			<span class="visually-hidden">Exported save</span>
			<textarea readonly rows="3" value={blob}></textarea>
		</label>
	{/if}

	<label class="field">
		<span class="small muted">Paste a save to load it</span>
		<textarea rows="3" bind:value={importText} placeholder="FISHC1.…"></textarea>
	</label>
	<div class="row">
		<button onclick={runImport} disabled={!importText.trim()}>Import</button>
	</div>

	{#if message}
		<p class="message" aria-live="polite">{message}</p>
	{/if}

	<h3 class="danger-heading">Start over</h3>
	{#if confirmingReset}
		<div class="danger">
			<p>
				This deletes the Fishdex, every Pearl and all
				<Num value={g.prestigeCount} /> completed runs. There is no undo.
			</p>
			<div class="row">
				<button class="danger-button" onclick={reset}>Delete everything</button>
				<button onclick={() => (confirmingReset = false)}>Keep it</button>
			</div>
		</div>
	{:else}
		<button class="danger-button" onclick={() => (confirmingReset = true)}>Wipe the save</button>
	{/if}
</section>

<style>
	h3 {
		margin-top: 1.2rem;
	}

	.toggles {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.7rem;
	}

	.toggles label {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		padding: 0.5rem 0.6rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.5);
		cursor: pointer;
	}

	.toggles input {
		margin-top: 0.25rem;
		accent-color: var(--brass);
	}

	.toggles span span {
		display: block;
		font-size: 0.76rem;
	}

	.small {
		font-size: 0.78rem;
	}

	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
	}

	.field {
		display: grid;
		gap: 0.25rem;
		margin-top: 0.6rem;
	}

	textarea {
		width: 100%;
		font-family: var(--mono);
		font-size: 0.72rem;
		resize: vertical;
		word-break: break-all;
	}

	.message {
		margin-top: 0.6rem;
		font-size: 0.8rem;
		color: var(--foam);
	}

	.danger-heading {
		color: var(--coral);
	}

	.danger {
		display: grid;
		gap: 0.5rem;
		padding: 0.7rem;
		border: 1px solid var(--coral);
		border-radius: var(--radius-sm);
		background: rgba(242, 105, 92, 0.1);
		font-size: 0.85rem;
	}

	.danger-button {
		border-color: var(--coral);
		color: var(--coral);
	}

	.danger-button:hover:not(:disabled) {
		background: rgba(242, 105, 92, 0.18);
		border-color: var(--coral);
	}
</style>
