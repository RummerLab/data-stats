import { describe, expect, it } from 'vitest';
import { BINS, MIN_POINTS, bandwidth, kde, kmFromCoast, onLand } from './density';

/** Deterministic pseudo-random normal draws (Box–Muller on a small LCG). */
function normals(n: number, seed = 7): number[] {
	let s = seed;
	const u = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) + 1) / (2 ** 31 + 1);
	return Array.from(
		{ length: n },
		() => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
	);
}

describe('kde', () => {
	it('needs enough points', () => {
		const pts = Array.from({ length: MIN_POINTS - 1 }, () => ({ lat: -17.5, lon: -149.8 }));
		expect(kde(pts)).toBeNull();
	});

	it('peaks where the points cluster', () => {
		const z = normals(80);
		// 60 points tight around A, 20 spread around B 5 km east.
		const pts = [
			...z.slice(0, 60).map((v, i) => ({
				lat: -17.5 + (v * 0.2) / 110.574,
				lon: -149.85 + (z[(i + 7) % 80] * 0.2) / 106
			})),
			...z.slice(60).map((v, i) => ({
				lat: -17.5 + v / 110.574,
				lon: -149.85 + 5 / 106 + z[(i + 3) % 80] / 106
			}))
		];
		const d = kde(pts)!;
		expect(d.n).toBe(80);
		const peak = d.cells.filter((c) => c.bin === BINS);
		expect(peak.length).toBeGreaterThan(0);
		for (const c of peak) expect(Math.abs((c.west + c.east) / 2 - -149.85)).toBeLessThan(0.02);
		for (const c of d.cells) {
			expect(c.north).toBeGreaterThan(c.south);
			expect(c.east).toBeGreaterThan(c.west);
		}
	});

	it('applies the bandwidth floor to coincident points', () => {
		expect(bandwidth([0, 0, 0, 0], [0, 0, 0, 0])).toBe(0.3);
	});
});

describe('coastline checks', () => {
	it('puts the middle of the island on land and open ocean far from shore', () => {
		const middle = { lat: -17.54, lon: -149.83 };
		expect(onLand(middle)).toBe(true);
		const ocean = { lat: -17.3, lon: -149.83 };
		expect(onLand(ocean)).toBe(false);
		expect(kmFromCoast(ocean)).toBeGreaterThan(15);
	});
});
