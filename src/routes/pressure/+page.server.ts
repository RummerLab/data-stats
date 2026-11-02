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
import { DAY_TYPES, dayType, holidayOn } from '#lib/server/holidays';
import { mean, median, pairs, se, spearman, welch } from '#lib/stats';
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
		// Busy days (#25): do weekends and holidays, when more people are on the water, change the
		// evening catch? Mean per-set catch rate with a ±1.96·SE interval.
		const dated = eff.filter((s) => s.date && s.cpue != null);
		const group = (ss: typeof dated, label: string) => {
			const ys = ss.map((s) => s.cpue);
			const m = mean(ys);
			const e = se(ys);
			return {
				label,
				n: ss.length,
				mean: round(m, 3),
				lo: m != null && e != null ? round(Math.max(0, m - 1.96 * e), 3) : null,
				hi: m != null && e != null ? round(m + 1.96 * e, 3) : null
			};
		};
		const byType = DAY_TYPES.map((t) =>
			group(
				dated.filter((s) => dayType(s.date!) === t),
				t
			)
		);
		const byWeekday = [1, 2, 3, 4, 5, 6, 0].map((wd, i) =>
			group(
				dated.filter((s) => s.weekday === wd),
				['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
			)
		);
		const busy = dated.filter((s) => dayType(s.date!) !== 'Weekday');
		const quiet = dated.filter((s) => dayType(s.date!) === 'Weekday');
		const test = welch(
			busy.map((s) => s.cpue),
			quiet.map((s) => s.cpue)
		);
		const holidaySets = new Map<string, number>();
		for (const s of dated) {
			const h = holidayOn(s.date!);
			if (h) holidaySets.set(h, (holidaySets.get(h) ?? 0) + 1);
		}
		return {
			rows,
			metrics,
			outcomes: outcomes.map((o) => o[1]),
			corr,
			busyDays: {
				byType,
				byWeekday,
				busyMean: round(mean(busy.map((s) => s.cpue)), 2),
				quietMean: round(mean(quiet.map((s) => s.cpue)), 2),
				p: test ? round(test.p, 3) : null,
				holidays: [...holidaySets].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }))
			}
		};
	});
