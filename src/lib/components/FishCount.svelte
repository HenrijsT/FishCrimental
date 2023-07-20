<script lang="ts">
	import type Big from 'big.js';
	import type { Writable } from 'svelte/store';

	export let count: Writable<Big>;
</script>

<slot />
{$count} /
