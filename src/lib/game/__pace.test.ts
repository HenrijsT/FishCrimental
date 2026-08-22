import { describe, it } from 'vitest';
import { simulateRun } from './balance';

function mmss(s: number | null) {
	if (s === null) return 'never';
	const m = Math.floor(s / 60);
	return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m${String(Math.round(s % 60)).padStart(2, '0')}s`;
}

describe('pacing probe', () => {
	it('reports', () => {
		for (const uptime of [1, 0.5]) {
			const r = simulateRun({ manualUptime: uptime, maxSeconds: 60 * 60 * 12 });
			const u = r.unlockedAt as Record<string, number>;
			console.log(
				`PACE uptime=${uptime} prestige=${mmss(r.secondsToPrestige)} lifetime=${r.lifetimeCoins.toExponential(3)} idle=${mmss(r.idleCrossoverAt)} boat=${mmss(r.boatAt)}`
			);
			console.log(
				'     sources: ' +
					Object.entries(u)
						.map(([k, v]) => `${k}=${mmss(v)}`)
						.join(' ')
			);
			console.log(
				'     upgrades: ' +
					Object.entries(r.state.upgrades)
						.map(([k, v]) => `${k}=${v.toString()}`)
						.join(' ')
			);
		}
	}, 900000);
});
