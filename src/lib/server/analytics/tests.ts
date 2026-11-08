/**
 * Statistics behind the charts (#119): the right test for each kind of chart, worded the same way
 * everywhere for ChartCard's `stats` line. Catch rates use negative-binomial models of the counts
 * with log(net-hours) as the offset, so long and short sets weigh correctly; "adjusted" adds
 * nursery, season and a smooth for the day of the season, the calendar that confounds most
 * comparisons (#54). Each helper returns null when there is too little data to test.
 *
 * The lab's conventions (#132): p < 0.05, nursery and season as fixed effects, p-values and R²
 * shown as they are (the site is mainly for the lab). Each chart is tested on its own.
 */
import { num, pValue } from '#lib/format';
import {
	chiSquare,
	chiSquareP,
	kruskal,
	linearFit,
	quantile,
	spearman,
	welch,
	type Num
} from '#lib/stats';
import type { SetRow } from '../data';
import { seasonDay } from './common';
import { contrast, fitGlm, naturalSpline } from './glm';

export type RateKey = 'cpue' | 'cpueCm' | 'cpueNa';

const count = (s: SetRow, key: RateKey) => Math.round((s[key] ?? 0) * (s.durationMin! / 60));
const effectCode = (levels: string[], v: string) =>
	levels.slice(0, -1).map((l) => (v === levels[levels.length - 1] ? -1 : v === l ? 1 : 0));

type Confounder = 'nursery' | 'season';

/**
 * Columns for nursery (≥ 10 sets, the rest pooled), season and a day-of-season spline, and a
 * label naming what they actually adjust for (a factor with one level adjusts for nothing).
 */
function calendar(rows: SetRow[], skip: Confounder[] = []) {
	const perSite = new Map<string, number>();
	for (const s of rows) perSite.set(s.siteId ?? '', (perSite.get(s.siteId ?? '') ?? 0) + 1);
	const site = (s: SetRow) => ((perSite.get(s.siteId ?? '') ?? 0) >= 10 ? s.siteId! : 'other');
	const sites = [...new Set(rows.map(site))].sort();
	const seasons = [...new Set(rows.map((s) => s.season))].sort();
	const days = rows.map((s) => seasonDay(s.date!));
	const knots = [0, 0.25, 0.5, 0.75, 1].map((q) => quantile(days, q)!);
	const spline = new Set(knots).size === knots.length ? naturalSpline(knots) : () => [];
	const useSite = !skip.includes('nursery') && sites.length > 1;
	const useSeason = !skip.includes('season') && seasons.length > 1;
	const parts = [
		...(useSite ? ['nursery'] : []),
		...(useSeason ? ['season'] : []),
		'day of the season'
	];
	const label =
		parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
	const cols = rows.map((s, i) => [
		...spline(days[i]),
		...(useSite ? effectCode(sites, site(s)) : []),
		...(useSeason ? effectCode(seasons, s.season) : [])
	]);
	return { cols, label };
}

export interface RateTest {
	n: number;
	df: number;
	raw: { lr: number; p: number };
	adjusted: { lr: number; p: number } | null;
	/** What the adjusted test holds fixed, e.g. "season and day of the season". */
	adjustedFor: string;
}

/**
 * Do catch rates differ between groups (`groupOf`), or change with a number (`valueOf`)? A
 * likelihood-ratio test of that term, raw and with the calendar adjustment. `skip` leaves out
 * the adjustment the term itself is (testing nurseries, don't also adjust for nursery).
 */
export function rateTest(
	sets: SetRow[],
	term:
		| { groupOf: (s: SetRow) => string | number | null | undefined }
		| { valueOf: (s: SetRow) => number | null | undefined },
	key: RateKey = 'cpue',
	skip: Confounder[] = []
): RateTest | null {
	const get = 'groupOf' in term ? term.groupOf : term.valueOf;
	const rows = sets.filter(
		(s) => s.cpue != null && s.durationMin && s.date && get(s) != null && s.season
	);
	const levels =
		'groupOf' in term ? [...new Set(rows.map((s) => String(term.groupOf(s))))].sort() : [];
	if (rows.length < 20 || ('groupOf' in term && levels.length < 2)) return null;
	const cols = (s: SetRow) =>
		'groupOf' in term ? effectCode(levels, String(term.groupOf(s))) : [Number(term.valueOf(s))];
	const y = rows.map((s) => count(s, key));
	if (!y.some((v) => v > 0)) return null;
	const offset = rows.map((s) => Math.log(s.durationMin! / 60));
	const lrt = (base: number[][]) => {
		const f0 = fitGlm(base, y, offset);
		const f1 = fitGlm(
			base.map((r, i) => [...r, ...cols(rows[i])]),
			y,
			offset
		);
		if (!f0 || !f1) return null;
		const lr = Math.max(0, 2 * (f1.loglik - f0.loglik));
		return { lr, p: chiSquareP(lr, df) };
	};
	const df = 'groupOf' in term ? levels.length - 1 : 1;
	const raw = lrt(rows.map(() => [1]));
	if (!raw) return null;
	const cal = calendar(rows, skip);
	const adjusted = lrt(rows.map((_, i) => [1, ...cal.cols[i]]));
	return { n: rows.length, df, raw, adjusted, adjustedFor: cal.label };
}

/**
 * Each group's catch rate relative to the average group (rate ratio with 95% interval), from the
 * adjusted model: what "this season was unusual" means once nursery and calendar are held fixed.
 */
