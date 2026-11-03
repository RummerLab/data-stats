/**
 * Auto-generated findings (#55): records, quirks and patterns computed live from the data, so
 * they update when a new season's workbook is added. Each links to the page with the chart.
 */
import { clock, date, num, pct, season as seasonFmt } from '#lib/format';
import { speciesName } from '#lib/species';
import { binomTestHalf, mean, median, pairs, spearman } from '#lib/stats';
import { moonPhaseName } from '../astro';
import { memo, tideExtrema, type Dataset } from '../data';
import {
	cpueOf,
	effortSets,
	fieldCaptures,
	fulton,
	isNeonate,
	recapturePairs,
	seasonDay,
	seasonDayLabel,
	siteName
} from './common';
import { catchModel } from './catchModel';
import { cloudWater } from './cloud';
import { diet } from './diet';
import { dailyMaxBySite, versusSst } from './insitu';
import { sexModel } from './sex';

export interface Finding {
	id: string;
	kind: 'record' | 'quirk' | 'pattern' | 'people';
	title: string;
	value: string;
	text: string;
	href: string;
}

export function topFindings(d: Dataset): Finding[] {
	return memo('findings', () => compute(d));
}

function compute(d: Dataset): Finding[] {
	const out: Finding[] = [];
	const caps = fieldCaptures(d);
	const eff = effortSets(d);
	const gill = d.sets.filter((s) => s.gear === 'Gillnet');
	if (!caps.length) return out;

	// Busiest night
	const busiest = [...gill].sort((a, b) => (b.nTotal ?? 0) - (a.nTotal ?? 0))[0];
	if (busiest?.nTotal)
		out.push({
			id: 'busiest-night',
			kind: 'record',
			title: 'Busiest night in the nets',
			value: `${busiest.nTotal} sharks`,
			text: `${siteName(d, busiest.siteId)} on ${date(busiest.date)}: ${busiest.nCm ?? 0} blacktip${busiest.nCm === 1 ? '' : 's'} and ${busiest.nNa ?? 0} sicklefin lemon${busiest.nNa === 1 ? '' : 's'} in one evening${busiest.durationMin ? ` (${num(busiest.durationMin / 60, 1)} h of netting)` : ''}.`,
			href: `/seasons/${busiest.season}`
		});

	// Sun-locked tides
	const ext = tideExtrema().filter((e) => e.kind === 'H');
	if (ext.length > 100) {
		const hours = ext.map((e) => Number(e.ts.slice(11, 13)) + Number(e.ts.slice(14, 16)) / 60);
		const locked =
			hours.filter((h) => Math.abs(h - 12) <= 2 || h >= 22 || h <= 2).length / hours.length;
		out.push({
			id: 'sun-tides',
			kind: 'quirk',
			title: 'The tide follows the sun, not the moon',
			value: pct(locked),
			text: `of ${num(ext.length)} high tides at Papeete fell within two hours of noon or midnight. Tahiti and Mo'orea sit near an amphidromic point for the moon's tide, so the sun's S2 tide dominates and high water arrives at almost the same clock time every day.`,
			href: '/tides'
		});
	}

	// Moon phase
	const phases = Array.from({ length: 8 }, (_, i) =>
		eff.filter((s) => s.moonPhase != null && Math.round(s.moonPhase * 8) % 8 === i)
	);
	const phaseCpue = phases.map((p) => ({ n: p.length, cpue: cpueOf(p) }));
	const valid = phaseCpue.map((p, i) => ({ ...p, i })).filter((p) => p.n >= 25 && p.cpue != null);
	if (valid.length >= 4) {
		const best = valid.reduce((a, b) => (b.cpue! > a.cpue! ? b : a));
		const worst = valid.reduce((a, b) => (b.cpue! < a.cpue! ? b : a));
		out.push({
			id: 'moon',
			kind: 'pattern',
			title: 'Best moon for finding pups',
			value: moonPhaseName(best.i / 8),
			text: `Nets set around the ${moonPhaseName(best.i / 8).toLowerCase()} caught ${num(best.cpue!, 2)} sharks per net-hour, against ${num(worst.cpue!, 2)} around the ${moonPhaseName(worst.i / 8).toLowerCase()} (${best.n} and ${worst.n} sets).`,
			href: '/moon'
		});
	}

	// Timing after sunset
	const after = caps
		.map((c) => c.minAfterSunset)
		.filter((v): v is number => v != null && v > -180 && v < 360);
	if (after.length > 50) {
		const med = median(after)!;
		out.push({
			id: 'sunset',
			kind: 'pattern',
			title: 'Sharks hit the net after dark',
			value: `${num(med)} min`,
			text: `The median capture came ${num(med)} minutes after sunset (${num(after.length)} timed captures); ${pct(after.filter((v) => v > 0).length / after.length)} were caught after the sun went down.`,
			href: '/time-of-day'
		});
	}

	// Sex ratio, with the mixed model's verdict on nurseries (#117)
	const sexFits = memo('sexModel', sexModel);
	for (const sp of ['Cm', 'Na'] as const) {
		const ind = d.individuals.filter((i) => i.species === sp && i.sex);
		const f = ind.filter((i) => i.sex === 'F').length;
		if (ind.length > 50) {
			const p = binomTestHalf(f, ind.length);
			const m = sexFits.find((x) => x.species === sp)?.fit;
			const top = m?.nurseries.filter((r) => r.n >= 20) ?? [];
			const byNursery =
				m?.nurseryP != null && m.nurseryP < 0.05 && top.length >= 2
					? ` It does shift between nurseries (mixed model p = ${m.nurseryP.toFixed(3)}): from ${pct(top[0].est)} female at ${top[0].name} to ${pct(top[top.length - 1].est)} at ${top[top.length - 1].name}.`
					: m?.nurseryP != null
						? ` Nurseries don't differ beyond chance (mixed model p = ${m.nurseryP.toFixed(2)}).`
						: '';
			out.push({
				id: `sex-${sp}`,
				kind: 'pattern',
				title: `${speciesName(sp)} sex ratio`,
				value: `${pct(f / ind.length)} female`,
				text: `${num(f)} females and ${num(ind.length - f)} males among individually identified ${speciesName(sp).toLowerCase()}s; ${p < 0.05 ? `a ratio unlikely to be chance (binomial p = ${p.toFixed(3)})` : `close to 1:1 (binomial p = ${p.toFixed(2)})`}.${byNursery}`,
				href: '/morphometrics#sex'
			});
		}
	}

	// Records: smallest, biggest neonate, heaviest
	// Skip records whose mass and length disagree (likely a typo in one of them).
	const plausible = (c: (typeof caps)[number]) => {
		const k = c.massKg != null && c.tlMm ? (100 * c.massKg * 1000) / (c.tlMm / 10) ** 3 : null;
		return k == null || (k > 0.3 && k < 0.9);
	};
	const withTl = caps.filter((c) => c.tlMm != null && c.tlMm > 300 && plausible(c));
	const smallest = withTl.reduce((a, b) => (b.tlMm! < a.tlMm! ? b : a), withTl[0]);
	if (smallest)
		out.push({
			id: 'smallest',
			kind: 'record',
			title: 'Smallest shark measured',
			value: `${num(smallest.tlMm)} mm`,
			text: `A ${speciesName(smallest.species).toLowerCase()} at ${siteName(d, smallest.siteId)} on ${date(smallest.date)}${smallest.massKg ? `, weighing ${num(smallest.massKg, 2)} kg` : ''}.`,
			href: `/sharks/${encodeURIComponent(smallest.individualId ?? '')}`
		});
	const neo = withTl.filter((c) => c.umbilical === 'open' && c.tlMm! < 900);
	const bigNeo = neo.reduce((a, b) => (b.tlMm! > a.tlMm! ? b : a), neo[0]);
	if (bigNeo)
		out.push({
			id: 'big-neonate',
			kind: 'record',
			title: 'Biggest newborn',
			value: `${num(bigNeo.tlMm)} mm`,
			text: `The longest pup still carrying an open umbilical scar: a ${speciesName(bigNeo.species).toLowerCase()} at ${siteName(d, bigNeo.siteId)}, ${date(bigNeo.date)}.`,
			href: `/sharks/${encodeURIComponent(bigNeo.individualId ?? '')}`
		});

	// Most captured & longest known
	const most = [...d.individuals].sort((a, b) => b.nCaptures - a.nCaptures)[0];
	if (most && most.nCaptures > 2)
		out.push({
			id: 'most-captured',
			kind: 'record',
			title: 'Most-caught shark',
			value: `${most.nCaptures} captures`,
			text: `${speciesName(most.species)} ${most.id} was netted ${most.nCaptures} times between ${date(most.firstDate)} and ${date(most.lastDate)}.`,
			href: `/sharks/${encodeURIComponent(most.id)}`
		});
	const longest = [...d.individuals]
		.filter((i) => i.firstDate && i.lastDate && i.nCaptures > 1)
		.map((i) => ({ i, days: (Date.parse(i.lastDate!) - Date.parse(i.firstDate!)) / 86_400_000 }))
		.sort((a, b) => b.days - a.days)[0];
	if (longest && longest.days > 60)
		out.push({
			id: 'longest-known',
			kind: 'record',
			title: 'Longest-known shark',
			value: `${num(longest.days)} days`,
			text: `${speciesName(longest.i.species)} ${longest.i.id} was first caught ${date(longest.i.firstDate)} and seen again ${date(longest.i.lastDate)}${longest.i.firstTlMm && longest.i.lastTlMm ? `, growing from ${num(longest.i.firstTlMm)} to ${num(longest.i.lastTlMm)} mm` : ''}.`,
			href: `/sharks/${encodeURIComponent(longest.i.id)}`
		});

	// Fastest growth
	const growth = recapturePairs(caps)
		.filter((p) => p.days >= 21 && p.a.tlMm && p.b.tlMm && plausible(p.a) && plausible(p.b))
		.map((p) => ({ p, rate: (p.b.tlMm! - p.a.tlMm!) / p.days }))
		.filter((g) => g.rate < 3);
	const fastest = growth.sort((a, b) => b.rate - a.rate)[0];
	if (fastest)
		out.push({
			id: 'fastest-growth',
			kind: 'record',
			title: 'Fastest grower',
			value: `${num(fastest.rate, 2)} mm/day`,
			text: `${speciesName(fastest.p.species)} ${fastest.p.id} grew ${num(fastest.p.b.tlMm! - fastest.p.a.tlMm!)} mm in ${fastest.p.days} days. The median recaptured pup grew ${num(median(growth.map((g) => g.rate))!, 2)} mm/day.`,
			href: '/growth'
		});

	// Productive nursery & lemon stronghold
	const sites = [...new Set(eff.map((s) => s.siteId))].filter(
		(id): id is string => !!id && d.siteById.get(id)?.kind === 'nursery'
	);
	const siteCpue = sites
		.map((id) => ({ id, sets: eff.filter((s) => s.siteId === id) }))
		.filter((x) => x.sets.length >= 20)
		.map((x) => ({
			id: x.id,
			cpue: cpueOf(x.sets)!,
			na: cpueOf(x.sets, 'cpueNa')!,
			cm: cpueOf(x.sets, 'cpueCm')!
		}));
	if (siteCpue.length) {
		const top = siteCpue.reduce((a, b) => (b.cpue > a.cpue ? b : a));
		const low = siteCpue.reduce((a, b) => (b.cpue < a.cpue ? b : a));
		out.push({
			id: 'best-nursery',
			kind: 'pattern',
			title: 'Most productive nursery',
			value: siteName(d, top.id),
			text: `${num(top.cpue, 2)} sharks per net-hour on average, ${num(top.cpue / low.cpue, 1)}× the rate at ${siteName(d, low.id)} (${num(low.cpue, 2)}).`,
			href: `/nurseries/${top.id}`
		});
		const lemon = siteCpue.reduce((a, b) => (b.na / (b.cpue || 1) > a.na / (a.cpue || 1) ? b : a));
		out.push({
			id: 'lemon-stronghold',
			kind: 'pattern',
			title: 'Sicklefin lemon stronghold',
			value: siteName(d, lemon.id),
			text: `${pct(lemon.na / lemon.cpue)} of the catch here is sicklefin lemon sharks; most nurseries are dominated by blacktips.`,
			href: `/nurseries/${lemon.id}`
		});
	}

	// Skunk rate
	const zero = eff.filter((s) => (s.nTotal ?? 0) === 0).length;
	out.push({
		id: 'skunked',
		kind: 'pattern',
		title: 'Nights with nothing',
		value: pct(zero / Math.max(1, eff.length)),
		text: `of ${num(eff.length)} timed gillnet sets caught no sharks at all ("skunked", as one log puts it).`,
		href: '/effort'
	});

	// Crew
	const perPerson = new Map<string, number[]>();
	for (const c of d.crew) {
		const l = perPerson.get(c.person);
		if (l) l.push(c.setId);
		else perPerson.set(c.person, [c.setId]);
	}
	const ranked = [...perPerson.entries()].sort((a, b) => b[1].length - a[1].length);
	if (ranked.length) {
		const [who, ids] = ranked[0];
		const s = ids.map((id) => d.setById.get(id)).filter(Boolean);
		const seasons = new Set(s.map((x) => x!.season));
		out.push({
			id: 'crew-top',
			kind: 'people',
			title: 'Most nights on the net',
			value: who,
			text: `${who} is logged on ${num(ids.length)} sets across ${seasons.size} season${seasons.size === 1 ? '' : 's'}.`,
			href: '/crew'
		});
		const effIds = new Set(eff.map((x) => x.id));
		const lucky = ranked
			.filter(([, ids2]) => ids2.filter((id) => effIds.has(id)).length >= 25)
			.map(([p, ids2]) => {
				const mine = ids2.map((id) => d.setById.get(id)!).filter((x) => effIds.has(x.id));
				return { p, cpue: cpueOf(mine)!, n: mine.length };
			})
			.sort((a, b) => b.cpue - a.cpue)[0];
		if (lucky)
			out.push({
				id: 'crew-lucky',
				kind: 'people',
				title: 'Luckiest crew member',
				value: lucky.p,
				text: `Sets with ${lucky.p} aboard averaged ${num(lucky.cpue, 2)} sharks per net-hour (${lucky.n} sets), against ${num(cpueOf(eff)!, 2)} overall. Skill, site choice or charm: you decide.`,
				href: '/crew'
			});
	}

	// Temperature and newborn size by season
	const seasonRows = d.seasons
		.map((s) => {
			const ss = eff.filter((x) => x.season === s);
			const neoTl = caps
				.filter((c) => c.season === s && c.species === 'Cm' && c.umbilical === 'open' && c.tlMm)
				.map((c) => c.tlMm);
			return { s, sst: mean(ss.map((x) => x.sst)), tl: mean(neoTl), n: neoTl.length };
		})
		.filter((r) => r.sst != null);
	if (seasonRows.length > 4) {
		const hot = seasonRows.reduce((a, b) => (b.sst! > a.sst! ? b : a));
		const cool = seasonRows.reduce((a, b) => (b.sst! < a.sst! ? b : a));
		out.push({
			id: 'hot-season',
			kind: 'pattern',
			title: 'Warmest fieldwork season',
			value: seasonFmt(hot.s),
			text: `Mean sea-surface temperature on sampling nights was ${num(hot.sst!, 2)} °C, against ${num(cool.sst!, 2)} °C in ${seasonFmt(cool.s)}.${hot.tl && cool.tl ? ` Newborn blacktips averaged ${num(hot.tl)} mm TL in the warm season and ${num(cool.tl)} mm in the cool one.` : ''}`,
			href: '/ocean'
		});
	}

	// In-situ loggers vs satellite SST (#10)
	const vs = versusSst(d);
	const hotSites = dailyMaxBySite(d);
	if (vs.diff != null && vs.pairs.length >= 100 && hotSites.length >= 2) {
		const hot = hotSites[0];
		const cool = hotSites[hotSites.length - 1];
		out.push({
			id: 'nursery-vs-ocean',
			kind: 'pattern',
			title:
				vs.diff >= 0
					? 'Nurseries run warmer than the ocean'
					: 'Nurseries run cooler than the ocean',
			value: `${vs.diff >= 0 ? '+' : '−'}${num(Math.abs(vs.diff), 2)} °C`,
			text: `Loggers on the nursery sand averaged ${num(Math.abs(vs.diff), 2)} °C ${vs.diff >= 0 ? 'above' : 'below'} offshore satellite SST over ${num(vs.pairs.length)} days. ${hot.name} has the hottest afternoons (median daily high ${num(hot.stats!.median, 1)} °C) and ${cool.name} the mildest (${num(cool.stats!.median, 1)} °C).`,
			href: '/water-quality'
		});
	}

	// Cloud cover and nursery water (#104): within-month contrast, so season doesn't confound it.
	const cw = cloudWater(d).overcastVsClear;
	if (cw?.max != null && cw.swing != null && cw.months >= 30 && cw.max < 0)
		out.push({
			id: 'cloud-cools-nursery',
			kind: 'pattern',
			title: 'Clouds take the edge off nursery afternoons',
			value: `−${num(Math.abs(cw.max), 2)} °C`,
			text: `Compared with clear days in the same month, overcast days peak ${num(Math.abs(cw.max), 2)} °C cooler on the nursery sand, and the day–night swing is ${num(Math.abs(cw.swing), 2)} °C ${cw.swing <= 0 ? 'smaller' : 'larger'}. Shallow water heats fast under full sun.`,
			href: '/water-quality'
		});

	// Earliest newborn
	const openScar = caps.filter((c) => c.umbilical === 'open' && c.date);
	if (openScar.length) {
		const early = openScar.reduce((a, b) => (seasonDay(b.date!) < seasonDay(a.date!) ? b : a));
		out.push({
			id: 'earliest-pup',
			kind: 'record',
			title: 'Earliest newborn of any season',
			value: seasonDayLabel(seasonDay(early.date!)),
			text: `A ${speciesName(early.species).toLowerCase()} with a fresh umbilical scar at ${siteName(d, early.siteId)} on ${date(early.date)}. Pupping runs roughly October to February.`,
			href: '/neonates'
		});
	}

	// Weekend effect
	const wk = eff.filter((s) => s.weekday != null);
	const weekend = cpueOf(wk.filter((s) => s.weekday === 0 || s.weekday === 6));
	const weekday = cpueOf(wk.filter((s) => s.weekday !== 0 && s.weekday !== 6));
	if (weekend != null && weekday != null)
		out.push({
			id: 'weekend',
			kind: 'quirk',
			title: 'Weekend effect?',
			value: `${num(weekend, 2)} vs ${num(weekday, 2)}`,
			text: `Sharks per net-hour on weekend nights against weeknights. Weekends bring more people to the beaches; ${weekend < weekday ? 'catches are a little lower then' : 'catches are no lower then'}.`,
			href: '/drivers'
		});

	// Strongest driver
	const vars: [string, keyof (typeof eff)[number]][] = [
		['sea temperature', 'sst'],
		['moon illumination', 'moonIllum'],
		['tide height', 'tideMidMm'],
		['wind speed', 'windSpeed'],
		['rain in the previous 24 h', 'rain24h'],
		['cloud cover', 'cloudEvening'],
		['air pressure', 'pressure']
	];
	const rhos = vars
		.map(([label, k]) => ({
			label,
			r: spearman(
				pairs(
					eff,
					(s) => s[k] as number | null,
					(s) => s.cpue
				)
			)
		}))
		.filter((x) => x.r)
		.sort((a, b) => Math.abs(b.r!.rho) - Math.abs(a.r!.rho));
	if (rhos.length)
		out.push({
			id: 'driver',
			kind: 'pattern',
			title: 'Strongest single link with catch rate',
			value: rhos[0].label,
			text: `Spearman ρ = ${num(rhos[0].r!.rho, 2)} across ${num(rhos[0].r!.n)} sets (p ${rhos[0].r!.p < 0.001 ? '< 0.001' : `= ${rhos[0].r!.p.toFixed(3)}`}). Every environmental link with CPUE is weak: nursery catches are noisy night to night.`,
			href: '/drivers'
		});

	// Sea temperature or the calendar? (#54)
	const model = memo('catchModel', catchModel);
	const [alone, , adjusted] = model?.sst.map((x) => x.v) ?? [];
	const warming = spearman(
		pairs(
			eff,
			(s) => (s.date ? seasonDay(s.date) : null),
			(s) => s.sst
		)
	);
	if (model && alone && adjusted && alone.hi < 1 && (warming?.rho ?? 0) > 0.3) {
		const peak = model.all.day.reduce((a, b) => (b.est > a.est ? b : a));
		const change = (rr: number) => `${rr < 1 ? '−' : '+'}${pct(Math.abs(rr - 1))}`;
		const words = (rr: number) => `${pct(Math.abs(rr - 1))} ${rr < 1 ? 'fewer' : 'more'}`;
		const flat = adjusted.lo <= 1 && adjusted.hi >= 1;
		out.push({
			id: 'sst-calendar',
			kind: 'pattern',
			title: 'Warm water, or just late in the season?',
			value: `${change(alone.est)} → ${flat ? 'no link' : change(adjusted.est)}`,
			text: `On its own, each extra °C of sea temperature goes with ${words(alone.est)} sharks per net-hour. Model the day of the season, nursery, season and weather together and the link ${flat ? `disappears (rate ratio ${num(adjusted.est, 2)}, 95% interval ${num(adjusted.lo, 2)}–${num(adjusted.hi, 2)}, where 1 means no change)` : `becomes ${words(adjusted.est)} per °C`}: the sea keeps warming as the season goes on, while catches fall away after peaking around ${seasonDayLabel(peak.x)}.`,
			href: '/drivers#model'
		});
	}

	// Stomach contents (#40)
	const dt = diet(d);
	if (dt && dt.nCm >= 30 && dt.cmFed.rate != null) {
		const items = [...dt.prey].filter((p) => p.key !== 'unknown').sort((a, b) => b.n - a.n);
		const plastic = dt.prey.find((p) => p.key === 'plastic')?.n ?? 0;
		out.push({
			id: 'lavage',
			kind: 'pattern',
			title: dt.cmFed.rate < 0.5 ? 'Most pups have an empty stomach' : 'Most pups had eaten',
			value: `${pct(dt.cmFed.rate)} fed`,
			text: `Of ${num(dt.nCm)} blacktips checked by gastric lavage, ${num(dt.cmFed.fed)} had food in the stomach.${items.length ? ` ${items[0].label} turn up most often in the samples (${items[0].n})${items[1] ? `, then ${items[1].label.toLowerCase()} (${items[1].n})` : ''}.` : ''}${plastic ? ` ${plastic === 1 ? 'One sample' : `${plastic} samples`} contained plastic.` : ''}`,
			href: '/physiology'
		});
	}

	// Fun totals
	const totalTl = caps.reduce((a, c) => a + (c.tlMm ?? 0), 0) / 1e6;
	const totalKg = caps.reduce((a, c) => a + (c.massKg ?? 0), 0);
	out.push({
		id: 'nose-to-tail',
		kind: 'quirk',
		title: 'Nose to tail',
		value: `${num(totalTl, 2)} km`,
		text: `Every shark measured, laid end to end, would stretch ${num(totalTl, 2)} km, and together they weigh about ${num(totalKg)} kg.`,
		href: '/morphometrics'
	});

	// Body condition vs heat
	const kRows = caps
		.filter((c) => c.species === 'Cm' && isNeonate(c))
		.map((c) => ({ k: fulton(c), dhw: c.dhw }));
	const kr = spearman(
		pairs(
			kRows,
			(r) => r.dhw,
			(r) => r.k
		)
	);
	if (kr && kr.n > 50)
		out.push({
			id: 'heat-condition',
			kind: 'pattern',
			title: 'Heat stress and newborn condition',
			value: `ρ = ${num(kr.rho, 2)}`,
			text: `Correlation between Coral Reef Watch degree heating weeks on the capture date and the body condition (Fulton's K) of newborn blacktips (n = ${num(kr.n)}).`,
			href: '/ocean'
		});

	// SOI quirk
	out.push({
		id: 'soi',
		kind: 'quirk',
		title: 'Next door to the Southern Oscillation',
		value: 'Tahiti − Darwin',
		text: `The Southern Oscillation Index that tracks El Niño is the air-pressure difference between Tahiti (Papeete, 17 km from Mo'orea) and Darwin. This dataset's tide gauge sits in the same harbour.`,
		href: '/ocean#enso'
	});

	const night = [...eff]
		.filter((s) => s.rainEvening != null)
		.sort((a, b) => b.rainEvening! - a.rainEvening!)[0];
	if (night?.rainEvening)
		out.push({
			id: 'wettest',
			kind: 'record',
			title: 'Wettest night of fieldwork',
			value: `${num(night.rainEvening, 1)} mm`,
			text: `${siteName(d, night.siteId)}, ${date(night.date)}, net in at ${clock(night.startMin)}; ${night.nTotal ?? 0} shark${night.nTotal === 1 ? '' : 's'} caught anyway.`,
			href: '/weather'
		});

	return out;
}
