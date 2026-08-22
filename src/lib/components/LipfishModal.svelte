<script lang="ts">
	import { OddityFishes, oddityFishes } from '$lib/fishes/oddity_fishes';
	import { fishTypeBaseValue } from '$lib/fish_types';
	import { FishType } from '$lib/fish_types';
	import { game } from '$lib/game/state.svelte';
	import Modal from './Modal.svelte';
	import Num from './Num.svelte';

	const lipfish = oddityFishes[OddityFishes.LovestruckLipfish];
</script>

{#if game.lipfishReveal}
	<Modal
		title="Something is looking at you"
		closeLabel="Look away"
		onclose={() => game.dismissLipfish()}
	>
		<p class="name">{lipfish.name}</p>
		<p class="desc">{lipfish.description}</p>
		<p class="worth">
			Base value <Num value={fishTypeBaseValue[FishType.Erotic]} tone="coin" /> coins — the single most
			valuable thing in the water, and you cannot make eye contact with it.
		</p>
	</Modal>
{/if}

<style>
	.name {
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--coral);
	}

	.desc {
		font-size: 0.9rem;
		line-height: 1.55;
	}

	.worth {
		font-size: 0.8rem;
		color: var(--ink-dim);
	}
</style>
