import { error } from '@sveltejs/kit';
import { dataset } from '#lib/server/data';
import { fulton, round, siteName } from '#lib/server/analytics/common';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const d = dataset();
	const id = decodeURIComponent(params.id);
	const ind = d.individuals.find((i) => i.id === id);
	if (!ind) error(404, 'Unknown shark');
	const caps = d.captures
		.filter((c) => c.individualId === id)
		.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
	const lab = d.labSharks.filter((l) => l.individualId === id);
	const sites = [...new Set(caps.map((c) => c.siteId).filter(Boolean))] as string[];
	return {
		ind: { ...ind, tags: JSON.parse(ind.tags ?? '[]') as string[] },
		captures: caps.map((c) => ({
			date: c.date,
			season: c.season,
			site: siteName(d, c.siteId),
			siteId: c.siteId,
			kind: c.kind,
			captureNo: c.captureNo,
			tl: c.tlMm,
			fl: c.flMm,
			mass: c.massKg,
			k: round(fulton(c), 3),
			umbilical: c.umbilical,
			age: c.ageClass,
			time: c.captureMin,
			sst: c.sst,
			notes: c.notes,
			source: `${c.sourceFile} › ${c.sourceSheet} row ${c.sourceRow}`
		})),
		lab: lab.map((l) => ({
			arrival: l.arrivalDate,
			release: l.releaseDate,
			days: l.days,
			arrTl: l.arrTlMm,
			relTl: l.relTlMm,
			arrMass: l.arrMassKg,
			relMass: l.relMassKg,
			notes: l.notes
		})),
		map: sites
			.map((s) => d.siteById.get(s)!)
			.filter((s) => s?.lat != null)
			.map((s) => ({
				id: s.id,
				label: s.name,
				lat: s.lat!,
				lon: s.lon!,
				value: caps.filter((c) => c.siteId === s.id).length,
				href: `/nurseries/${s.id}`
			}))
	};
};
