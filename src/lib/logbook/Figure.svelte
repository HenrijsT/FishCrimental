<script lang="ts">
	import type Decimal from 'break_eternity.js';
	import { formatNumber } from '$lib/format';
	import { game } from '$lib/game/state.svelte';

	interface Props {
		value: Decimal | number;
		/** Coins get a currency mark; plain counts do not. */
		coin?: boolean;
		precision?: number;
	}

	let { value, coin = false, precision }: Props = $props();

	const text = $derived(
		formatNumber(value, {
			notation: game.state.settings.scientificNotation ? 'scientific' : 'short',
			...(precision === undefined ? {} : { precision })
		})
	);
</script>

<span class="fig" class:fig-coin={coin}
	>{#if coin}<span class="mark">¤</span>{/if}{text}</span
>

<style>
	.fig {
		font-family: var(--figure);
		font-variant-numeric: tabular-nums;
		font-size: 0.94em;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	.mark {
		opacity: 0.5;
		margin-right: 0.12em;
	}

	.fig-coin {
		font-weight: 400;
	}
</style>
