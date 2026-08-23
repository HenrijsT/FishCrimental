<script lang="ts">
	import { game } from '$lib/game/state.svelte';
	import { sources } from '$lib/fishing_sources';
	import { RARITY_LABEL } from '$lib/game/engine';
	import { describePerCast } from '$lib/format';
	import { SCENES } from '$lib/game/scenes';
	import CastBar from './CastBar.svelte';
	import Num from './Num.svelte';
	import WaterScene from './WaterScene.svelte';

	const g = $derived(game.state);
	const scene = $derived(SCENES[g.activeSource]);

	let landing = $state(false);
	let flash = $state<typeof game.lastCatch>(null);
	let landingTimer: ReturnType<typeof setTimeout> | undefined;
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	// A cast reads as three states: the line going out, the line in the water,
	// and the moment something comes up. The bar alone showed only the middle one.
	$effect(() => {
		const pulse = game.catchPulse;
		if (pulse === 0) return;

		flash = game.lastCatch;
		landing = true;

		clearTimeout(landingTimer);
		clearTimeout(flashTimer);
		landingTimer = setTimeout(() => (landing = false), 430);
		flashTimer = setTimeout(() => (flash = null), 1700);

		return () => {
			clearTimeout(landingTimer);
			clearTimeout(flashTimer);
		};
	});

	const phase = $derived<'idle' | 'casting' | 'landing'>(
		landing ? 'landing' : game.casting ? 'casting' : 'idle'
	);

	const label = $derived(
		game.casting
			? game.castProgress < 0.3
				? 'Casting…'
				: 'Waiting for a bite…'
			: `${game.activeCastSeconds.toFixed(2)}s per cast`
	);

	let captured: { element: HTMLElement; pointerId: number } | null = null;

	/**
	 * The cast belongs to the finger that started it.
	 *
	 * A second contact — a palm, a resting thumb, a tremor — used to overwrite
	 * `captured` with its own pointer id, and lifting *it* then ended a cast the
	 * first finger was still holding. The people most likely to produce a stray
	 * second contact are the people least able to afford losing the cast.
	 */
	function hold(event: PointerEvent) {
		if (captured !== null) return;

		const element = event.currentTarget as HTMLElement;
		try {
			element.setPointerCapture(event.pointerId);
			captured = { element, pointerId: event.pointerId };
		} catch {
			captured = { element, pointerId: event.pointerId };
		}
		game.beginCast();
	}

	function release(event?: PointerEvent) {
		// Any other finger lifting is not the end of this cast.
		if (event && captured && event.pointerId !== captured.pointerId) return;

		if (captured) {
			try {
				captured.element.releasePointerCapture(captured.pointerId);
			} catch {
				// Already released.
			}
			captured = null;
		}
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
	<div class="stage">
		<WaterScene
			source={g.activeSource}
			{phase}
			progress={game.castProgress}
			still={g.settings.reduceMotion}
		/>

		<div class="overlay">
			<span class="where">{sources[g.activeSource].name}</span>
			{#if flash}
				<div class="flash rarity-{flash.rarity}" class:still={g.settings.reduceMotion}>
					<span class="tier">{RARITY_LABEL[flash.rarity]}</span>
					<span class="fish">
						{flash.fish.name}{#if flash.count.gt(1)}&nbsp;×<Num value={flash.count} />{/if}
					</span>
					<span class="worth"><Num value={flash.value} tone="coin" /></span>
				</div>
			{/if}
		</div>
	</div>

	<p class="mood faint">{scene.mood}</p>

	<CastBar progress={game.castProgress} {label} active={game.casting} />

	<p class="rate faint">{describePerCast(game.modifiers.fishPerCast)}</p>

	<button
		class="rod"
		class:casting={game.casting}
		onpointerdown={hold}
		onpointerup={release}
		onpointercancel={release}
		onpointerleave={release}
		{onkeydown}
		{onkeyup}
		onblur={() => release()}
	>
		<span class="verb">{game.casting ? 'Reeling' : 'Hold to fish'}</span>
		<span class="hint faint">press and hold — or hold space</span>
	</button>
</section>

<style>
	.cast {
		display: grid;
		gap: 0.6rem;
	}

	.stage {
		position: relative;
	}

	.overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 0.5rem 0.6rem;
	}

	.where {
		align-self: flex-start;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		background: rgba(4, 16, 27, 0.55);
		color: var(--ink);
	}

	.flash {
		align-self: center;
		margin-top: auto;
		display: grid;
		justify-items: center;
		gap: 0.05rem;
		padding: 0.35rem 0.85rem;
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.82);
		border: 1px solid var(--edge);
		animation: rise 1.7s ease-out forwards;
	}

	.flash.still {
		animation: none;
	}

	.tier {
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--ink-faint);
	}

	.fish {
		font-size: 0.95rem;
		font-weight: 700;
	}

	.worth {
		font-size: 0.74rem;
	}

	/* Rarity has to be visible at a glance, not read. */
	.rarity-uncommon {
		border-color: #6fb3d8;
	}
	.rarity-uncommon .fish {
		color: #a8d8f0;
	}

	.rarity-rare {
		border-color: var(--foam);
		box-shadow: 0 0 0.9rem rgba(79, 209, 197, 0.35);
	}
	.rarity-rare .fish {
		color: var(--foam);
	}

	.rarity-exotic {
		border-color: var(--pearl);
		box-shadow: 0 0 1.2rem rgba(216, 199, 238, 0.45);
	}
	.rarity-exotic .fish {
		color: var(--pearl);
	}

	.rarity-mythic {
		border-color: var(--brass);
		box-shadow:
			0 0 1.6rem rgba(242, 181, 68, 0.6),
			inset 0 0 1rem rgba(242, 181, 68, 0.2);
	}
	.rarity-mythic .fish {
		color: var(--brass);
		font-size: 1.1rem;
		letter-spacing: 0.01em;
	}
	.rarity-mythic .tier {
		color: var(--brass);
	}

	@keyframes rise {
		0% {
			opacity: 0;
			transform: translateY(10px) scale(0.94);
		}
		14% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		74% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-12px);
		}
	}

	.mood {
		font-size: 0.75rem;
		margin-top: -0.15rem;
	}

	.rate {
		font-size: 0.73rem;
		margin-top: -0.3rem;
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
