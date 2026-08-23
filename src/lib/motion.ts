import { game } from './game/state.svelte';

/**
 * How a programmatic scroll should move.
 *
 * `behavior: 'smooth'` is not covered by the reduced-motion CSS: that override
 * only touches `animation-duration` and `transition-duration`, and a smooth
 * scroll is neither. So both signals are checked here — the operating system's,
 * and the one the player set inside the game — and a long animated scroll is
 * not fired at somebody who has asked twice for things to stop moving.
 */
export function scrollBehaviour(): ScrollBehavior {
	if (game.state.settings.reduceMotion) return 'auto';
	if (typeof window === 'undefined' || !window.matchMedia) return 'smooth';
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
