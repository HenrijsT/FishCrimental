<script lang="ts">
	import type Decimal from 'break_eternity.js';
	import type { Writable } from 'svelte/store';

	export let count: Writable<Decimal>;
</script>

<slot />
{$count.toFixed(0)}
