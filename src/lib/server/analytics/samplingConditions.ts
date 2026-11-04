/**
 * Conditions on fieldwork nights against the record (#124). The weather and SST series are one
 * point for the whole island, so a night counts once however many nurseries or sets it had.
 *
 * Fieldwork clusters in some months, and the weather changes through the year, so nights are only
 * compared with days of the months they fell in. Each calendar month with fieldwork is a stratum,
 * and its days carry weight (fieldwork nights ÷ days with a value), so every month counts as much
 * in the reference as in the fieldwork. The reference includes the fieldwork nights themselves:
 * the two groups overlap, so instead of a two-sample test the statistic is checked against random
 * draws of the same number of days from each month (a within-month randomisation test).
 */
import { num, pValue } from '#lib/format';
import type { Dataset } from '../data';
import { round } from './common';

/** Draws for the randomisation test; p can't go below 1/(DRAWS + 1). */
export const DRAWS = 5000;

/** Seeded uniform draws (mulberry32), so the page shows the same p on every render. */
function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const daysOf = (month: string) => {
	const [y, m] = month.split('-').map(Number);
	const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
};

interface Variable {
	key: string;
	label: string;
	unit: string;
	dp: number;
	get: (date: string) => number | null | undefined;
	/** Bin edges. With `open`, the last edge starts a final open-ended bin. */
	edges: (values: number[]) => number[];
	open?: boolean;
}

/** Equal-width edges at multiples of `step` that cover every value. */
const steps = (step: number) => (values: number[]) => {
	const lo = Math.floor(Math.min(...values) / step) * step;
	const hi = Math.max(lo + step, Math.ceil((Math.max(...values) + 1e-9) / step) * step);
	return Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) =>
		round(lo + i * step, 3)!
	);
};

export function samplingConditions(d: Pick<Dataset, 'sets' | 'sites' | 'weather' | 'ocean'>) {
	const nurseries = new Set(d.sites.filter((s) => s.kind === 'nursery').map((s) => s.id));
	const nights = new Set(
		d.sets
			.filter((s) => s.gear === 'Gillnet' && s.date && s.siteId && nurseries.has(s.siteId))
			.map((s) => s.date!)
	);
	const byMonth = new Map<string, string[]>();
	for (const date of [...nights].sort()) {
		const m = date.slice(0, 7);
		byMonth.set(m, [...(byMonth.get(m) ?? []), date]);
	}
	const months = [...byMonth.keys()];
	const weather = new Map(d.weather.map((r) => [r.date, r]));
	const ocean = new Map(d.ocean.map((r) => [r.date, r]));
	const variables: Variable[] = [
		{
			key: 'rain',
			label: 'Rain that day',
			unit: 'mm',
			dp: 1,
			get: (x) => weather.get(x)?.precip,
			edges: () => [0, 1, 5, 10, 20, 40],
			open: true
		},
		{
			key: 'wind',
			label: 'Strongest wind that day',
			unit: 'km/h',
			dp: 1,
			get: (x) => weather.get(x)?.windMax,
			edges: steps(5)
		},
		{
			key: 'sst',
			label: 'Sea-surface temperature',
			unit: '°C',
			dp: 2,
			// Same source as the per-set SST (OISST where present, else Coral Reef Watch; #154).
			get: (x) => ocean.get(x)?.oisst ?? ocean.get(x)?.crwSst,
			edges: steps(0.5)
		}
	];

	const metrics = variables.map((v, vi) => {
		const value = (x: string) => {
			const y = v.get(x);
			return y != null && Number.isFinite(y) ? y : null;
		};
		// One stratum per month with fieldwork: its valid days and its valid fieldwork nights.
		const strata = months
			.map((m) => ({
				days: daysOf(m)
					.map(value)
					.filter((y): y is number => y != null),
				nights: byMonth
					.get(m)!
					.map(value)
					.filter((y): y is number => y != null)
			}))
			.filter((s) => s.nights.length && s.days.length);
		const sampledN = strata.reduce((n, s) => n + s.nights.length, 0);
		const nightsMissing = nights.size - sampledN;
		const refDays = strata.reduce((n, s) => n + s.days.length, 0);
		const refMissing =
			months.reduce((n, m) => n + daysOf(m).length, 0) -
			months.reduce((n, m) => n + daysOf(m).filter((x) => value(x) != null).length, 0);
		if (!sampledN) return { key: v.key, label: v.label, unit: v.unit, sampled: 0, rows: [] };

		const all = strata.flatMap((s) => s.days);
		const edges = v.edges(all);
		// Closed scales have one bin per pair of edges (the last includes its top edge); an open
		// scale's last edge starts a final "and above" bin.
		const nBins = v.open ? edges.length : edges.length - 1;
		const bin = (y: number) => {
			let i = nBins - 1;
			while (i > 0 && y < edges[i]) i--;
			return i;
		};
		const sampled = new Array<number>(nBins).fill(0);
		const refCount = new Array<number>(nBins).fill(0);
		const refShare = new Array<number>(nBins).fill(0);
		let sampledSum = 0,
			refMean = 0;
		for (const s of strata) {
			const w = s.nights.length / sampledN / s.days.length;
			for (const y of s.nights) {
				sampled[bin(y)]++;
				sampledSum += y;
			}
			for (const y of s.days) {
				refCount[bin(y)]++;
				refShare[bin(y)] += w;
				refMean += w * y;
			}
		}
		const sampledMean = sampledSum / sampledN;
		const diff = sampledMean - refMean;

		// Within-month randomisation: draw each month's number of nights from its own days.
		const rand = rng(124 + vi);
		let extreme = 0;
		for (let b = 0; b < DRAWS; b++) {
			let total = 0;
			for (const s of strata) {
				const pool = s.days.slice();
				for (let i = 0; i < s.nights.length; i++) {
					const j = i + Math.floor(rand() * (pool.length - i));
					[pool[i], pool[j]] = [pool[j], pool[i]];
					total += pool[i];
				}
			}
			if (Math.abs(total / sampledN - refMean) >= Math.abs(diff) - 1e-9) extreme++;
		}
		const p = (extreme + 1) / (DRAWS + 1);

		const fmt = (y: number) => num(y, v.dp === 2 ? 1 : 0);
		const rows = sampled.map((n, i) => ({
			bin:
				v.open && i === nBins - 1 ? `${fmt(edges[i])}+` : `${fmt(edges[i])}–${fmt(edges[i + 1])}`,
			sampled: n,
			sampledPct: round((100 * n) / sampledN, 1)!,
			reference: refCount[i],
			referencePct: round(100 * refShare[i], 1)!
		}));
		const shown = round(diff, v.dp)!;
		const gap =
			shown === 0
				? `0 ${v.unit}`
				: `${shown > 0 ? '+' : '−'}${num(Math.abs(shown), v.dp)} ${v.unit}`;
		const stats = `Fieldwork nights averaged ${num(sampledMean, v.dp)} ${v.unit} against ${num(refMean, v.dp)} ${v.unit} on all days of the same months, weighted by fieldwork per month (${gap}; within-month randomisation test, ${pValue(p)}, ${num(DRAWS)} draws).`;
		return {
			key: v.key,
			label: v.label,
			unit: v.unit,
			sampled: sampledN,
			nightsMissing,
			refDays,
			refMissing,
			sampledMean: round(sampledMean, v.dp + 1),
			refMean: round(refMean, v.dp + 1),
			p,
			stats,
			rows
		};
	});

	return {
		nights: nights.size,
		months: months.length,
		first: months[0] ?? null,
		last: months.at(-1) ?? null,
		metrics
	};
}
