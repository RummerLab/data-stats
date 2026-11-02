import { describe, expect, it } from 'vitest';
import { dataset } from '../data';
import { topFindings } from '../analytics/findings';
import { seasonRewind } from '../analytics/rewind';

// DATA_DIR points at samples/fixture (synthetic) and DATABASE_PATH at :memory: (vitest.config.ts).
describe('import of the synthetic fixture', () => {
	const d = dataset();

	it('imports sets, captures and sites', () => {
		expect(d.sets.length).toBe(40);
		expect(d.captures.length).toBeGreaterThan(40);
		expect(d.seasons).toEqual(['2021-2022']);
		const haapiti = d.siteById.get('haapiti')!;
		expect(haapiti.lat).toBeCloseTo(-17.5542, 3);
		expect(haapiti.coordSource).toBe('Logger GPS sheet');
	});

	it('links every capture to its set and computes CPUE', () => {
		expect(d.captures.every((c) => c.setId != null)).toBe(true);
		const withCatch = d.sets.find((s) => (s.nTotal ?? 0) > 0)!;
		expect(withCatch.cpue).toBeCloseTo(withCatch.nTotal! / (withCatch.durationMin! / 60), 6);
		expect(withCatch.sunsetMin).toBeGreaterThan(17 * 60);
		expect(withCatch.moonIllum).toBeGreaterThanOrEqual(0);
	});

	it('links recaptures by tag into individuals', () => {
		const recaptured = d.individuals.filter((i) => i.nCaptures > 1);
		expect(recaptured.length).toBeGreaterThan(0);
		for (const i of recaptured)
			expect(d.captures.filter((c) => c.individualId === i.id).length).toBe(i.nCaptures);
	});

	it('splits crews and keeps notes', () => {
		expect(d.crew.length).toBeGreaterThanOrEqual(40);
		expect(d.notes.some((n) => n.text.includes('ray swimming'))).toBe(true);
	});

	it('computes findings without throwing', () => {
		expect(topFindings(d).length).toBeGreaterThan(3);
	});

	it('builds a season rewind', () => {
		const ids = seasonRewind(d, '2021-2022').map((f) => f.id);
		expect(ids).toContain('rewind-busiest');
		expect(ids).toContain('rewind-cpue');
		expect(ids).toContain('rewind-crew');
	});
});
