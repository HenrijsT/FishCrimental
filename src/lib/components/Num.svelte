<script lang="ts">
	import type Decimal from 'break_eternity.js';
	import { formatNumber, type FormatOptions } from '$lib/format';

	interface Props extends FormatOptions {
		value: Decimal | number;
		/** Colour class: coin, pearl or none. */
		tone?: 'coin' | 'pearl' | 'plain';
	}

	let { value, tone = 'plain', ...options }: Props = $props();
</script>

<span class="num" class:coin={tone === 'coin'} class:pearl={tone === 'pearl'}
	>{formatNumber(value, options)}</span
>
