import { error } from '@sveltejs/kit';
import { dataset } from '#lib/server/data';
import {
	cpueOf,
	effortSets,
	fieldCaptures,
	firstPerSeason,
	isNeonate,
	round,
	seasonDay,
	siteName
} from '#lib/server/analytics/common';
import { seasonRewind } from '#lib/server/analytics/rewind';
import { histogram } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = dataset();
	const season = params.season;
	if (!d.seasons.includes(season)) error(404, `No season ${season}`);
	const caps = fieldCaptures(d).filter((c) => c.season === season);
	const sets = d.sets.filter((s) => s.season === season);
	const eff = effortSets(d).filter((s) => s.season === season);
	const first = firstPerSeason(caps);

	const sites = [...new Set(caps.map((c) => c.siteId).concat(sets.map((s) => s.siteId)))].filter(
		Boolean
	) as string[];
	const bySite = sites
		.map((id) => ({
			id,
			name: siteName(d, id),
			cm: caps.filter((c) => c.siteId === id && c.species === 'Cm').length,
			na: caps.filter((c) => c.siteId === id && c.species === 'Na').length,
			sets: sets.filter((s) => s.siteId === id).length,
			cpue: round(cpueOf(eff.filter((s) => s.siteId === id)))
		}))
		.sort((a, b) => b.cm + b.na - (a.cm + a.na));

	const weeks = new Map<number, { cm: number; na: number }>();
	for (const c of caps) {
		if (!c.date) continue;
		const w = Math.floor(seasonDay(c.date) / 7);
		const v = weeks.get(w) ?? { cm: 0, na: 0 };
		if (c.species === 'Cm') v.cm++;
		else if (c.species === 'Na') v.na++;
		weeks.set(w, v);
	}
	const wKeys = [...weeks.keys()].sort((a, b) => a - b);
	const weekly = wKeys.length
		? Array.from({ length: wKeys[wKeys.length - 1] - wKeys[0] + 1 }, (_, i) => ({
				week: wKeys[0] + i,
				...(weeks.get(wKeys[0] + i) ?? { cm: 0, na: 0 })
			}))
		: [];

	const edges = Array.from({ length: 23 }, (_, i) => 400 + i * 25);
	const hist = (sp: string) =>
		histogram(
			first.filter((c) => c.species === sp).map((c) => c.tlMm),
			400,
			950,
			25
		).map((b) => b.count);

	const crew = new Map<string, number>();
	for (const c of d.crew)
		if (d.setById.get(c.setId)?.season === season)
			crew.set(c.person, (crew.get(c.person) ?? 0) + 1);

	const y0 = Number(season.slice(0, 4));
	const env = d.ocean
		.filter((o) => o.date >= `${y0}-08-01` && o.date <= `${y0 + 1}-04-30`)
		.map((o) => ({ date: o.date, sst: o.oisst ?? o.crwSst, dhw: o.crwDhw }));

	return {
		season,
		prev: d.seasons[d.seasons.indexOf(season) - 1] ?? null,
		next: d.seasons[d.seasons.indexOf(season) + 1] ?? null,
		kpi: {
			sets: sets.length,
			captures: caps.length,
			individuals: new Set(caps.map((c) => c.individualId)).size,
			cpue: round(cpueOf(eff)),
			newborns: first.filter(isNeonate).length,
			recaps: caps.filter((c) => (c.captureNo ?? 1) > 1).length
		},
		rewind: seasonRewind(d, season),
		bySite,
		weekly,
		edges,
		histCm: hist('Cm'),
		histNa: hist('Na'),
		crew: [...crew.entries()].sort((a, b) => b[1] - a[1]).map(([person, n]) => ({ person, n })),
		env,
		sets: sets.map((s) => ({
			date: s.date,
			site: siteName(d, s.siteId),
			gear: s.gear,
			start: s.startMin,
			hours: s.durationMin != null ? round(s.durationMin / 60, 1) : null,
			cm: s.nCm,
			na: s.nNa,
			cpue: round(s.cpue),
			crew: s.crewRaw,
			notes: s.notes
		})),
		notes: d.notes
			.filter((n) => n.season === season)
			.slice(0, 60)
			.map((n) => ({ date: n.date, site: siteName(d, n.siteId), kind: n.kind, text: n.text }))
	};
};
