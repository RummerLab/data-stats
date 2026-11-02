import { memo } from '#lib/server/data';
import { binnedMean, cpueOf, effortSets, round } from '#lib/server/analytics/common';
import { correlations, SET_VARIABLES } from '#lib/server/analytics/env';
import { quantile, spearman, pairs } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('drivers', (d) => {
		const sets = effortSets(d);
		const corr = correlations(sets).sort((a, b) => Math.abs(b.rho ?? 0) - Math.abs(a.rho ?? 0));
		const corrCm = new Map(correlations(sets, (s) => s.cpueCm).map((r) => [r.key, r.rho]));
		const corrNa = new Map(correlations(sets, (s) => s.cpueNa).map((r) => [r.key, r.rho]));

		// Quintile-binned CPUE for the strongest variables.
		const binned = corr.slice(0, 8).map((c) => {
			const v = SET_VARIABLES.find((x) => x.key === c.key)!;
			const vals = sets.map(v.get);
			const edges = [0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => quantile(vals, q)!);
			const uniq = [...new Set(edges.map((e) => round(e, 3)))] as number[];
			const fmt = (x: number) => round(x, v.dp)!.toString();
			return {
				key: v.key,
				label: v.label,
				unit: v.unit,
				bins:
					uniq.length > 2
						? binnedMean(
								sets,
								v.get,
								(s) => s.cpue,
								uniq,
								(a, b) => `${fmt(a)}–${fmt(b)}`
							)
						: []
			};
		});

		const matrixVars = SET_VARIABLES.filter((v) => corr.some((c) => c.key === v.key)).slice(0, 16);
		const matrix = matrixVars.map((a) =>
			matrixVars.map((b) => round(spearman(pairs(sets, a.get, b.get))?.rho, 2))
		);

		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const weekday = days.map((name, i) => ({
			name,
			cpue: round(cpueOf(sets.filter((s) => s.weekday === i))),
			n: sets.filter((s) => s.weekday === i).length
		}));
		const crewSize = [1, 2, 3, 4, 5].map((k) => {
			const ss = sets.filter((s) => (k === 5 ? (s.crewSize ?? 0) >= 5 : s.crewSize === k));
			return { k: k === 5 ? '5+' : String(k), cpue: round(cpueOf(ss)), n: ss.length };
		});
		const zero = sets.filter((s) => !s.nTotal).length;

		return {
			n: sets.length,
			zero,
			corr: corr.map((c) => ({
				...c,
				rho: round(c.rho, 3),
				cm: round(corrCm.get(c.key), 3),
				na: round(corrNa.get(c.key), 3)
			})),
			binned,
			matrixLabels: matrixVars.map((v) => v.label),
			matrix,
			weekday,
			crewSize
		};
	});
