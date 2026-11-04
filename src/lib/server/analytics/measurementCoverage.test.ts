import { expect, it } from 'vitest';
import { dataset } from '../data';
import { catchModel } from './catchModel';
import { coverageCell, measurementCoverage, modelSelectionFlow } from './measurementCoverage';

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

it('keeps empty strata missing rather than 0%', () => {
	const c = measurementCoverage(dataset());
	for (const p of [c.captures, c.sets]) {
		expect(p.values).toHaveLength(p.seasons.length);
		for (const r of p.rows) {
			if (r.eligible === 0) expect(r.percent).toBeNull();
			else expect(r.percent).toBeCloseTo((100 * r.available) / r.eligible, 1);
		}
	}
});

it('reconciles the selection flow with the fitted samples', () => {
	const d = dataset();
	const f = modelSelectionFlow(d);
	const [timed, complete, base, cm, na] = f.rows;
	expect(f.rows.every((r) => r.excluded >= 0)).toBe(true);
	// Sequential steps: each set is left out once.
	expect(timed.remaining - complete.excluded - base.excluded).toBe(base.remaining);
	// Species steps start again from the all-shark sample.
	for (const r of [cm, na]) expect(base.remaining - r.excluded).toBe(r.remaining);
	// Missing variables overlap: together they cover at least the sets left out for them.
	expect(f.missing.reduce((n, m) => n + m.n, 0)).toBeGreaterThanOrEqual(complete.excluded);
	const model = catchModel(d);
	if (model) {
		expect(model.n).toBe(base.remaining);
		expect(model.dropped).toBe(timed.remaining - base.remaining);
		if (model.cm) expect(model.cm.n).toBe(cm.remaining);
		if (model.na) expect(model.na.n).toBe(na.remaining);
	}
});
