import { describe, expect, it } from 'vitest';
import {
	binomTestHalf,
	boxStats,
	histogram,
	linearFit,
	median,
	powerFit,
	quantile,
	spearman,
	tTestP,
	welch,
	wilson
} from './stats';

describe('stats', () => {
	it('computes quantiles ignoring nulls', () => {
		expect(median([3, null, 1, 2, undefined])).toBe(2);
		expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
	});

	it('fits lines exactly on exact data', () => {
		const f = linearFit([1, 2, 3, 4, 5].map((x) => [x, 2 * x + 1]))!;
		expect(f.slope).toBeCloseTo(2);
		expect(f.intercept).toBeCloseTo(1);
		expect(f.r).toBeCloseTo(1);
	});

	it('gives textbook t-test p-values', () => {
		expect(tTestP(2.0, 10)).toBeCloseTo(0.0734, 3);
		expect(tTestP(0, 10)).toBeCloseTo(1, 6);
	});

	it('recovers power-law exponents', () => {
		const f = powerFit([400, 500, 600, 700].map((x) => [x, 3e-9 * x ** 3.1]))!;
		expect(f.b).toBeCloseTo(3.1, 5);
	});

	it('ranks monotonic data perfectly', () => {
		expect(spearman([1, 2, 3, 4, 5].map((x) => [x, x ** 3]))!.rho).toBeCloseTo(1);
	});

	it('bounds binomial proportions', () => {
		const w = wilson(50, 100)!;
		expect(w.lo).toBeGreaterThan(0.39);
		expect(w.hi).toBeLessThan(0.61);
		expect(binomTestHalf(50, 100)).toBeCloseTo(1, 6);
		expect(binomTestHalf(70, 100)).toBeLessThan(0.001);
	});

	it('runs Welch tests and builds histograms and boxes', () => {
		expect(welch([1, 2, 3, 4], [11, 12, 13, 14])!.p).toBeLessThan(0.001);
		expect(histogram([1, 2, 2, 3, 9], 0, 4, 1).map((b) => b.count)).toEqual([0, 1, 2, 1]);
		const b = boxStats([1, 2, 3, 4, 100])!;
		expect(b.median).toBe(3);
		expect(b.hi).toBe(4);
	});
});
