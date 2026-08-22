<script lang="ts">
	interface Tab {
		id: string;
		label: string;
		badge?: string;
	}

	interface Props {
		tabs: Tab[];
		active: string;
		onselect: (id: string) => void;
	}

	let { tabs, active, onselect }: Props = $props();
</script>

<div class="tabs" role="tablist" aria-label="Game sections">
	{#each tabs as tab (tab.id)}
		<button
			role="tab"
			id="tab-{tab.id}"
			aria-selected={active === tab.id}
			aria-controls="panel-{tab.id}"
			tabindex={active === tab.id ? 0 : -1}
			class:active={active === tab.id}
			onclick={() => onselect(tab.id)}
		>
			{tab.label}
			{#if tab.badge}<span class="badge">{tab.badge}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	button {
		padding: 0.35rem 0.7rem;
		font-size: 0.83rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.active {
		border-color: var(--brass);
		background: rgba(242, 181, 68, 0.16);
		font-weight: 600;
	}

	.badge {
		font-size: 0.6rem;
		padding: 0.05rem 0.32rem;
		border-radius: 999px;
		background: var(--coral);
		color: #200a08;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
