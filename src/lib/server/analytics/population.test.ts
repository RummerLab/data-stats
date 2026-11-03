import { describe, expect, it } from 'vitest';
import { dataset } from '../data';
import { poissonCi, schnabel, vonBertalanffy } from './population';

describe('population analyses (#43, #44)', () => {
	it('gives exact Poisson limits', () => {
		// Garwood limits for 0, 3 and 10 events.
		expect(poissonCi(0)[0]).toBe(0);
		expect(poissonCi(0)[1]).toBeCloseTo(3.689, 2);
		expect(poissonCi(3)[0]).toBeCloseTo(0.619, 2);
		expect(poissonCi(3)[1]).toBeCloseTo(8.767, 2);
		expect(poissonCi(10)[0]).toBeCloseTo(4.795, 2);
		expect(poissonCi(10)[1]).toBeCloseTo(18.39, 1);
	});

	it('floors Schnabel estimates at the sharks actually caught', () => {
		for (const r of schnabel(dataset(), 1)) {
			expect(r.n).toBeGreaterThanOrEqual(r.distinct);
			expect(r.lo).toBeLessThanOrEqual(r.n);
			expect(r.hi).toBeGreaterThanOrEqual(r.n);
		}
	});

	it('returns a growth curve or nothing, never NaN', () => {
		const v = vonBertalanffy(dataset());
		if (v) for (const p of v.curve) expect(Number.isFinite(p.y)).toBe(true);
	});
});
