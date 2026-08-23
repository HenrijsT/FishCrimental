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
	<span class="label"><span>{label}</span></span>
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

	/*
	 * The label sits on top of the fill, and the fill's far end is bright foam.
	 * Measured 2.17:1 against `--ink` once progress passed halfway — and the
	 * label is the only thing that says what the game is doing, on every cast,
	 * every exam and the poaching countdown.
	 *
	 * A plate behind the text rather than a lighter colour: the bar has to stay
	 * readable at both ends of a gradient, and a shadow alone does not do it.
	 */
	.label {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		color: var(--ink);
	}

	.label span {
		padding: 0.05rem 0.45rem;
		border-radius: 999px;
		background: rgba(3, 12, 20, 0.82);
	}
</style>
