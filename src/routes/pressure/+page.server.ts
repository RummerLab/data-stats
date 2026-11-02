import { memo } from '#lib/server/data';
import {
	cpueOf,
	effortSets,
	fieldCaptures,
	firstPerSeason,
	fulton,
	isNeonate,
	recapturePairs,
	round
} from '#lib/server/analytics/common';
import { mean, median, pairs, spearman } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('pressure', (d) => {
		const eff = effortSets(d);
		const caps = fieldCaptures(d);
		const first = firstPerSeason(caps);
		const growth = recapturePairs(caps).filter(
			(p) => p.days >= 7 && p.a.tlMm && p.b.tlMm && p.a.season === p.b.season
		);
		const rows = d.sites
			.filter((s) => s.pressureComposite != null)
			.map((s) => {
				const ss = eff.filter((x) => x.siteId === s.id);
				const neo = first.filter((c) => c.siteId === s.id && c.species === 'Cm' && isNeonate(c));
				return {
					id: s.id,
					name: s.name,
					fishing: s.fishingEffort,
					human: s.humanImpact,
					artif: s.artificialisation,
					composite: round(s.pressureComposite, 3),
					tier: s.pressureTier,
					cpueCm: round(cpueOf(ss, 'cpueCm')),
					cpueNa: round(cpueOf(ss, 'cpueNa')),
					k: round(mean(neo.map(fulton)), 3),
					growth: round(
						median(
							growth.filter((g) => g.a.siteId === s.id).map((g) => (g.b.tlMm! - g.a.tlMm!) / g.days)
						),
						3
					),
					sets: ss.length
				};
			});
		const metrics = [
			['fishing', 'Fishing effort'],
			['human', 'Direct human impact'],
			['artif', 'Coastal artificialisation'],
			['composite', 'Composite pressure']
		] as const;
		const outcomes = [
			['cpueCm', 'Blacktip catch rate'],
			['cpueNa', 'Lemon catch rate'],
			['k', 'Newborn condition (K)'],
			['growth', 'Growth (mm/day)']
		] as const;
		const corr = metrics.map(([mk, ml]) => ({
			metric: ml,
			values: outcomes.map(([ok]) => {
				const r = spearman(
					pairs(
						rows,
						(x) => x[mk] as number | null,
						(x) => x[ok] as number | null
					)
				);
				return r ? round(r.rho, 2) : null;
			})
		}));
		return { rows, metrics, outcomes: outcomes.map((o) => o[1]), corr };
	});
