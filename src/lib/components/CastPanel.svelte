<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import CastBar from './CastBar.svelte';

	const state = $derived(game.state);
	const label = $derived(
		game.casting
			? `Casting into the ${sources[state.activeSource].name}…`
			: `${game.activeCastSeconds.toFixed(2)}s per cast`
	);

	function hold(event: PointerEvent) {
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		game.beginCast();
	}

	function release() {
		game.endCast();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.repeat) return;
		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			game.beginCast();
		}
	}

	function onkeyup(event: KeyboardEvent) {
		if (event.key === ' ' || event.key === 'Enter') game.endCast();
	}
</script>

<section class="panel cast">
	<CastBar progress={game.castProgress} {label} active={game.casting} />

	<button
		class="rod"
		class:casting={game.casting}
		onpointerdown={hold}
		onpointerup={release}
		onpointercancel={release}
		onpointerleave={release}
		{onkeydown}
		{onkeyup}
		onblur={release}
	>
		<span class="verb">{game.casting ? 'Reeling' : 'Hold to fish'}</span>
		<span class="hint faint">press and hold — or hold space</span>
	</button>
</section>

<style>
	.cast {
		display: grid;
		gap: 0.7rem;
	}

	.rod {
		padding: 1.1rem;
		display: grid;
		gap: 0.15rem;
		border-color: var(--brass-dim);
		background: linear-gradient(180deg, rgba(242, 181, 68, 0.16), rgba(242, 181, 68, 0.05));
		touch-action: none;
		user-select: none;
	}

	.rod:hover:not(:disabled) {
		background: linear-gradient(180deg, rgba(242, 181, 68, 0.26), rgba(242, 181, 68, 0.08));
		border-color: var(--brass);
	}

	.rod.casting {
		border-color: var(--foam);
		background: linear-gradient(180deg, rgba(79, 209, 197, 0.2), rgba(79, 209, 197, 0.06));
	}

	.verb {
		font-size: 1.05rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.hint {
		font-size: 0.72rem;
	}
</style>
