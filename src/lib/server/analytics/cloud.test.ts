import { describe, expect, it } from 'vitest';
import { dataset, type SetRow } from '../data';
import { cloudWater, moonCloud, moonlight } from './cloud';

describe('cloud cover (#104)', () => {
	it('scales moonlight by illumination, moon height and clear sky', () => {
		const s = (moonIllum: number, moonAltMid: number, cloudEvening: number) =>
			({ moonIllum, moonAltMid, cloudEvening }) as SetRow;
		expect(moonlight(s(1, 90, 0))).toBeCloseTo(1, 6);
		expect(moonlight(s(1, 30, 50))).toBeCloseTo(0.25, 6);
		expect(moonlight(s(1, -5, 0))).toBe(0);
		expect(moonlight({ ...s(1, 30, 0), cloudEvening: null })).toBeNull();
	});

	it('runs on the synthetic fixture', () => {
		const d = dataset();
		const mc = moonCloud(d);
		expect(mc.groups).toHaveLength(3);
		expect(mc.n).toBeGreaterThan(0);
		const cw = cloudWater(d);
		expect(cw.days).toBeGreaterThan(0);
		for (const b of cw.bins) expect(b.n).toBeGreaterThanOrEqual(20);
	});
});
