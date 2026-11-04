import { expect, it } from 'vitest';
import type { Dataset } from '../data';
import { thermalCalendar } from './thermalCalendar';

type Input = Pick<Dataset, 'sites' | 'loggerDiel' | 'loggerDaily'>;

it('keeps the full calendar, masks sparse cells and preserves site-hour support', () => {
	const d = {
		sites: [{ id: 'a', name: 'A' }],
		loggerDiel: [
			{ siteId: 'a', month: 12, hour: 23, temp: 29, n: 10 },
			{ siteId: 'a', month: 1, hour: 0, temp: 31, n: 9 }
		],
		loggerDaily: [
			{ siteId: 'a', date: '2020-12-02' },
			{ siteId: 'a', date: '2019-12-01' }
		]
	} as unknown as Input;
	const { sites, domain } = thermalCalendar(d);
	const [s] = sites;
	expect(s.values).toHaveLength(12);
	expect(s.values[0]).toHaveLength(24);
	expect(s.values[0][0]).toBeNull();
	expect(s.values[11][23]).toBe(29);
	expect(s.rows[0].days).toBe(9);
	expect(s.rows[1]).toMatchObject({ days: 0, temperature: null });
	expect(s).toMatchObject({ days: 2, first: '2019-12-01', last: '2020-12-02' });
	// The masked 31 °C cell doesn't stretch the scale; a single value still gets a span.
	expect(domain).toEqual([29, 30]);
	expect(thermalCalendar({ sites: [], loggerDiel: [], loggerDaily: [] })).toEqual({
		domain: [15, 40],
		sites: []
	});
});

it('shares one domain across nurseries, rounded out to whole degrees', () => {
	const cell = (siteId: string, month: number, temp: number) => ({
		siteId,
		month,
		hour: 12,
		temp,
		n: 20
	});
	const d = {
		sites: [
			{ id: 'a', name: 'A' },
			{ id: 'b', name: 'B' }
		],
		loggerDiel: [cell('a', 1, 26.4), cell('a', 2, 28), cell('b', 1, 31.2)],
		loggerDaily: []
	} as unknown as Input;
	expect(thermalCalendar(d).domain).toEqual([26, 32]);
});
