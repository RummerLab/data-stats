import { describe, expect, it } from 'vitest';
import { contrast, fitGlm, invertSpd, naturalSpline } from './glm';

// Deterministic generators so the tests are stable.
function rng(seed: number) {
	let s = seed;
	const u = () => (s = (s * 16807) % 2147483647) / 2147483647;
	const normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
	const gamma = (shape: number): number => {
		if (shape < 1) return gamma(shape + 1) * u() ** (1 / shape);
		const d = shape - 1 / 3;
		const c = 1 / Math.sqrt(9 * d);
		for (;;) {
			const x = normal();
			const v = (1 + c * x) ** 3;
			if (v > 0 && Math.log(u()) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
		}
	};
	const poisson = (lambda: number) => {
		const l = Math.exp(-lambda);
		let k = 0;
		let p = 1;
		do {
			k++;
			p *= u();
		} while (p > l);
		return k - 1;
	};
	return { u, normal, gamma, poisson };
}

describe('invertSpd', () => {
	it('inverts a symmetric positive-definite matrix', () => {
		const a = [
			[4, 2, 0.6],
			[2, 2, 0.4],
			[0.6, 0.4, 1]
		];
		const inv = invertSpd(a)!;
		for (let i = 0; i < 3; i++)
			for (let j = 0; j < 3; j++)
				expect(a[i].reduce((s, v, k) => s + v * inv[k][j], 0)).toBeCloseTo(i === j ? 1 : 0, 10);
	});
	it('returns null for a singular matrix', () => {
		expect(
			invertSpd([
				[1, 1],
				[1, 1]
			])
		).toBeNull();
	});
});

describe('fitGlm', () => {
	it('intercept-only Poisson gives the pooled rate', () => {
		const y = [0, 2, 1, 5, 0, 3];
		const hours = [1, 2, 1.5, 3, 0.5, 2];
		const fit = fitGlm(
			y.map(() => [1]),
			y,
			hours.map(Math.log),
			'poisson'
		)!;
		expect(Math.exp(fit.beta[0])).toBeCloseTo(11 / 10, 6);
	});

	it('recovers negative-binomial coefficients and θ from simulated catches', () => {
		const r = rng(42);
		const beta = [-0.5, 0.3, -0.4];
		const theta = 1.5;
		const X: number[][] = [];
		const y: number[] = [];
		const off: number[] = [];
		for (let i = 0; i < 4000; i++) {
			const row = [1, r.normal(), r.u() < 0.4 ? 1 : 0];
			const o = Math.log(1 + 3 * r.u());
			const mu = Math.exp(row.reduce((s, v, k) => s + v * beta[k], 0) + o);
			X.push(row);
			off.push(o);
			y.push(r.poisson((mu * r.gamma(theta)) / theta));
		}
		const fit = fitGlm(X, y, off)!;
		expect(fit.converged).toBe(true);
		for (let k = 0; k < 3; k++) {
			const c = contrast(fit, k === 0 ? [1, 0, 0] : k === 1 ? [0, 1, 0] : [0, 0, 1]);
			expect(c.lo).toBeLessThan(beta[k]);
			expect(c.hi).toBeGreaterThan(beta[k]);
		}
		expect(fit.theta).toBeGreaterThan(1.1);
		expect(fit.theta).toBeLessThan(2.1);
		// Overdispersed data: the NB fits far better than a Poisson with the same terms.
		const pois = fitGlm(X, y, off, 'poisson')!;
		expect(fit.aic).toBeLessThan(pois.aic - 50);
	});
});

describe('naturalSpline', () => {
	it('is linear beyond the boundary knots', () => {
		const f = naturalSpline([0, 25, 50, 75, 100]);
		const diff = (a: number, b: number) => f(b).map((v, i) => v - f(a)[i]);
		const d1 = diff(110, 120);
		const d2 = diff(120, 130);
		d1.forEach((v, i) => expect(v).toBeCloseTo(d2[i], 10));
		expect(f(50)).toHaveLength(4);
	});
});
