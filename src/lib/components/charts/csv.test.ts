import { describe, expect, it } from 'vitest';
import { isoDay, slug, toCsv } from './csv';

describe('chart CSV', () => {
	it('quotes, blanks missing values and rounds floats', () => {
		const csv = toCsv([
			{
				columns: ['site', 'cpue'],
				rows: [
					['Haapiti, "old"', 0.1 + 0.2],
					['Tiki', null],
					['Line\nbreak', Number.NaN]
				]
			}
		]);
		expect(csv).toBe('site,cpue\r\n"Haapiti, ""old""",0.3\r\nTiki,\r\n"Line\nbreak",');
	});

	it('separates several tables and skips empty ones', () => {
		const t = { columns: ['a'], rows: [[1]] };
		expect(toCsv([t, { columns: ['b'], rows: [] }, t])).toBe('a\r\n1\r\n\r\na\r\n1');
	});

	it('makes file names and dates', () => {
		expect(slug("Catch rate by moon phase (Mo'orea)")).toBe('catch-rate-by-moon-phase-mo-orea');
		expect(isoDay(0)).toBe('1970-01-01');
	});
});
