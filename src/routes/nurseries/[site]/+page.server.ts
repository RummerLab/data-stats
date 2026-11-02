import { error } from '@sveltejs/kit';
import { dataset } from '#lib/server/data';
import {
	activeNurseries,
	cpueOf,
	effortSets,
	fieldCaptures,
	firstPerSeason,
	isNeonate,
	recapturePairs,
	round,
	siteName
} from '#lib/server/analytics/common';
import { histogram, mean } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = dataset();
	const site = d.siteById.get(params.site);
	if (!site) error(404, 'Unknown site');
	const all = fieldCaptures(d);
	const caps = all.filter((c) => c.siteId === site.id);
	const eff = effortSets(d).filter((s) => s.siteId === site.id);
	const sets = d.sets.filter((s) => s.siteId === site.id);
	const first = firstPerSeason(caps);

	const perSeason = d.seasons.map((season) => {
		const ss = eff.filter((s) => s.season === season);
		return {
			season,
			cm: caps.filter((c) => c.season === season && c.species === 'Cm').length,
			na: caps.filter((c) => c.season === season && c.species === 'Na').length,
			sets: sets.filter((s) => s.season === season).length,
			cpue: round(cpueOf(ss)),
			temp: round(mean(sets.filter((s) => s.season === season).map((s) => s.waterTemp)), 1)
		};
	});

	const pairs = recapturePairs(all).filter((p) => p.a.siteId === site.id || p.b.siteId === site.id);
	const moves = new Map<string, number>();
	for (const p of pairs) {
		const other = p.a.siteId === site.id ? p.b.siteId : p.a.siteId;
		const k = other === site.id ? 'Same nursery' : siteName(d, other);
		moves.set(k, (moves.get(k) ?? 0) + 1);
	}

	const sex = {
		F: first.filter((c) => c.sex === 'F').length,
		M: first.filter((c) => c.sex === 'M').length
	};
	const others = activeNurseries(d)
		.map((id) => d.siteById.get(id)!)
		.filter((s) => s.lat != null)
		.map((s) => ({
			id: s.id,
			label: s.name,
			lat: s.lat!,
			lon: s.lon!,
			value: s.id === site.id ? 3 : 1,
			color: s.id === site.id ? 'var(--series-2)' : 'var(--axis)',
			href: `/nurseries/${s.id}`
		}));

	return {
		site: { ...site, aliases: site.aliases ? (JSON.parse(site.aliases) as string[]) : [] },
		kpi: {
			captures: caps.length,
			individuals: new Set(caps.map((c) => c.individualId)).size,
			sets: sets.length,
			cpue: round(cpueOf(eff)),
			newborns: first.filter(isNeonate).length,
			seasons: new Set(caps.map((c) => c.season)).size
		},
		perSeason,
		edges: Array.from({ length: 23 }, (_, i) => 400 + i * 25),
		histCm: histogram(
			first.filter((c) => c.species === 'Cm').map((c) => c.tlMm),
			400,
			950,
			25
		).map((b) => b.count),
		histNa: histogram(
			first.filter((c) => c.species === 'Na').map((c) => c.tlMm),
			400,
			950,
			25
		).map((b) => b.count),
		moves: [...moves.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
		sex,
		map: others,
		hobo: d.hobo
			.filter((h) => h.siteId === site.id)
			.map((h) => ({
				season: h.season,
				logger: h.logger,
				deployed: h.deployed,
				retrieved: h.retrieved,
				status: h.status
			})),
		notes: d.notes
			.filter((n) => n.siteId === site.id)
			.slice(-40)
			.reverse()
			.map((n) => ({ date: n.date, kind: n.kind, text: n.text }))
	};
};
