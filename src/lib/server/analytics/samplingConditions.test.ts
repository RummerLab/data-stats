import { expect, it } from 'vitest';
import type { Dataset } from '../data';
import { samplingConditions } from './samplingConditions';

type D = Pick<Dataset, 'sets' | 'sites' | 'weather' | 'ocean'>;
const days = (month: string, n: number) =>
	Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
const make = (
	nights: { date: string; site?: string }[],
	precip: (date: string) => number | null,
	months: [string, number][]
) =>
	({
		sites: [
			{ id: 'a', name: 'A', kind: 'nursery' },
			{ id: 'b', name: 'B', kind: 'nursery' },
			{ id: 'x', name: 'Adults', kind: 'adult' }
		],
		sets: nights.map((n) => ({ siteId: n.site ?? 'a', date: n.date, gear: 'Gillnet' })),
		weather: months.flatMap(([m, n]) =>
			days(m, n).map((date) => ({ date, precip: precip(date), windMax: 20 }))
		),
		ocean: []
	}) as unknown as D;

it('counts a night once across sets and nurseries, and ignores other sites and gear', () => {
	const d = make(
		[
			{ date: '2020-02-03' },
			{ date: '2020-02-03' },
			{ date: '2020-02-03', site: 'b' },
			{ date: '2020-02-29', site: 'x' }
		],
		() => 0,
		[['2020-02', 29]]
	);
	d.sets.push({ siteId: 'a', date: '2020-02-10', gear: 'Hook and line' } as D['sets'][number]);
	const r = samplingConditions(d);
	expect(r).toMatchObject({ nights: 1, months: 1, first: '2020-02', last: '2020-02' });
	expect(r.metrics[0].sampled).toBe(1);
});

it('weights each month by its fieldwork, so a dry month and a wet month do not mix', () => {
	// January is wet (10 mm every day), March is dry (0 mm). Fieldwork: 3 January nights, 1 in March.
	const d = make(
		[
			{ date: '2021-01-05' },
			{ date: '2021-01-06' },
			{ date: '2021-01-07' },
			{ date: '2021-03-31' }
		],
		(date) => (date.startsWith('2021-01') ? 10 : 0),
		[
			['2021-01', 31],
			['2021-03', 31]
		]
	);
	const rain = samplingConditions(d).metrics[0];
	// Unweighted, the reference would average 5 mm; weighted 3:1 it matches the fieldwork exactly.
	expect(rain.sampledMean).toBeCloseTo(7.5);
	expect(rain.refMean).toBeCloseTo(7.5);
	// Nights drawn from their own months always give the same mean, so p is 1.
	expect(rain.p).toBe(1);
	const pct = (k: 'sampledPct' | 'referencePct') => rain.rows.map((r) => r[k]);
	expect(pct('sampledPct')).toEqual(pct('referencePct'));
	expect(rain.rows.reduce((n, r) => n + r.referencePct, 0)).toBeCloseTo(100, 0);
	expect(rain.rows.at(-1)!.bin).toBe('40+');
});

it('keeps missing values missing and stays inside the months with fieldwork', () => {
	// 2024-02 has 29 days; two have no rain value, one of them a fieldwork night.
	const d = make(
		[{ date: '2024-02-01' }, { date: '2024-02-29' }],
		(date) => (date === '2024-02-29' || date === '2024-02-10' ? null : 1),
		[
			['2024-01', 31],
			['2024-02', 29]
		]
	);
	const rain = samplingConditions(d).metrics[0];
	expect(rain).toMatchObject({ sampled: 1, nightsMissing: 1, refDays: 27, refMissing: 2 });
	// January had no fieldwork: none of its 31 days enter the reference.
	expect(rain.rows.reduce((n, r) => n + r.reference, 0)).toBe(27);
	// No SST at all: the metric is empty, not zero.
	expect(samplingConditions(d).metrics[2]).toMatchObject({ sampled: 0, rows: [] });
});

it('flags fieldwork that picks the dry days of each month', () => {
	// Rain on odd days only; every fieldwork night is an even (dry) day.
	const months: [string, number][] = [
		['2019-01', 31],
		['2019-02', 28],
		['2019-03', 31],
		['2019-04', 30]
	];
	const nights = months.flatMap(([m]) =>
		[2, 4, 6, 8, 10].map((day) => ({ date: `${m}-${String(day).padStart(2, '0')}` }))
	);
	const d = make(nights, (date) => (Number(date.slice(8)) % 2 ? 12 : 0), months);
	const rain = samplingConditions(d).metrics[0];
	expect(rain.sampledMean).toBe(0);
	expect(rain.refMean).toBeGreaterThan(5);
	expect(rain.p).toBeLessThan(0.01);
	expect(rain.stats).toMatch(/randomisation test, p [<=]/);
	// Same seed, same answer on every render.
	expect(samplingConditions(d).metrics[0].p).toBe(rain.p);
});

it('returns an empty comparison without nursery fieldwork', () => {
	expect(samplingConditions({ sites: [], sets: [], weather: [], ocean: [] })).toMatchObject({
		nights: 0,
		months: 0,
		first: null
	});
});
