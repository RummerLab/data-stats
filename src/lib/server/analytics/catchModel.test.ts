import { expect, it } from 'vitest';
import { dataset } from '../data';
import { catchModel } from './catchModel';

// The synthetic fixture is sized for the model (#153), so /drivers renders its model section,
// fit diagnostics and selection chart in CI. If this fails, the e2e checks of those charts are
// silently skipped: grow the fixture (scripts/make-fixture.mjs) rather than loosening this.
it('fits all three catch models on the synthetic fixture', () => {
	const m = catchModel(dataset());
	expect(m).not.toBeNull();
	expect(m!.seasons.length).toBeGreaterThanOrEqual(2);
	expect(m!.cm?.n).toBeGreaterThan(0);
	expect(m!.na?.n).toBeGreaterThan(0);
	expect(Number.isFinite(m!.all.theta)).toBe(true);
	for (const g of m!.diagnostics) expect(g.data?.n).toBeGreaterThan(0);
});
