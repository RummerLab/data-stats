import { memo } from '#lib/server/data';
import { measurementCoverage } from '#lib/server/analytics/measurementCoverage';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('dq', (d) => {
		const cats = new Map<string, { severity: string; category: string; n: number }>();
		for (const i of d.issues) {
			const k = `${i.severity}|${i.category}`;
			const c = cats.get(k) ?? { severity: i.severity, category: i.category, n: 0 };
			c.n++;
			cats.set(k, c);
		}
		return {
			coverage: measurementCoverage(d),
			summary: [...cats.values()].sort((a, b) => b.n - a.n),
			issues: d.issues.map((i) => ({
				...i,
				where: [i.file, i.sheet, i.row ? `row ${i.row}` : null].filter(Boolean).join(' › ')
			})),
			files: d.meta.files
				? (JSON.parse(d.meta.files) as { file: string; kind: string; sheets: number }[])
				: [],
			counts: d.meta.counts ? (JSON.parse(d.meta.counts) as Record<string, number>) : {},
			importedAt: d.meta.imported_at ?? null,
			external: d.meta.external
				? (JSON.parse(d.meta.external) as Record<string, string | null>)
				: {}
		};
	});
