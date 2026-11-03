import { describe, expect, it } from 'vitest';
import { dataset } from '../data';
import { diet } from '../analytics/diet';
import { weatherEvents } from '../analytics/events';
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

	it('imports logger CSVs and joins in-situ temperature to sets', () => {
		expect(d.loggerFiles.map((f) => [f.system, f.siteId, f.siteBasis]).sort()).toEqual([
			['EnvLogger', 'tiki', 'download GPS'],
			['HOBO', 'haapiti', 'file name']
		]);
		expect(d.loggerDaily.filter((r) => r.siteId === 'tiki').length).toBeGreaterThan(80);
		expect(d.loggerDaily.every((r) => r.max <= 40)).toBe(true);
		// UTC EnvLogger times land on local time: warmest hour near 14:00, coolest near 06:00.
		const tiki = d.loggerDiel.filter((r) => r.siteId === 'tiki' && r.month === 10);
		const warmest = tiki.reduce((a, b) => (b.temp > a.temp ? b : a));
		expect(warmest.hour).toBeGreaterThanOrEqual(12);
		expect(warmest.hour).toBeLessThanOrEqual(16);
		const joined = d.sets.filter((s) => s.insituTemp != null);
		expect(joined.length).toBeGreaterThan(5);
		expect(joined.every((s) => s.siteId === 'tiki' || s.siteId === 'haapiti')).toBe(true);
	});

	it('splits crews and keeps notes', () => {
		expect(d.crew.length).toBeGreaterThanOrEqual(40);
		expect(d.notes.some((n) => n.text.includes('ray swimming'))).toBe(true);
	});

	it('reads gastric lavage columns (#40)', () => {
		const checked = d.captures.filter((c) => c.stomach != null);
		expect(checked.length).toBeGreaterThan(5);
		expect(checked.every((c) => c.species === 'Cm' && c.lavage === 1)).toBe(true);
		expect(new Set(checked.map((c) => c.stomach))).toEqual(new Set(['empty', 'traces', 'full']));
		// "no sample" and "na" are not contents; only the full stomachs name food.
		const named = d.captures.filter((c) => c.stomachContents);
		expect(named.every((c) => c.stomach === 'full' && c.stomachContents === 'small fish')).toBe(
			true
		);
		const r = diet(d)!;
		expect(r.nCm).toBe(checked.length);
		expect(r.prey.map((p) => p.key)).toEqual(['fish']);
	});

	it('loads cyclone tracks and heavy-rain days (#24)', () => {
		// external/ is the committed public snapshot, not synthetic data.
		expect(d.cyclones.length).toBeGreaterThan(10);
		const ev = weatherEvents(d)!;
		const niko = ev.storms.find((s) => s.name === 'Niko');
		expect(niko?.date).toBe('2015-01-21');
		expect(niko!.distKm).toBeLessThan(200);
		expect(ev.byMonth).toHaveLength(12);
		expect(ev.heavyDays).toBe(ev.byMonth.reduce((a, b) => a + b, 0));
		expect(ev.threshold).toBeGreaterThan(20);
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
