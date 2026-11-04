import { describe, expect, it } from 'vitest';
import { dataset } from '../data';
import { fitCjs, survival, type CjsGroup, type CjsHistory } from './survival';

/** Seeded uniform draws (mulberry32). */
function rng(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const expit = (v: number) => 1 / (1 + Math.exp(-v));

/**
 * Pups arrive through the season and stay each fortnight with chance φ[nursery]; a fortnight
 * with h net-hours catches a pup that is there with p = 1 − exp(−q·h). `transient` pups leave
 * after their first fortnight whatever φ is. Pups never caught don't enter a CJS data set.
 */
function simulate(seed: number, phi: number[], q: number[], transient = 0) {
	const u = rng(seed);
	const groups: CjsGroup[] = [];
	const histories: CjsHistory[] = [];
	for (let n = 0; n < phi.length; n++)
		for (let season = 0; season < 8; season++) {
			const hours = Array.from({ length: 12 }, () => (u() < 0.2 ? 0 : 1.5 + 2.5 * u()));
			const g = groups.length;
			groups.push({ nursery: n, hours });
			for (let pup = 0; pup < 70; pup++) {
				const leavesEarly = u() < transient;
				const seen: number[] = [];
				let firstSeen = -1;
				for (let t = Math.floor(u() * 8); t < 12; t++) {
					if (hours[t] > 0 && u() < 1 - Math.exp(-q[n] * hours[t])) {
						seen.push(t);
						if (firstSeen < 0) firstSeen = t;
					}
					if (leavesEarly && firstSeen >= 0) break;
					if (u() > phi[n]) break;
				}
				if (seen.length) histories.push({ group: g, seen });
			}
		}
	return { groups, histories };
}

describe('Cormack–Jolly–Seber apparent survival (#42)', () => {
	it('recovers a shared φ and the effort slope', () => {
		const { groups, histories } = simulate(1, [0.8, 0.8, 0.8], [0.25, 0.15, 0.35]);
		const fit = fitCjs(groups, histories, 3)!;
		expect(expit(fit.theta[0])).toBeGreaterThan(0.74);
		expect(expit(fit.theta[0])).toBeLessThan(0.86);
		// p = 1 − exp(−q·h) is the cloglog model with β = 1 and aₙ = log qₙ.
		expect(fit.theta[4]).toBeGreaterThan(0.6);
		expect(fit.theta[4]).toBeLessThan(1.4);
		expect(fit.theta[3]).toBeCloseTo(Math.log(0.35), 0);
		expect(fit.se[0]).not.toBeNull();
	});

	it('tells nurseries apart when φ differs, and not when it does not', () => {
		const diff = simulate(2, [0.9, 0.6], [0.25, 0.25]);
		const shared = fitCjs(diff.groups, diff.histories, 2)!;
		const each = fitCjs(diff.groups, diff.histories, 2, { nurseryPhi: true })!;
		expect(expit(each.theta[0])).toBeCloseTo(0.9, 1);
		expect(expit(each.theta[1])).toBeCloseTo(0.6, 1);
		expect(2 * (each.loglik - shared.loglik)).toBeGreaterThan(10);

		const same = simulate(3, [0.8, 0.8], [0.25, 0.25]);
		const s0 = fitCjs(same.groups, same.histories, 2)!;
		const s1 = fitCjs(same.groups, same.histories, 2, { nurseryPhi: true })!;
		expect(2 * (s1.loglik - s0.loglik)).toBeLessThan(6.6); // χ²₁ at p = 0.01
	});

	it('flags transients as a lower φ in the first fortnight', () => {
		const { groups, histories } = simulate(4, [0.85, 0.85], [0.3, 0.3], 0.4);
		const shared = fitCjs(groups, histories, 2)!;
		const trans = fitCjs(groups, histories, 2, { transience: true })!;
		expect(trans.theta[1]).toBeLessThan(0);
		expect(expit(trans.theta[0])).toBeCloseTo(0.85, 1);
		expect(2 * (trans.loglik - shared.loglik)).toBeGreaterThan(6.6);
	});

	it('runs on the synthetic fixture without NaN', () => {
		for (const sp of ['Cm', 'Na'] as const) {
			const r = survival(dataset(), sp);
			if (!r) continue;
			for (const e of [r.phi, r.month, ...r.nurseries.map((n) => n.phi)]) {
				expect(e.est).toBeGreaterThanOrEqual(0);
				expect(e.est).toBeLessThanOrEqual(1);
			}
		}
	});
});
