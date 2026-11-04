import { expect, it } from 'vitest';
import { dataset } from '../data';
import { catchModel } from './catchModel';

it.skipIf(!process.env.REAL_DATA_DIR)(
	'real catch diagnostics reconcile to the fitted samples',
	() => {
		process.env.DATA_DIR = process.env.REAL_DATA_DIR;
		process.env.DATABASE_PATH = ':memory:';
		const model = catchModel(dataset());
		expect(model).not.toBeNull();
		const diagnostics = model!.diagnostics[0].data;
		expect(diagnostics).not.toBeNull();
		expect(diagnostics!.n).toBe(model!.n);
		expect(diagnostics!.bins.reduce((n, b) => n + b.n, 0)).toBe(model!.n);
		expect(diagnostics!.residuals.value.every(Number.isFinite)).toBe(true);
		for (const g of model!.diagnostics)
			if (g.data) expect(g.data.residuals.value).toHaveLength(g.data.n);
	},
	60000
);
