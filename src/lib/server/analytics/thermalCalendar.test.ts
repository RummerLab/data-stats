import { expect, it } from 'vitest';
import type { Dataset } from '../data';
import { thermalCalendar } from './thermalCalendar';

it('keeps the full calendar, masks sparse cells and preserves site-hour support', () => {
	const d = {
		sites: [{ id: 'a', name: 'A' }],
		loggerDiel: [
			{ siteId: 'a', month: 12, hour: 23, temp: 29, n: 10 },
			{ siteId: 'a', month: 1, hour: 0, temp: 31, n: 9 }
		]
	} as Pick<Dataset, 'sites' | 'loggerDiel'>;
	const [s] = thermalCalendar(d);
	expect(s.values).toHaveLength(12);
	expect(s.values[0]).toHaveLength(24);
	expect(s.values[0][0]).toBeNull();
	expect(s.values[11][23]).toBe(29);
	expect(s.rows[0].days).toBe(9);
	expect(s.rows[1]).toMatchObject({ days: 0, temperature: null });
	expect(thermalCalendar({ sites: [], loggerDiel: [] })).toEqual([]);
});
