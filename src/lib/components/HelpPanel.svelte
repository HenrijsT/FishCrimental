<script lang="ts">
	import { availableTopics, livedSetbacks } from '$lib/game/help';
	import { game } from '$lib/game/state.svelte';

	const g = $derived(game.state);
	const topics = $derived(availableTopics(g));
	const setbacks = $derived(livedSetbacks(g));

	let open = $state<string | null>(null);
</script>

<section class="panel">
	<h2>How this works</h2>

	<p class="muted intro">
		Everything here is about something you already have. Nothing in this game is explained before
		you have met it, so this page grows as you do — and reading all of it is a complete account of
		the game you are currently playing.
	</p>

	<ul class="topics">
		{#each topics as topic (topic.id)}
			{@const isOpen = open === topic.id}
			<li>
				<!--
					`aria-controls` only while the panel it names exists. Pointing at
					an id that is not in the document is what axe reports as
					`aria-valid-attr-value`.
				-->
				<button
					class="head"
					aria-expanded={isOpen}
					aria-controls={isOpen ? `help-${topic.id}` : undefined}
					onclick={() => (open = isOpen ? null : topic.id)}
				>
					<span class="title">{topic.title}</span>
					<span class="chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
				</button>
				{#if isOpen}
					<div class="body" id="help-{topic.id}">
						{#each topic.body as paragraph (paragraph)}
							<p>{paragraph}</p>
						{/each}

						{#if topic.id === 'setbacks' && setbacks.length > 0}
							<h3>What has happened to you</h3>
							<ul class="lived">
								{#each setbacks as setback (setback.name)}
									<li><strong>{setback.name}.</strong> {setback.blow}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.intro {
		font-size: 0.82rem;
		max-width: 62ch;
		margin: 0.35rem 0 0.9rem;
	}

	.topics {
		display: grid;
		gap: 0.4rem;
	}

	.head {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		text-align: left;
		font-size: 0.92rem;
		padding: 0.45rem 0.6rem;
	}

	.chevron {
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}

	.body {
		padding: 0.5rem 0.7rem 0.7rem;
		border: 1px solid var(--edge);
		border-top: 0;
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
		background: rgba(4, 16, 27, 0.45);
	}

	.body p {
		font-size: 0.84rem;
		margin: 0.4rem 0;
		max-width: 66ch;
	}

	.body h3 {
		font-size: 0.82rem;
		margin: 0.8rem 0 0.3rem;
	}

	.lived {
		display: grid;
		gap: 0.3rem;
	}

	.lived li {
		font-size: 0.8rem;
		max-width: 66ch;
		color: var(--ink-dim);
	}

	.lived strong {
		color: var(--coral);
	}
</style>
