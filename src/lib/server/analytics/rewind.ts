/**
 * "Season rewind" (#56): a handful of live highlights for one season, ranked against the others.
 * Same card shape as the findings so the page can reuse FindingCard.
 */
import { num } from '#lib/format';
import { SPECIES } from '#lib/species';
import type { Dataset } from '../data';
import { cpueOf, effortSets, fieldCaptures, siteName } from './common';
import type { Finding } from './findings';
import { mean } from '#lib/stats';

const ordinal = (n: number) => {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** 1-based rank of `season` when seasons are sorted by `value` (highest first). */
function rank(values: Map<string, number | null>, season: string) {
	const ranked = [...values].filter((e): e is [string, number] => e[1] != null);
	ranked.sort((a, b) => b[1] - a[1]);
	const i = ranked.findIndex(([s]) => s === season);
	return i < 0 ? null : { pos: i + 1, of: ranked.length };
}

const placeText = (r: { pos: number; of: number }, high: string, low: string) =>
	r.pos === 1
		? `the ${high} of ${r.of} seasons`
		: r.pos === r.of
			? `the ${low} of ${r.of} seasons`
			: r.pos <= r.of / 2
				? `${ordinal(r.pos)} ${high} of ${r.of}`
				: `${ordinal(r.of - r.pos + 1)} ${low} of ${r.of}`;

export function seasonRewind(d: Dataset, season: string): Finding[] {
	const out: Finding[] = [];
	const caps = fieldCaptures(d).filter((c) => c.season === season);
	const sets = d.sets.filter((s) => s.season === season);
	const eff = effortSets(d);
	const href = `/seasons/${season}`;

	// Busiest night
	const perSet = new Map<number, number>();
	for (const c of caps) if (c.setId != null) perSet.set(c.setId, (perSet.get(c.setId) ?? 0) + 1);
	const busiest = sets
		.map((s) => ({ s, n: Math.max(s.nTotal ?? 0, perSet.get(s.id) ?? 0) }))
		.reduce<{ s: (typeof sets)[number]; n: number } | null>(
			(a, b) => (!a || b.n > a.n ? b : a),
			null
		);
	if (busiest && busiest.n > 0)
		out.push({
			id: 'rewind-busiest',
			kind: 'record',
			title: 'Busiest night',
			value: `${num(busiest.n)} shark${busiest.n === 1 ? '' : 's'}`,
			text: `${siteName(d, busiest.s.siteId)}${busiest.s.date ? ` on ${busiest.s.date}` : ''}.`,
			href
		});

	// Catch rate against the other seasons
	const byCpue = new Map(d.seasons.map((s) => [s, cpueOf(eff.filter((x) => x.season === s))]));
	const cr = rank(byCpue, season);
	const own = byCpue.get(season);
	if (cr && own != null)
		out.push({
			id: 'rewind-cpue',
			kind: 'pattern',
			title: 'Catch rate',
			value: `${num(own, 2)} / net-hour`,
			text: `Sharks per net-hour: ${placeText(cr, 'highest', 'lowest')}.`,
			href: '/effort'
		});

	// Biggest shark (plausible condition only, as in the findings)
	const plausible = (c: (typeof caps)[number]) => {
		const k = c.massKg != null && c.tlMm ? (100 * c.massKg * 1000) / (c.tlMm / 10) ** 3 : null;
		return k == null || (k > 0.3 && k < 0.9);
	};
	const big = caps
		.filter((c) => c.tlMm != null && plausible(c))
		.reduce<(typeof caps)[number] | null>((a, b) => (!a || b.tlMm! > a.tlMm! ? b : a), null);
	if (big)
		out.push({
			id: 'rewind-biggest',
			kind: 'record',
			title: 'Biggest shark',
			value: `${num(big.tlMm)} mm`,
			text: `A ${SPECIES[big.species as keyof typeof SPECIES]?.common.toLowerCase() ?? 'shark'} at ${siteName(d, big.siteId)}${big.date ? ` on ${big.date}` : ''}.`,
			href: big.individualId ? `/sharks/${encodeURIComponent(big.individualId)}` : href
		});

	// Most-caught shark this season
	const perShark = new Map<string, number>();
	for (const c of caps)
		if (c.individualId) perShark.set(c.individualId, (perShark.get(c.individualId) ?? 0) + 1);
	const top = [...perShark].sort((a, b) => b[1] - a[1])[0];
	const topSpecies = top && caps.find((c) => c.individualId === top[0])?.species;
	if (top && top[1] > 1)
		out.push({
			id: 'rewind-regular',
			kind: 'record',
			title: 'Most-caught shark',
			value: `${top[1]} times`,
			text: `One ${SPECIES[topSpecies as keyof typeof SPECIES]?.common.toLowerCase() ?? 'shark'} kept coming back to the nets this season.`,
			href: `/sharks/${encodeURIComponent(top[0])}`
		});

	// Sea temperature on survey nights, against the other seasons
	const sst = new Map(d.ocean.map((o) => [o.date, o.oisst ?? o.crwSst]));
	const bySst = new Map(
		d.seasons.map((s) => [
			s,
			mean(d.sets.filter((x) => x.season === s && x.date).map((x) => sst.get(x.date!)))
		])
	);
	const sr = rank(bySst, season);
	const ownSst = bySst.get(season);
	if (sr && ownSst != null)
		out.push({
			id: 'rewind-sst',
			kind: 'pattern',
			title: 'Water temperature',
			value: `${num(ownSst, 1)} °C`,
			text: `Mean sea-surface temperature on survey nights: ${placeText(sr, 'warmest', 'coolest')}.`,
			href: '/ocean'
		});

	// ENSO over the core months (Nov–Jan ONI)
	const y0 = Number(season.slice(0, 4));
	const oni = mean(
		d.climate
			.filter((c) => [`${y0}-11`, `${y0}-12`, `${y0 + 1}-01`].includes(c.ym))
			.map((c) => c.oni)
	);
	if (oni != null)
		out.push({
			id: 'rewind-enso',
			kind: 'pattern',
			title: 'El Niño or La Niña?',
			value: oni >= 0.5 ? 'El Niño' : oni <= -0.5 ? 'La Niña' : 'Neutral',
			text: `Mean Oceanic Niño Index for Nov–Jan: ${num(oni, 1)} (±0.5 is the usual threshold).`,
			href: '/ocean'
		});

	// Most nights in the field
	const crew = new Map<string, number>();
	for (const c of d.crew)
		if (d.setById.get(c.setId)?.season === season)
			crew.set(c.person, (crew.get(c.person) ?? 0) + 1);
	const lead = [...crew].sort((a, b) => b[1] - a[1])[0];
	if (lead)
		out.push({
			id: 'rewind-crew',
			kind: 'people',
			title: 'Most sets',
			value: lead[0],
			text: `On the crew for ${num(lead[1])} of ${num(sets.length)} sets.`,
			href: '/crew'
		});

	return out;
}
