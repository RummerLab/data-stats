import { describe, expect, it } from 'vitest';
import {
	directedPoints,
	offsetPolyline,
	pointAlongPath,
	polylineArrow,
	reversed,
	shiftFor
} from './lineGeometry';

const A = { lat: -17.5, lon: -149.9 };
const B = { lat: -17.6, lon: -149.8 };
const C = { lat: -17.55, lon: -149.75 };

describe('reversed', () => {
	it('flags only lines whose opposite direction is drawn too', () => {
		expect(
			reversed([
				{ from: A, to: B },
				{ from: B, to: A },
				{ from: A, to: C }
			])
		).toEqual([true, true, false]);
	});
});

describe('directedPoints', () => {
	it('puts the arrow point 60% of the way along an unshifted line', () => {
		expect(directedPoints(0, 0, 10, 0, 0)).toEqual([
			[0, 0],
			[6, 0],
			[10, 0]
		]);
	});

	it('shifts the two directions of a pair to opposite sides', () => {
		const there = directedPoints(0, 0, 10, 0, 3);
		const back = directedPoints(10, 0, 0, 0, 3);
		expect(there[0][1]).toBe(3);
		expect(back[0][1]).toBe(-3);
		// Their arrows land at different places along the line.
		expect(there[1][0]).not.toBe(back[1][0]);
	});

	it('separates lines by more than their width', () => {
		const w = 6;
		expect(2 * shiftFor(w)).toBeGreaterThan(w);
	});
});

describe('offsetPolyline', () => {
	it('returns original points when shift is 0', () => {
		const pts: [number, number][] = [
			[0, 0],
			[10, 0],
			[10, 10]
		];
		expect(offsetPolyline(pts, 0)).toEqual(pts);
	});

	it('shifts 2-point and multi-point polylines rightward', () => {
		const pts2: [number, number][] = [
			[0, 0],
			[10, 0]
		];
		const rev2: [number, number][] = [
			[10, 0],
			[0, 0]
		];
		const off = offsetPolyline(pts2, 4);
		const offRev = offsetPolyline(rev2, 4);
		expect(off).toEqual([
			[0, 4],
			[6, 4],
			[10, 4]
		]);
		expect(offRev).toEqual([
			[10, -4],
			[4, -4],
			[0, -4]
		]);
	});
});

describe('polylineArrow', () => {
	it('places arrow at 60% of total length along multi-segment line', () => {
		// Total length 20 (0 to 10 on x, then 0 to 10 on y). 60% is distance 12 -> at [10, 2]
		const pts: [number, number][] = [
			[0, 0],
			[10, 0],
			[10, 10]
		];
		const arrow = polylineArrow(pts);
		expect(arrow[1][0]).toBeCloseTo(10, 4);
		expect(arrow[1][1]).toBeCloseTo(2, 4);
		// Orientation points along y axis
		expect(arrow[0][0]).toBeCloseTo(10, 4);
		expect(arrow[2][0]).toBeCloseTo(10, 4);
		expect(arrow[2][1]).toBeGreaterThan(arrow[0][1]);
	});
});

describe('pointAlongPath', () => {
	const path: [number, number][] = [
		[0, 0],
		[10, 0],
		[10, 10]
	];

	it('interpolates along vertices', () => {
		expect(pointAlongPath(path, 0)).toEqual([0, 0]);
		expect(pointAlongPath(path, 0.25)).toEqual([5, 0]);
		expect(pointAlongPath(path, 0.5)).toEqual([10, 0]);
		expect(pointAlongPath(path, 0.75)).toEqual([10, 5]);
		expect(pointAlongPath(path, 1)).toEqual([10, 10]);
	});
});
