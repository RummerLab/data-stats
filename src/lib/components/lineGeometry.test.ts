import { describe, expect, it } from 'vitest';
import { directedPoints, reversed, shiftFor } from './lineGeometry';

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
