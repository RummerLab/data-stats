import { describe, expect, it } from 'vitest';
import { fitBinomialGlmm, testRandomEffect, type Factor } from './glmm';

/** Seeded uniform (mulberry32) and normal (Box–Muller) draws. */
function rng(seed: number) {
	let a = seed;
	const u = () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const z = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
	return { u, z };
}

/** Crossed design: `levels[f]` levels per factor, true SDs `sd[f]`, intercept b0. */
function simulate(seed: number, n: number, levels: number[], sd: number[], b0: number) {
	const r = rng(seed);
	const effects = levels.map((L, f) => Array.from({ length: L }, () => sd[f] * r.z()));
	const factors: Factor[] = levels.map((L) => ({ levels: L, index: [] }));
	const y: number[] = [];
	for (let i = 0; i < n; i++) {
		let eta = b0;
		levels.forEach((L, f) => {
			const l = Math.floor(r.u() * L);
			factors[f].index.push(l);
			eta += effects[f][l];
		});
		y.push(r.u() < 1 / (1 + Math.exp(-eta)) ? 1 : 0);
	}
	return { y, X: y.map(() => [1]), factors };
}

describe('binomial GLMM (#117)', () => {
	it('reduces to logistic regression when the random effects are switched off', () => {
		const { y, X, factors } = simulate(1, 400, [10], [1], 0.4);
		const fit = fitBinomialGlmm(y, X, factors, [0])!;
		const k = y.filter(Boolean).length;
		expect(fit.beta[0]).toBeCloseTo(Math.log(k / (400 - k)), 6);
		expect(fit.betaSe[0]).toBeCloseTo(Math.sqrt(1 / k + 1 / (400 - k)), 4);
		expect(fit.loglik).toBeCloseTo(k * Math.log(k / 400) + (400 - k) * Math.log(1 - k / 400), 6);
	});

	it('recovers a random-intercept SD and finds it significant', () => {
		const { y, X, factors } = simulate(7, 3000, [30], [1], 0.3);
		const fit = fitBinomialGlmm(y, X, factors)!;
		expect(fit.sd[0]).toBeGreaterThan(0.65);
		expect(fit.sd[0]).toBeLessThan(1.4);
		expect(Math.abs(fit.beta[0] - 0.3)).toBeLessThan(0.45);
		expect(testRandomEffect(fit, y, X, factors, 0)!.p).toBeLessThan(0.001);
	});

	it('separates a real crossed effect from an absent one', () => {
		const { y, X, factors } = simulate(11, 2500, [12, 10], [0.8, 0], -0.2);
		const fit = fitBinomialGlmm(y, X, factors)!;
		expect(fit.sd[0]).toBeGreaterThan(0.4);
		expect(fit.sd[1]).toBeLessThan(0.25);
		expect(testRandomEffect(fit, y, X, factors, 0)!.p).toBeLessThan(0.001);
		expect(testRandomEffect(fit, y, X, factors, 1)!.p).toBeGreaterThan(0.05);
		// Conditional modes shrink towards zero and come with standard errors.
		expect(fit.re[0]).toHaveLength(12);
		expect(fit.re[0].every((e) => Number.isFinite(e.se) && e.se > 0)).toBe(true);
	});
});
