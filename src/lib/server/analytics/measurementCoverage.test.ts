import { expect, it } from 'vitest';
import { dataset } from '../data';
import { coverageCell, modelSelectionFlow } from './measurementCoverage';
it('distinguishes zero, missing and no eligible records', () => {
	expect(coverageCell([0, null, 2], (v) => v != null)).toEqual({
		available: 2,
		eligible: 3,
		percent: 200 / 3
	});
	expect(
		coverageCell(
			[1],
			() => true,
			() => false
		)
	).toEqual({ available: 0, eligible: 0, percent: null });
});
it('reconciles mutually sequential exclusions for each model sample', () => {
	for (const g of modelSelectionFlow(dataset())) {
		expect(g.rows[0].remaining - g.rows.slice(1).reduce((n, r) => n + r.excluded, 0)).toBe(
			g.rows.at(-1)!.remaining
		);
		expect(g.rows.every((r) => r.excluded >= 0)).toBe(true);
	}
});
