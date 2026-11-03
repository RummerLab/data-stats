/**
 * In-situ logger temperature (#10): summaries shared by the water-quality page, nursery
 * profiles and findings. Daily rows are complete days (≥ 18 site-hours) from the import.
 */
import { boxStats, mean } from '#lib/stats';
import type { Dataset, LoggerDay } from '../data';
import { round, siteName } from './common';

/** Austral warm season, when pups are born. */
export const WARM_MONTHS = new Set([11, 12, 1, 2, 3, 4]);
/** A month needs this many logged days to be shown. */
const MIN_MONTH_DAYS = 10;

const dayNum = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export interface MonthRow {
	ym: string;
	x: number;
	mean: number;
	min: number;
	max: number;
	days: number;
}

/** Monthly means of the daily mean, minimum and maximum. */
export function monthly(days: LoggerDay[]): MonthRow[] {
	const by = new Map<string, LoggerDay[]>();
	for (const d of days) {
		const ym = d.date.slice(0, 7);
		const l = by.get(ym);
		if (l) l.push(d);
		else by.set(ym, [d]);
	}
	return [...by]
		.filter(([, l]) => l.length >= MIN_MONTH_DAYS)
		.map(([ym, l]) => ({
			ym,
			x: dayNum(`${ym}-15`),
			mean: round(mean(l.map((d) => d.mean)))!,
			min: round(mean(l.map((d) => d.min)))!,
			max: round(mean(l.map((d) => d.max)))!,
			days: l.length
		}))
		.sort((a, b) => a.ym.localeCompare(b.ym));
}

/** Island-wide daily mean: the average of the nurseries logged that day. */
export function islandDaily(d: Dataset) {
	const by = new Map<string, number[]>();
	for (const r of d.loggerDaily) {
		const l = by.get(r.date);
		if (l) l.push(r.mean);
		else by.set(r.date, [r.mean]);
	}
	return new Map([...by].map(([date, l]) => [date, { mean: mean(l)!, sites: l.length }]));
}

/** Insert null points where consecutive months are more than ~6 weeks apart, to break lines. */
export function withGaps(points: { x: number; y: number | null }[]) {
	const out: { x: number; y: number | null }[] = [];
	for (const p of points) {
		const prev = out[out.length - 1];
		if (prev && p.x - prev.x > 45) out.push({ x: prev.x + 15, y: null });
		out.push(p);
	}
	return out;
}

/** Mean daily cycle in the warm and cool seasons, for one nursery or all of them. */
export function dielBySeason(d: Dataset, siteId?: string) {
	const rows = d.loggerDiel.filter((r) => !siteId || r.siteId === siteId);
	const curve = (warm: boolean) =>
		Array.from({ length: 24 }, (_, hour) => {
			const hs = rows.filter((r) => r.hour === hour && WARM_MONTHS.has(r.month) === warm);
			const n = hs.reduce((a, r) => a + r.n, 0);
			return { x: hour, y: n ? round(hs.reduce((a, r) => a + r.temp * r.n, 0) / n) : null };
		});
	return { warm: curve(true), cool: curve(false) };
}

/** Logger coverage per nursery and system, for the coverage timeline. */
export function coverage(d: Dataset) {
	const rows = new Map<
		string,
		{ label: string; items: { start: number; end: number; tip: string; color: string }[] }
	>();
	for (const f of d.loggerFiles) {
		if (!f.siteId || !f.start || !f.end || f.excluded) continue;
		const label = siteName(d, f.siteId);
		const r = rows.get(label) ?? { label, items: [] };
		r.items.push({
			start: dayNum(f.start.slice(0, 10)),
			end: dayNum(f.end.slice(0, 10)),
			tip: `${f.system} ${f.logger} · ${f.start.slice(0, 10)} → ${f.end.slice(0, 10)}`,
			color: f.system === 'HOBO' ? 'var(--series-3)' : 'var(--series-5)'
		});
		rows.set(label, r);
	}
	return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Per-nursery distribution of daily maxima, warmest first. Only nurseries logged for at least a
 * year with both seasons well covered: one logged only in summer would look hottest for that alone.
 */
export function dailyMaxBySite(d: Dataset) {
	const sites = [...new Set(d.loggerDaily.map((r) => r.siteId))];
	return sites
		.map((id) => {
			const days = d.loggerDaily.filter((r) => r.siteId === id);
			const warm = days.filter((r) => WARM_MONTHS.has(+r.date.slice(5, 7))).length;
			return {
				id,
				name: siteName(d, id),
				balanced: days.length >= 365 && warm >= 90 && days.length - warm >= 90,
				stats: boxStats(days.map((r) => r.max))
			};
		})
		.filter((b) => b.balanced && b.stats)
		.sort((a, b) => b.stats!.median - a.stats!.median);
}

/** Logger daily mean against offshore OISST on the same days. */
export function versusSst(d: Dataset) {
	const sst = new Map(d.ocean.map((o) => [o.date, o.oisst ?? o.crwSst]));
	const pairs: { date: string; logger: number; sst: number }[] = [];
	for (const [date, v] of islandDaily(d)) {
		const s = sst.get(date);
		if (s != null) pairs.push({ date, logger: v.mean, sst: s });
	}
	return {
		pairs,
		diff: pairs.length ? round(mean(pairs.map((p) => p.logger - p.sst))) : null
	};
}

export function summary(d: Dataset) {
	const days = d.loggerDaily;
	if (!days.length) return null;
	const used = d.loggerFiles.filter((f) => f.siteId && f.kept > 0 && !f.excluded);
	const hottest = days.reduce((a, b) => (b.max > a.max ? b : a));
	const coolest = days.reduce((a, b) => (b.min < a.min ? b : a));
	const years = (system: string) => {
		const fs = used.filter((f) => f.system === system && f.start && f.end);
		if (!fs.length) return null;
		const a = fs
			.map((f) => f.start!)
			.sort()[0]
			.slice(0, 4);
		const b = fs
			.map((f) => f.end!)
			.sort()
			.at(-1)!
			.slice(0, 4);
		return a === b ? a : `${a}–${b}`;
	};
	return {
		hoboYears: years('HOBO'),
		envYears: years('EnvLogger'),
		files: used.length,
		loggers: new Set(used.map((f) => `${f.system}:${f.serial ?? f.logger}`)).size,
		readings: used.reduce((a, f) => a + f.kept, 0),
		nurseries: new Set(days.map((r) => r.siteId)).size,
		siteDays: days.length,
		first: days[0].date,
		last: days[days.length - 1].date,
		hottest: { site: siteName(d, hottest.siteId), date: hottest.date, temp: hottest.max },
		coolest: { site: siteName(d, coolest.siteId), date: coolest.date, temp: coolest.min }
	};
}
