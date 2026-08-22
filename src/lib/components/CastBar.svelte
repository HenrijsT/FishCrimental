<script lang="ts">
	interface Props {
		/** 0 → 1. */
		progress: number;
		label: string;
		active: boolean;
	}

	let { progress, label, active }: Props = $props();
</script>

<div
	class="track"
	class:active
	role="progressbar"
	aria-label={label}
	aria-valuemin="0"
	aria-valuemax="100"
	aria-valuenow={Math.round(progress * 100)}
>
	<div class="fill" style:width="{Math.min(100, progress * 100)}%"></div>
	<span class="label">{label}</span>
</div>

<style>
	.track {
		position: relative;
		height: 1.6rem;
		border: 1px solid var(--edge);
		border-radius: var(--radius-sm);
		background: rgba(4, 16, 27, 0.7);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: linear-gradient(90deg, #1d5f7a, var(--foam));
		opacity: 0.55;
		transition: width 60ms linear;
	}

	.active .fill {
		opacity: 0.85;
	}

	.label {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--ink);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
	}
</style>
