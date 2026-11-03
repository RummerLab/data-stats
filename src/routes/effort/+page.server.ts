import { memo } from '#lib/server/data';
import {
	activeNurseries,
	cpueOf,
	effortSets,
	round,
	seasonDay,
	siteName
} from '#lib/server/analytics/common';
import { histogram } from '#lib/stats';
import { rateSlopeText, rateTest, tableText } from '#lib/server/analytics/tests';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('effort', (d) => {
		const gill = d.sets.filter((s) => s.gear === 'Gillnet');
		const eff = effortSets(d);
		const nurseries = activeNurseries(d);
		const setGrid = nurseries.map((id) =>
			d.seasons.map(
				(season) => gill.filter((s) => s.siteId === id && s.season === season).length || null
			)
		);
		const weeks = Array.from({ length: 26 }, (_, i) => i + 4);
		const calendar = d.seasons.map((season) =>
			weeks.map(
				(w) =>
					gill.filter(
						(s) => s.season === season && s.date && Math.floor(seasonDay(s.date) / 7) === w
					).length || null
			)
		);
		const weekLabel = (w: number) => {
			const dt = new Date(Date.UTC(2001, 7, 1) + w * 7 * 86_400_000);
			return `${dt.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getUTCMonth()]}`;
		};
		const visits = Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
			const ss = eff.filter((s) => (v === 10 ? (s.visit ?? 0) >= 10 : s.visit === v));
			return { v: v === 10 ? '10+' : String(v), cpue: round(cpueOf(ss)), n: ss.length };
		});
		const stats = {
			zero: tableText(
				nurseries.map((id) => {
					const ss = eff.filter((s) => s.siteId === id);
					return [ss.filter((s) => !s.nTotal).length, ss.filter((s) => s.nTotal).length];
				}),
				'nurseries'
			),
			visits: rateSlopeText(
				rateTest(eff, { valueOf: (s) => s.visit }),
				'the visit number (later visits also fall later in the season, which the adjusted test allows for)'
			)
		};
		return {
			stats,
			seasons: d.seasons,
			nurseryNames: nurseries.map((id) => siteName(d, id)),
			setGrid,
			weekLabels: weeks.map(weekLabel),
			calendar,
			hours: d.seasons.map((season) =>
				round(
					eff.filter((s) => s.season === season).reduce((a, s) => a + (s.durationMin ?? 0) / 60, 0),
					0
				)
			),
			durEdges: Array.from({ length: 17 }, (_, i) => 30 + i * 15),
			durHist: histogram(
				eff.map((s) => s.durationMin),
				30,
				270,
				15
			).map((b) => b.count),
			zeroBySite: nurseries.map((id) => {
				const ss = eff.filter((s) => s.siteId === id);
				return {
					name: siteName(d, id),
					zero: ss.length ? round(ss.filter((s) => !s.nTotal).length / ss.length, 3) : null
				};
			}),
			visits,
			gear: [...new Set(d.sets.map((s) => s.gear))].map((g) => ({
				g,
				n: d.sets.filter((s) => s.gear === g).length
			})),
			other: d.sets.filter((s) => s.siteId && d.siteById.get(s.siteId)?.kind !== 'nursery').length
		};
	});
