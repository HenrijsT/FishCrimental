// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mount, unmount, flushSync, type Component } from 'svelte';
import { D } from '$lib/decimal';
import { SOURCE_ORDER } from '$lib/game/config';
import { FishType } from '$lib/fish_types';
import { canPoach } from '$lib/game/police';
import { game } from '$lib/game/state.svelte';
import HoldPanel from './HoldPanel.svelte';
import SourcePicker from './SourcePicker.svelte';

/**
 * The first tests in the repo that render a component.
 *
 * Everything here exists because of one defect. `police.ts` is some three
 * hundred lines — a grace period, escalating fines, confiscation, an offence
 * ledger, a bust banner and a Help topic — and none of it could fire, because
 * `SourcePicker` gated the button on `unlocked && missingLicence`, a pair the
 * engine cannot construct. `hunt.test.ts` has a case named "poaching is
 * reachable at all"; it asserts `canPoach`, the engine predicate *behind* the
 * button. It passed throughout.
 *
 * A six-agent bug hunt and six hundred green tests did not catch a dead `{#if}`,
 * and they could not have: `vite.config.ts` ran every test in `node`, so no test
 * in the project had ever rendered a `.svelte` file. That is the hole these
 * close — an engine predicate being true is not the same claim as a player being
 * able to reach it.
 */

let host: Record<string, unknown> | null = null;
let target: HTMLElement | null = null;

function render(component: Component = SourcePicker) {
	target = document.createElement('div');
	document.body.appendChild(target);
	host = mount(component, { target });
	flushSync();
	return target;
}

afterEach(() => {
	if (host) unmount(host);
	target?.remove();
	host = null;
	target = null;
});

describe('the poach button is actually reachable', () => {
	it('renders on water the player has no right to be on', () => {
		// A chart good enough to see past the water that is owned. This is the
		// state `canPoach` describes, and until this test it was never asserted
		// against the surface.
		game.state.mapLevel = D(3);

		const poachable = SOURCE_ORDER.filter((source) => canPoach(game.state, source));
		expect(poachable.length).toBeGreaterThan(0);

		const el = render();
		const buttons = [...el.querySelectorAll('button.poach')];

		expect(buttons.length).toBeGreaterThan(0);
		expect(buttons[0].textContent).toContain('Fish it anyway');
	});

	it('is not offered on water the player owns', () => {
		game.state.mapLevel = D(3);
		const el = render();

		const owned = SOURCE_ORDER.filter((source) => game.state.unlocked[source]);
		expect(owned.length).toBeGreaterThan(0);

		// Every rendered poach button must belong to water that is not owned.
		for (const button of el.querySelectorAll('button.poach')) {
			const li = button.closest('li');
			expect(li?.querySelector('button.source.locked')).not.toBeNull();
		}
	});
});

describe('every render guard in the picker is satisfiable', () => {
	it('shows owned water, the next lock, and poachable water together', () => {
		game.state.mapLevel = D(3);
		const el = render();

		expect(el.querySelectorAll('li').length).toBeGreaterThan(1);
		expect(el.querySelector('button.source')).not.toBeNull();
		expect(el.querySelector('button.source.locked')).not.toBeNull();
	});
});

describe('the List button is only live when a whole fish can move', () => {
	// `listForSale` floors what it moves, and bucket capacity is `30 x 3.4^level`
	// — fractional from level 2 up. At `gt(0)` the quay parked on 346 of 346.8,
	// the button stayed enabled, and every click was a no-op with nothing on
	// screen to say why.
	it('says the quay is full when the room left is under one fish', () => {
		game.state.bucketLevel = D(2);
		game.state.consignment[FishType.Small] = D(346);
		game.state.hold[FishType.Small] = D(10);
		game.state.holdValue = D(20);

		expect(game.listedRoom!.gt(0)).toBe(true);
		expect(game.listedRoom!.gte(1)).toBe(false);

		const el = render(HoldPanel);
		const list = [...el.querySelectorAll('button')].find((button) =>
			/Quay full|List for the merchant/.test(button.textContent ?? '')
		);

		expect(list).toBeDefined();
		expect(list!.textContent).toContain('Quay full');
		expect((list as HTMLButtonElement).disabled).toBe(true);
	});
});
