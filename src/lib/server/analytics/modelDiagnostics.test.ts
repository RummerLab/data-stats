import { expect, it } from 'vitest';
import type { SetRow } from '../data';
import type { GlmFit } from './glm';
import { modelDiagnostics, zeroProbability } from './modelDiagnostics';

it('uses the NB2 zero probability, including the stable Poisson limit', () => {
	expect(zeroProbability(2, 1)).toBeCloseTo(1 / 3);
	expect(zeroProbability(2, Infinity)).toBeCloseTo(Math.exp(-2));
	expect(zeroProbability(2, 1e12)).toBeCloseTo(Math.exp(-2));
});

const rows = Array.from({ length: 20 }, (_, i) => ({
	date: '2020-10-01',
	siteId: i < 10 ? 'b' : 'a',
	season: '2020-2021',
	durationMin: i % 2 ? 120 : 60
})) as SetRow[];
const fit = { beta: [Math.log(2)], theta: 1, n: 20, converged: true } as GlmFit;
const X = rows.map(() => [1]),
	y = rows.map((_, i) => (i % 2 ? 4 : 0)),
	offset = rows.map((s) => Math.log(s.durationMin! / 60));

it('uses duration offsets and the fitted variance without refiltering the sample', () => {
	const d = modelDiagnostics(fit, rows, X, y, offset, (id) => `Nursery ${id.toUpperCase()}`)!;
	// μ = 2 per net-hour × 1 h; NB2 variance 2 + 2²/1 = 6.
	expect(d.residuals.value[0]).toBeCloseTo(-2 / Math.sqrt(6));
	expect(d.residuals.expected[1]).toBeCloseTo(4);
	expect(d.residuals.day).toHaveLength(20);
	// Groups are sorted by id and labelled; shares are percentages.
	expect(d.sites.map((s) => s.group)).toEqual(['Nursery A', 'Nursery B']);
	expect(d.sites[0].observed).toBe(50);
	expect(d.sites[0].expected).toBeCloseTo((100 * (1 / 3 + 1 / 5)) / 2, 1);
	expect(d.bins.reduce((n, b) => n + b.n, 0)).toBe(20);
	// Unequal durations: summed sharks over summed net-hours stays at the true rate of 2.
	expect(d.bins.every((b) => Math.abs(b.expected - 2) < 1e-9)).toBe(true);
});

it('handles the Poisson limit and refuses failed or mismatched fits', () => {
	const p = modelDiagnostics({ ...fit, theta: Infinity }, rows, X, y, offset)!;
	expect(p.residuals.value[0]).toBeCloseTo(-2 / Math.sqrt(2));
	expect(modelDiagnostics(null, rows, X, y, offset)).toBeNull();
	expect(modelDiagnostics({ ...fit, converged: false }, rows, X, y, offset)).toBeNull();
	expect(modelDiagnostics(fit, rows.slice(1), X, y, offset)).toBeNull();
});