export function rateEffects(
	sets: SetRow[],
	groupOf: (s: SetRow) => string | null | undefined,
	key: RateKey = 'cpue',
	skip: Confounder[] = []
) {
	const rows = sets.filter((s) => s.cpue != null && s.durationMin && s.date && groupOf(s) != null);
	const levels = [...new Set(rows.map((s) => groupOf(s)!))].sort();
	if (rows.length < 20 || levels.length < 2) return null;
	const cal = calendar(rows, skip);
	const X = rows.map((s, i) => [1, ...cal.cols[i], ...effectCode(levels, groupOf(s)!)]);
	const fit = fitGlm(
		X,
		rows.map((s) => count(s, key)),
		rows.map((s) => Math.log(s.durationMin! / 60))
	);
	if (!fit) return null;
	const p = X[0].length;
	const g0 = p - (levels.length - 1);
	return levels.map((level, i) => {
		const g = Array.from({ length: p }, (_, k) =>
			k < g0 ? 0 : i === levels.length - 1 ? -1 : k - g0 === i ? 1 : 0
		);
		const c = contrast(fit, g);
		return { level, rr: Math.exp(c.est), lo: Math.exp(c.lo), hi: Math.exp(c.hi), p: c.p };
	});
}

const chi = (lr: number, df: number) => `χ²(${df}) = ${num(lr, 1)}`;

/** "Catch rates differ between moon phases (…)" or "No detectable difference … (…)". */
export function rateText(t: RateTest | null, what: string): string | null {
	if (!t) return null;
	const p = t.adjusted?.p ?? t.raw.p;
	const head =
		p < 0.05
			? `Catch rates differ between ${what}`
			: `No detectable difference in catch rate between ${what}`;
	const adj = t.adjusted
		? `; adjusted for ${t.adjustedFor}, ${chi(t.adjusted.lr, t.df)}, ${pValue(t.adjusted.p)}`
		: '';
	return `${head} (negative-binomial likelihood-ratio test on ${num(t.n)} timed sets: raw ${chi(t.raw.lr, t.df)}, ${pValue(t.raw.p)}${adj}).`;
}

/** Same for a numeric term: "Catch rate does (not) change with …". */
export function rateSlopeText(t: RateTest | null, what: string): string | null {
	if (!t) return null;
	const p = t.adjusted?.p ?? t.raw.p;
	const head =
		p < 0.05
			? `Catch rate changes with ${what}`
			: `No detectable change in catch rate with ${what}`;
	const adj = t.adjusted ? `; adjusted for ${t.adjustedFor}, ${pValue(t.adjusted.p)}` : '';
	return `${head} (negative-binomial likelihood-ratio test on ${num(t.n)} timed sets: raw ${pValue(t.raw.p)}${adj}).`;
}

/** Kruskal–Wallis across groups of values. */
export function groupsText(groups: Num[][], what: string): string | null {
	const k = kruskal(groups.filter((g) => g.length >= 3));
	if (!k) return null;
	return `${k.p < 0.05 ? 'Differs' : 'No detectable difference'} between ${what} (Kruskal–Wallis H = ${num(k.h, 1)}, df = ${k.df}, ${pValue(k.p)}, n = ${num(k.n)}).`;
}

/** Linear fit and Spearman rank correlation for a scatter. */
export function fitText(xy: [number, number][], unit = ''): string | null {
	const f = linearFit(xy);
	const r = spearman(xy);
	if (!f || !r) return null;
	const slope = `${f.slope >= 0 ? '+' : '−'}${num(Math.abs(f.slope), Math.abs(f.slope) < 1 ? 3 : 1)}${unit ? ` ${unit}` : ''}`;
	return `Linear fit: slope ${slope}, R² = ${num(f.r2, 2)}, ${pValue(f.p)}; Spearman ρ = ${num(r.rho, 2)}, ${pValue(r.p)} (n = ${num(f.n)}).`;
}

/** Spearman only, for monotonic but not necessarily linear relationships and small n. */
export function rankText(xy: [number, number][]): string | null {
	const r = spearman(xy);
	if (!r) return null;
	return `Spearman ρ = ${num(r.rho, 2)}, ${pValue(r.p)} (n = ${num(r.n)}).`;
}

/** Linear trend of one value per season (or year: `per`), index 0, 1, 2 …, with R². */
export function trendText(values: Num[], unit = '', per = 'season'): string | null {
	const xy = values
		.map((v, i) => [i, v] as [number, Num])
		.filter((p): p is [number, number] => p[1] != null && Number.isFinite(p[1]));
	const f = linearFit(xy);
	if (!f || xy.length < 5) return null;
	const step = `${f.slope >= 0 ? '+' : '−'}${num(Math.abs(f.slope), Math.abs(f.slope) < 1 ? 3 : 1)}${unit ? ` ${unit}` : ''}`;
	return `${f.p < 0.05 ? 'Trend' : 'No significant trend'} across ${xy.length} ${per}s: ${step} per ${per} (R² = ${num(f.r2, 2)}, ${pValue(f.p)}).`;
}

/** χ² test of a table of counts (rows = groups, columns = outcomes). */
export function tableText(table: number[][], what: string): string | null {
	const c = chiSquare(table.filter((r) => r.reduce((a, b) => a + b, 0) >= 5));
	if (!c) return null;
	return `${c.p < 0.05 ? 'Differs' : 'No detectable difference'} between ${what} (χ²(${c.df}) = ${num(c.stat, 1)}, ${pValue(c.p)}).`;
}

/** Welch's t-test between two groups. */
export function twoGroupText(a: Num[], b: Num[], what: string, unit = ''): string | null {
	const w = welch(a, b);
	if (!w) return null;
	return `${w.p < 0.05 ? 'Differs' : 'No detectable difference'} between ${what}: ${w.diff >= 0 ? '+' : '−'}${num(Math.abs(w.diff), 1)}${unit ? ` ${unit}` : ''} (Welch's t-test ${pValue(w.p)}).`;
}
