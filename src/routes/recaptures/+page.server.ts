import { memo } from '#lib/server/data';
import {
	activeNurseries,
	fieldCaptures,
	recapturePairs,
	round,
	siteName
} from '#lib/server/analytics/common';
import { histogram, median } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('recaptures', (d) => {
		const caps = fieldCaptures(d);
		const pairs = recapturePairs(caps).filter((p) => p.days >= 1);
		const nurseries = activeNurseries(d);

		const rateBy = <K extends string>(key: (c: (typeof caps)[number]) => K | null, keys: K[]) =>
			keys.map((k) => {
				const sc = caps.filter((c) => key(c) === k);
				const ind = new Map<string, number>();
				for (const c of sc) ind.set(c.individualId!, (ind.get(c.individualId!) ?? 0) + 1);
				const n = ind.size;
				const re = [...ind.values()].filter((v) => v > 1).length;
				return { key: k, n, recaptured: re, rate: n ? round(re / n, 3) : null };
			});

		const matrix = nurseries.map((from) =>
			nurseries.map((to) => pairs.filter((p) => p.a.siteId === from && p.b.siteId === to).length)
		);
		const same = pairs.filter((p) => p.a.siteId && p.a.siteId === p.b.siteId).length;
		const moved = pairs.filter((p) => p.a.siteId && p.b.siteId && p.a.siteId !== p.b.siteId);
		const dist = (a: string | null, b: string | null) => {
			const sa = a ? d.siteById.get(a) : null;
			const sb = b ? d.siteById.get(b) : null;
			if (!sa?.lat || !sb?.lat || sa.lon == null || sb.lon == null) return null;
			const k = Math.cos((sa.lat * Math.PI) / 180);
			return Math.hypot((sa.lat - sb.lat) * 110.574, (sa.lon - sb.lon) * 111.32 * k);
		};
		const longest = moved
			.map((p) => ({
				id: p.id,
				species: p.species,
				from: siteName(d, p.a.siteId),
				to: siteName(d, p.b.siteId),
				km: round(dist(p.a.siteId, p.b.siteId), 1),
				days: p.days,
				date: p.b.date
			}))
			.sort((a, b) => (b.km ?? 0) - (a.km ?? 0))
			.slice(0, 15);

		const most = [...d.individuals]
			.filter((i) => i.nCaptures >= 3)
			.sort((a, b) => b.nCaptures - a.nCaptures)
			.slice(0, 20)
			.map((i) => ({
				id: i.id,
				href: `/sharks/${encodeURIComponent(i.id)}`,
				species: i.species,
				sex: i.sex,
				n: i.nCaptures,
				seasons: i.nSeasons,
				first: i.firstDate,
				last: i.lastDate
			}));

		const capCounts = [1, 2, 3, 4, 5, 6].map((k) => ({
			k,
			n: d.individuals.filter((i) => (k === 6 ? i.nCaptures >= 6 : i.nCaptures === k)).length
		}));

		return {
			bySeason: rateBy((c) => c.season, d.seasons),
			bySite: rateBy((c) => c.siteId, nurseries).map((r) => ({ ...r, name: siteName(d, r.key) })),
			bySpecies: rateBy((c) => c.species, ['Cm', 'Na']),
			nurseryNames: nurseries.map((id) => siteName(d, id)),
			matrix,
			fidelity: pairs.length ? round(same / pairs.length, 3) : null,
			pairs: pairs.length,
			medianDays: median(pairs.map((p) => p.days)),
			edges: Array.from({ length: 21 }, (_, i) => i * 7),
			daysHist: histogram(
				pairs.filter((p) => p.days < 140).map((p) => p.days),
				0,
				140,
				7
			).map((b) => b.count),
			longest,
			most,
			capCounts,
			multiSeason: d.individuals.filter((i) => i.nSeasons > 1).length
		};
	});
