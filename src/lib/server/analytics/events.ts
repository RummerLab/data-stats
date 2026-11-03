/**
 * Cyclones and heavy-rain days around fieldwork (#24). Catches after an event are compared with
 * the usual rate for the same season and month (indirect standardisation), because downpours
 * and storms cluster in the wet season, when catches also change. Exploratory.
 */
import { quantile } from '#lib/stats';
import type { Dataset, SetRow } from '../data';
import { effortSets, round } from './common';

/** Storms whose track passes within this distance of Moorea. */
export const CYCLONE_KM = 500;
/** Heavy-rain day: among the wettest 1% of days since 2013. */
const RAIN_Q = 0.99;

const dayNo = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
/** UTC timestamp → Moorea local date (UTC−10). */
const localDate = (ts: string) =>
	new Date(Date.parse(ts) - 10 * 3_600_000).toISOString().slice(0, 10);
const cell = (s: SetRow) => `${s.season}|${s.date!.slice(5, 7)}`;
const hours = (s: SetRow) => s.durationMin! / 60;
const count = (s: SetRow) => Math.round((s.cpue ?? 0) * hours(s));

/**
 * Observed / expected sharks for a group of sets, where expected uses the catch rate of the
 * other sets in the same season and month. 95% interval from a bootstrap over the group's sets
 * (the reference rates are held fixed).
 */
function standardised(sets: SetRow[], inGroup: (s: SetRow) => boolean) {
	const ref = new Map<string, { n: number; h: number }>();
	for (const s of sets) {
		if (inGroup(s)) continue;
		const r = ref.get(cell(s)) ?? { n: 0, h: 0 };
		r.n += count(s);
		r.h += hours(s);
		ref.set(cell(s), r);
	}
	const group = sets
		.filter((s) => inGroup(s) && (ref.get(cell(s))?.h ?? 0) > 0)
		.map((s) => {
			const r = ref.get(cell(s))!;
			return { o: count(s), e: (r.n / r.h) * hours(s) };
		});
	const ratio = (g: { o: number; e: number }[]) => {
		const e = g.reduce((a, x) => a + x.e, 0);
		return e > 0 ? g.reduce((a, x) => a + x.o, 0) / e : null;
	};
	const est = ratio(group);
	if (est == null || group.length < 3) return { n: group.length, ratio: null, lo: null, hi: null };
	let seed = 7;
	const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	const boots: number[] = [];
	for (let b = 0; b < 1000; b++) {
		const r = ratio(group.map(() => group[Math.floor(rand() * group.length)]));
		if (r != null) boots.push(r);
	}
	boots.sort((a, b) => a - b);
	return {
		n: group.length,
		ratio: round(est, 3),
		lo: round(boots[Math.floor(0.025 * boots.length)], 3),
		hi: round(boots[Math.ceil(0.975 * boots.length) - 1], 3)
	};
}

/** Days from the most recent event on or before each set's date (null if none in 60 days). */
function sinceLast(sets: SetRow[], events: number[]) {
	const sorted = [...events].sort((a, b) => a - b);
	return new Map(
		sets.map((s) => {
			const day = dayNo(s.date!);
			let best: number | null = null;
			for (const e of sorted) if (e <= day) best = day - e;
			return [s.id, best != null && best <= 60 ? best : null];
		})
	);
}

const BINS = [
	{ label: 'Same day to 3 days after', lo: 0, hi: 3 },
	{ label: '4–7 days after', lo: 4, hi: 7 },
	{ label: '8–14 days after', lo: 8, hi: 14 },
	{ label: '15–30 days after', lo: 15, hi: 30 }
];

export function weatherEvents(d: Dataset) {
	const sets = effortSets(d).filter((s) => s.date && s.cpue != null);

	// Storms: closest approach of each track.
	const bySid = new Map<string, Dataset['cyclones']>();
	for (const p of d.cyclones) bySid.set(p.sid, [...(bySid.get(p.sid) ?? []), p]);
	const storms = [...bySid.values()]
		.map((pts) => {
			const near = pts.reduce((a, b) => (b.distKm < a.distKm ? b : a));
			const close = pts.filter((p) => p.distKm <= CYCLONE_KM);
			const date = localDate(near.ts);
			const after = sets.filter((s) => {
				const k = dayNo(s.date!) - dayNo(date);
				return k >= 0 && k <= 14;
			});
			return {
				sid: near.sid,
				name: near.name === 'UNNAMED' ? 'Unnamed' : near.name[0] + near.name.slice(1).toLowerCase(),
				date,
				distKm: Math.round(near.distKm),
				windKt: Math.max(0, ...close.map((p) => p.windKt ?? 0)) || null,
				setsAfter: after.length
			};
		})
		.filter((s) => s.distKm <= CYCLONE_KM)
		.sort((a, b) => a.date.localeCompare(b.date));
	const stormDays = storms.map((s) => dayNo(s.date));
	const stormSince = sinceLast(sets, stormDays);
	const afterStorm = standardised(sets, (s) => {
		const k = stormSince.get(s.id);
		return k != null && k <= 14;
	});

	// Heavy-rain days from the ERA5 daily series.
	const rain = d.weather.filter((w) => w.precip != null);
	const threshold = quantile(
		rain.map((w) => w.precip),
		RAIN_Q
	);
	if (threshold == null) return null;
	const heavy = rain.filter((w) => w.precip! >= threshold);
	const byMonth = Array.from(
		{ length: 12 },
		(_, m) => heavy.filter((w) => Number(w.date.slice(5, 7)) === m + 1).length
	);
	const rainSince = sinceLast(
		sets,
		heavy.map((w) => dayNo(w.date))
	);
	const afterRain = BINS.map((b) => ({
		label: b.label,
		...standardised(sets, (s) => {
			const k = rainSince.get(s.id);
			return k != null && k >= b.lo && k <= b.hi;
		})
	}));
	const wettest = [...heavy].sort((a, b) => b.precip! - a.precip!)[0];

	return {
		years: rain.length ? [rain[0].date.slice(0, 4), rain[rain.length - 1].date.slice(0, 4)] : [],
		storms,
		afterStorm,
		threshold: round(threshold, 0)!,
		heavyDays: heavy.length,
		byMonth,
		afterRain,
		wettest: wettest ? { date: wettest.date, mm: round(wettest.precip, 0) } : null
	};
}
