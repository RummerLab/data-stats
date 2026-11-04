import { describe, expect, it } from 'vitest';
import type { SetRow } from '../data';
import { groupsText, rateEffects, rateTest, rateText, tableText, trendText } from './tests';

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

/** Poisson draw by inversion (small means). */
function poisson(u: () => number, mu: number) {
	let k = 0;
	let p = Math.exp(-mu);
	let s = p;
	const x = u();
	while (x > s && k < 200) {
		k++;
		p *= mu / k;
		s += p;
	}
	return k;
}

/** Synthetic timed sets: two nurseries, three seasons, a group factor with given rate ratios. */
function sets(seed: number, ratio: Record<string, number>): SetRow[] {
	const u = rng(seed);
	const groups = Object.keys(ratio);
	return Array.from({ length: 600 }, (_, i) => {
		// Blocks of seven so groups don't line up with nursery (i % 2) or season (i % 3).
		const g = groups[Math.floor(i / 7) % groups.length];
		const hours = 1.5 + u();
		const n = poisson(u, 0.8 * hours * ratio[g]);
		const month = ['10', '11', '12', '01'][i % 4];
		const year = month === '01' ? 2020 : 2019;
		return {
			id: i,
			season: ['2019-2020', '2020-2021', '2021-2022'][i % 3],
			siteId: i % 2 ? 'a' : 'b',
			date: `${year + (i % 3)}-${month}-${String(1 + (i % 27)).padStart(2, '0')}`,
			durationMin: hours * 60,
			nTotal: n,
			cpue: n / hours,
			cpueCm: n / hours,
			cpueNa: 0,
			group: g
		} as unknown as SetRow;
	});
}
const groupOf = (s: SetRow) => (s as unknown as { group: string }).group;

describe('chart statistics (#119)', () => {
	it('finds a real catch-rate difference between groups and names the adjustment', () => {
		const t = rateTest(sets(3, { x: 1, y: 2 }), { groupOf })!;
		expect(t.df).toBe(1);
		expect(t.raw.p).toBeLessThan(0.001);
		expect(t.adjusted!.p).toBeLessThan(0.001);
		expect(t.adjustedFor).toBe('nursery, season and day of the season');
		expect(rateText(t, 'groups')).toMatch(/^Catch rates differ between groups/);
		const fx = rateEffects(sets(3, { x: 1, y: 2 }), groupOf)!;
		expect(fx[1].rr / fx[0].rr).toBeGreaterThan(1.6);
		expect(fx[1].rr / fx[0].rr).toBeLessThan(2.5);
	});

	it('does not invent a difference, and skips the adjustment being tested', () => {
		const t = rateTest(sets(5, { x: 1, y: 1, z: 1 }), { groupOf }, 'cpue', ['nursery'])!;
		expect(t.adjusted!.p).toBeGreaterThan(0.05);
		expect(t.adjustedFor).toBe('season and day of the season');
		expect(rateText(t, 'groups')).toMatch(/^No detectable difference/);
	});

	it('words trends, rank tests and tables', () => {
		expect(trendText([1, 2, 3, 4, 5, 6], 'mm')).toMatch(
			/^Trend across 6 seasons: \+1\.0 mm per season \(R² = 1\.00/
		);
		expect(trendText([1, null, 2], 'mm')).toBeNull();
		expect(
			groupsText(
				[
					[1, 2, 3, 4],
					[11, 12, 13, 14]
				],
				'groups'
			)
		).toMatch(/^Differs between groups \(Kruskal–Wallis H = 5\.3, df = 1/);
		expect(
			tableText(
				[
					[10, 20],
					[20, 10]
				],
				'groups'
			)
		).toBe('Differs between groups (χ²(1) = 6.7, p = 0.010).');
	});
});
