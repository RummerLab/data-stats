import { expect, it } from 'vitest';
import type { Dataset } from '../data';
import { samplingConditions } from './samplingConditions';

it('compares identical daily measures and deduplicates sampling dates within a nursery-month', () => {
	const d = {
		sites: [{ id: 'a', name: 'A', kind: 'nursery' }],
		sets: [1, 2, 3].map((n) => ({
			siteId: 'a',
			date: n === 3 ? '2020-02-29' : '2020-02-01',
			gear: 'Gillnet'
		})),
		weather: [
			{ date: '2020-02-01', precip: 0, windMax: 5 },
			{ date: '2020-02-02', precip: 10, windMax: 5 }
		],
		ocean: []
	} as unknown as Pick<Dataset, 'sets' | 'sites' | 'weather' | 'ocean'>;
	const r = samplingConditions(d, 'a', '2020-02');
	expect(r).toMatchObject({ sampleDays: 2, calendarDays: 29 });
	expect(r.metrics[0]).toMatchObject({ all: 2, sampled: 1, missingAll: 27, missingSample: 1 });
	expect(r.metrics[0].rows.reduce((n, b) => n + (b.allPct ?? 0), 0)).toBeCloseTo(100);
	expect(r.metrics[0].rows[9].all).toBe(1);
	expect(r.metrics[1].rows.reduce((n, b) => n + b.all, 0)).toBe(2);
	expect(r.metrics[2].rows.every((b) => b.sampledPct === null)).toBe(true);
	expect(samplingConditions(d, 'unknown', '1900-01').period).toBe('2020-02');
});
it('returns an explicit empty state without nursery fieldwork', () => {
	expect(samplingConditions({ sites: [], sets: [], weather: [], ocean: [] })).toMatchObject({
		site: null,
		metrics: []
	});
});
