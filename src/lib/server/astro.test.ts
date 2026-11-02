import { describe, expect, it } from 'vitest';
import { moonAt, moonPhaseName, sunTimes } from './astro';
import { findExtrema, type HourlyPoint } from './tides';

describe('sun', () => {
	it('gives plausible Moorea sunsets (UTC−10)', () => {
		const dec = sunTimes('2023-12-21');
		const jun = sunTimes('2023-06-21');
		// Austral summer: sunset ~18:35; winter ~17:35.
		expect(dec.sunset).toBeGreaterThan(18 * 60 + 25);
		expect(dec.sunset).toBeLessThan(18 * 60 + 50);
		expect(jun.sunset).toBeGreaterThan(17 * 60 + 25);
		expect(jun.sunset).toBeLessThan(17 * 60 + 50);
		expect(dec.civilDusk - dec.sunset).toBeGreaterThan(15);
		expect(dec.civilDusk - dec.sunset).toBeLessThan(35);
		expect(dec.sunrise).toBeLessThan(dec.solarNoon);
	});
});

describe('moon', () => {
	it('knows full and new moons', () => {
		// Full moon 25 Jan 2024 17:54 UTC; new moon 11 Jan 2024 11:57 UTC.
		const full = moonAt('2024-01-25', 8 * 60);
		const nw = moonAt('2024-01-11', 2 * 60);
		expect(full.fraction).toBeGreaterThan(0.98);
		expect(moonPhaseName(full.phase)).toBe('Full moon');
		expect(nw.fraction).toBeLessThan(0.02);
		expect(moonPhaseName(nw.phase)).toBe('New moon');
	});
});

describe('tides', () => {
	it('finds highs and lows of a semidiurnal series', () => {
		const pts: HourlyPoint[] = Array.from({ length: 96 }, (_, t) => ({
			t: 500_000 + t,
			mm: Math.round(1000 + 100 * Math.cos((2 * Math.PI * t) / 12))
		}));
		const ext = findExtrema(pts);
		const highs = ext.filter((e) => e.kind === 'H');
		const lows = ext.filter((e) => e.kind === 'L');
		expect(highs.length).toBeGreaterThanOrEqual(6);
		expect(lows.length).toBeGreaterThanOrEqual(6);
		expect(highs.every((h) => h.mm >= 1095)).toBe(true);
		expect(lows.every((l) => l.mm <= 905)).toBe(true);
	});
});
