/**
 * Cloud cover (#104): the crew's own cloud score against ERA5, cloud as a filter on moonlight,
 * and cloud against the in-situ water temperature. Exploratory: correlations, not causes.
 */
import { finite, mean, pairs, se, spearman, welch } from '#lib/stats';
import type { Dataset, SetRow } from '../data';
import { effortSets, round } from './common';

/** Bright moon: at least this illuminated and this high (degrees) at mid-set. */
const BRIGHT_ILLUM = 0.6;
const BRIGHT_ALT = 10;
/** Sky classes from ERA5 cloud cover (%). */
export const CLEAR_MAX = 40;
export const OVERCAST_MIN = 70;

/**
 * Moonlight reaching the water at mid-set, 0–1: illuminated fraction × sine of the moon's
 * altitude (0 below the horizon) × clear-sky fraction from ERA5 cloud cover.
 */
export function moonlight(s: SetRow): number | null {
	if (s.moonIllum == null || s.moonAltMid == null || s.cloudEvening == null) return null;
	const sinAlt = Math.max(0, Math.sin((s.moonAltMid * Math.PI) / 180));
	return s.moonIllum * sinAlt * (1 - s.cloudEvening / 100);
}

const ci = (ys: (number | null)[]) => {
	const m = mean(ys);
	const e = se(ys);
	return {
		n: finite(ys).length,
		mean: round(m),
		lo: m != null && e != null ? round(Math.max(0, m - 1.96 * e)) : null,
		hi: m != null && e != null ? round(m + 1.96 * e) : null
	};
};

/** Mean ERA5 cloud cover during the sets the crew scored 1–4 (2020–22 set logs). */
export function crewVsEra5(d: Dataset) {
	const scored = d.sets.filter((s) => s.cloudCover != null && s.cloudEvening != null);
	const rows = [1, 2, 3, 4].map((score) => ({
		score,
		...ci(scored.filter((s) => Math.round(s.cloudCover!) === score).map((s) => s.cloudEvening))
	}));
	const r = spearman(
		pairs(
			scored,
			(s) => s.cloudCover,
			(s) => s.cloudEvening
		)
	);
	const means = rows.map((x) => x.mean).filter((m): m is number => m != null);
	return {
		rows,
		n: scored.length,
		rho: r ? round(r.rho) : null,
		increasing: means.length === 4 && means.every((m, i) => i === 0 || m > means[i - 1])
	};
}

/** Catch rate on dark nights and on bright-moon nights under clear or overcast skies. */
export function moonCloud(d: Dataset) {
	const sets = effortSets(d).filter(
		(s) => s.cpue != null && s.moonIllum != null && s.moonAltMid != null && s.cloudEvening != null
	);
	const bright = sets.filter((s) => s.moonIllum! >= BRIGHT_ILLUM && s.moonAltMid! > BRIGHT_ALT);
	const clear = bright.filter((s) => s.cloudEvening! < CLEAR_MAX);
	const overcast = bright.filter((s) => s.cloudEvening! >= OVERCAST_MIN);
	const dark = sets.filter((s) => s.moonAltMid! <= 0 || s.moonIllum! < 0.25);
	const w = welch(
		clear.map((s) => s.cpue),
		overcast.map((s) => s.cpue)
	);
	const r = spearman(pairs(sets, moonlight, (s) => s.cpue));
	return {
		groups: [
			{ k: 'Dark: moon down or < 25% lit', ...ci(dark.map((s) => s.cpue)) },
			{ k: 'Bright moon, clear sky', ...ci(clear.map((s) => s.cpue)) },
			{ k: 'Bright moon, overcast', ...ci(overcast.map((s) => s.cpue)) }
		],
		p: w ? w.p : null,
		rho: r ? round(r.rho) : null,
		n: sets.length
	};
}

/**
 * Nursery water against daily cloud cover. Cloudy wet-season months are also the warmest, so
 * each day is compared with its own month: anomalies of the island-wide daily high and swing.
 */
export function cloudWater(d: Dataset) {
	const cloud = new Map(d.weather.map((w) => [w.date, w.cloud]));
	const byDate = new Map<string, { max: number[]; min: number[] }>();
	for (const r of d.loggerDaily) {
		const e = byDate.get(r.date) ?? { max: [], min: [] };
		e.max.push(r.max);
		e.min.push(r.min);
		byDate.set(r.date, e);
	}
	const days = [...byDate]
		.map(([date, e]) => ({
			date,
			cloud: cloud.get(date) ?? null,
			max: mean(e.max)!,
			swing: mean(e.max)! - mean(e.min)!
		}))
		.filter(
			(x): x is { date: string; cloud: number; max: number; swing: number } => x.cloud != null
		);
	const byMonth = new Map<string, typeof days>();
	for (const x of days) {
		const l = byMonth.get(x.date.slice(0, 7));
		if (l) l.push(x);
		else byMonth.set(x.date.slice(0, 7), [x]);
	}
	const anom: { cloud: number; max: number; swing: number }[] = [];
	// Within-month contrast of overcast vs clear days, weighted by the smaller group.
	let wSum = 0;
	let dMax = 0;
	let dSwing = 0;
	for (const l of byMonth.values()) {
		if (l.length < 10) continue;
		const mMax = mean(l.map((x) => x.max))!;
		const mSwing = mean(l.map((x) => x.swing))!;
		for (const x of l) anom.push({ cloud: x.cloud, max: x.max - mMax, swing: x.swing - mSwing });
		const c = l.filter((x) => x.cloud < CLEAR_MAX);
		const o = l.filter((x) => x.cloud >= OVERCAST_MIN);
		if (c.length >= 3 && o.length >= 3) {
			const w = Math.min(c.length, o.length);
			dMax += w * (mean(o.map((x) => x.max))! - mean(c.map((x) => x.max))!);
			dSwing += w * (mean(o.map((x) => x.swing))! - mean(c.map((x) => x.swing))!);
			wSum += w;
		}
	}
	const bins = [0, 20, 40, 60, 80, 100].slice(0, -1).map((a) => {
		const b = a + 20;
		const inBin = anom.filter((x) => x.cloud >= a && (b === 100 ? x.cloud <= b : x.cloud < b));
		return {
			x: a + 10,
			label: `${a}–${b}%`,
			n: inBin.length,
			max: round(mean(inBin.map((x) => x.max))),
			swing: round(mean(inBin.map((x) => x.swing)))
		};
	});
	const rMax = spearman(anom.map((x) => [x.cloud, x.max]));
	return {
		bins: bins.filter((b) => b.n >= 20),
		days: anom.length,
		rhoMax: rMax ? round(rMax.rho) : null,
		overcastVsClear: wSum
			? { max: round(dMax / wSum), swing: round(dSwing / wSum), months: wSum }
			: null
	};
}
