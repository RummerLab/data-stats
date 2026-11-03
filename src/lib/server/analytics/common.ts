import { boxStats, finite, mean, se } from '#lib/stats';
import { daysBetween } from '../import/normalize';
import type { Capture, Dataset, SetRow } from '../data';

export const SPECIES_MAIN = ['Cm', 'Na'] as const;

/** Nursery gillnet captures (no hook-and-line adults, no lab releases). */
export const fieldCaptures = (d: Dataset) => d.captures.filter((c) => c.kind === 'field');

/** Gillnet sets with a known duration (the denominator for catch per unit effort). */
export const effortSets = (d: Dataset) =>
	d.sets.filter((s) => s.gear === 'Gillnet' && s.durationMin != null && s.durationMin > 0);

/** One capture per shark per season (the first), to avoid counting recaptures twice. */
export function firstPerSeason(caps: Capture[]): Capture[] {
	const seen = new Set<string>();
	const out: Capture[] = [];
	for (const c of [...caps].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
		const k = `${c.individualId}|${c.season}`;
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(c);
	}
	return out;
}

/** Fulton's condition factor K = 100·W(g)/L(cm)³ using total length. */
export function fulton(c: { massKg: number | null; tlMm: number | null }): number | null {
	if (c.massKg == null || c.tlMm == null || c.tlMm <= 0) return null;
	const k = (100 * c.massKg * 1000) / (c.tlMm / 10) ** 3;
	return k > 0.2 && k < 2.5 ? k : null;
}

export const isNeonate = (c: Capture) =>
	c.ageClass === 'neonate' || c.umbilical === 'open' || c.umbilical === 'semi';

/** Day of the fieldwork season (1 Aug = day 0). */
export function seasonDay(date: string): number {
	const y = Number(date.slice(0, 4));
	const m = Number(date.slice(5, 7));
	const start = `${m >= 8 ? y : y - 1}-08-01`;
	return daysBetween(start, date);
}

export { seasonDayLabel } from '#lib/format';

export interface BinnedMean {
	label: string;
	x0: number;
	x1: number;
	n: number;
	mean: number | null;
	lo: number | null;
	hi: number | null;
}

/** Mean of y in x bins with a ±1.96·SE interval. */
export function binnedMean<T>(
	rows: T[],
	fx: (r: T) => number | null | undefined,
	fy: (r: T) => number | null | undefined,
	edges: number[],
	label: (a: number, b: number) => string
): BinnedMean[] {
	return edges.slice(0, -1).map((a, i) => {
		const b = edges[i + 1];
		const ys = rows
			.filter((r) => {
				const x = fx(r);
				return x != null && x >= a && (i === edges.length - 2 ? x <= b : x < b);
			})
			.map(fy);
		const m = mean(ys);
		const s = se(ys);
		return {
			label: label(a, b),
			x0: a,
			x1: b,
			n: finite(ys).length,
			mean: m,
			lo: m != null && s != null ? Math.max(0, m - 1.96 * s) : null,
			hi: m != null && s != null ? m + 1.96 * s : null
		};
	});
}

/** Consecutive captures of the same shark, for growth and movement. */
export interface RecapPair {
	id: string;
	species: string;
	a: Capture;
	b: Capture;
	days: number;
}

export function recapturePairs(caps: Capture[]): RecapPair[] {
	const byInd = new Map<string, Capture[]>();
	for (const c of caps) {
		if (!c.individualId || !c.date) continue;
		const l = byInd.get(c.individualId);
		if (l) l.push(c);
		else byInd.set(c.individualId, [c]);
	}
	const out: RecapPair[] = [];
	for (const [id, list] of byInd) {
		list.sort(
			(x, y) => x.date!.localeCompare(y.date!) || (x.captureMin ?? 0) - (y.captureMin ?? 0)
		);
		for (let i = 1; i < list.length; i++) {
			out.push({
				id,
				species: list[i].species,
				a: list[i - 1],
				b: list[i],
				days: daysBetween(list[i - 1].date!, list[i].date!)
			});
		}
	}
	return out;
}

export const boxOf = boxStats;

export function siteName(d: Dataset, id: string | null | undefined): string {
	return (id && d.siteById.get(id)?.name) || id || 'Unknown';
}

/** Nursery sites that actually appear in the logs, ordered by captures. */
export function activeNurseries(d: Dataset): string[] {
	const counts = new Map<string, number>();
	for (const c of fieldCaptures(d))
		if (c.siteId && d.siteById.get(c.siteId)?.kind === 'nursery')
			counts.set(c.siteId, (counts.get(c.siteId) ?? 0) + 1);
	return [...counts.entries()]
		.filter(([, n]) => n >= 10)
		.sort((a, b) => b[1] - a[1])
		.map(([id]) => id);
}

export function cpueOf(sets: SetRow[], key: 'cpue' | 'cpueCm' | 'cpueNa' = 'cpue'): number | null {
	const hours = sets.reduce((a, s) => a + (s.durationMin ?? 0) / 60, 0);
	if (!hours) return null;
	const n = sets.reduce(
		(a, s) => a + ((key === 'cpue' ? s.nTotal : key === 'cpueCm' ? s.nCm : s.nNa) ?? 0),
		0
	);
	return n / hours;
}

export const round = (v: number | null | undefined, dp = 2) =>
	v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp;
