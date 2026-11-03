/**
 * In-situ temperature tables (#10): assign each logger file to a nursery, clean it, and reduce
 * the raw series to site-hourly means, complete days and a mean daily cycle per month.
 */
import type { HoboRow } from './extras';
import type { IssueLog } from './issues';
import {
	cleanFile,
	compareSeries,
	distanceM,
	hourIso,
	hourly,
	PLAUSIBLE_C,
	type LoggerFile,
	type RegisterRow
} from './loggers';
import { resolveSite } from './sites';

/** A download GPS this close to a nursery places the logger there. */
const GPS_RADIUS_M = 400;
/** Days with fewer site-hours are left out of daily statistics (half a day biases the mean). */
const MIN_DAY_HOURS = 18;
/** Good loggers correlate ~0.8–0.95 hour by hour with the other nurseries; below this, drop. */
const MIN_TRACK_R = 0.5;
/** A shifted series must beat lag 0 by this much before a clock is called off. Shifts of 1–2 h
 *  are normal between nurseries (tides and water exchange differ), so only larger ones count. */
const CLOCK_GAIN_R = 0.05;
const MIN_CLOCK_LAG_H = 3;

export interface SiteCoord {
	id: string;
	kind: string;
	lat: number | null;
	lon: number | null;
}

/** "Apaura 1", "PDP_2", "Valeri1" → the nursery name alone. */
const stripNo = (s: string | null) =>
	s?.replace(/[\s_-]*\d+[a-z]?$/i, '').replace(/_/g, ' ') ?? null;

const isoDate = (h: number) => hourIso(h).slice(0, 10);

function assignSite(
	f: LoggerFile,
	nurseries: SiteCoord[],
	register: Map<string, RegisterRow>,
	hobo: HoboRow[]
): { siteId: string | null; basis: string | null; conflict: string | null } {
	if (f.system === 'EnvLogger') {
		let gps: { id: string; d: number } | null = null;
		if (f.lat != null && f.lon != null)
			for (const s of nurseries) {
				const d = distanceM(f.lat, f.lon, s.lat!, s.lon!);
				if (d <= GPS_RADIUS_M && (!gps || d < gps.d)) gps = { id: s.id, d };
			}
		const reg = f.serial ? register.get(f.serial) : undefined;
		const fromReg = reg ? (resolveSite(reg.site) ?? resolveSite(stripNo(reg.name))) : null;
		const fromName = resolveSite(stripNo(f.siteHint));
		const named = fromName ?? fromReg;
		const conflict = gps && named && gps.id !== named ? named : null;
		if (gps) return { siteId: gps.id, basis: 'download GPS', conflict };
		if (fromName) return { siteId: fromName, basis: 'logger name', conflict: null };
		if (fromReg) return { siteId: fromReg, basis: 'register', conflict: null };
		return { siteId: null, basis: null, conflict: null };
	}
	const fromFile = resolveSite(f.siteHint);
	if (fromFile) return { siteId: fromFile, basis: 'file name', conflict: null };
	const rows = hobo.filter((r) => r.siteId && parseInt(r.logger ?? '', 10) === f.hoboNo);
	const t0 = f.t[0] / 1440;
	const t1 = f.t[f.t.length - 1] / 1440;
	const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86_400_000;
	let best: { id: string; overlap: number } | null = null;
	for (const r of rows) {
		if (!r.deployed) continue;
		const a = day(r.deployed);
		const b = r.retrieved ? day(r.retrieved) : a;
		const overlap = Math.min(t1, Math.max(a, b) + 3) - Math.max(t0, Math.min(a, b) - 3);
		if (overlap > 0 && (!best || overlap > best.overlap)) best = { id: r.siteId!, overlap };
	}
	if (best) return { siteId: best.id, basis: 'HOBO log', conflict: null };
	const counts = new Map<string, number>();
	for (const r of rows) counts.set(r.siteId!, (counts.get(r.siteId!) ?? 0) + 1);
	const common = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
	return { siteId: common, basis: common ? 'HOBO log' : null, conflict: null };
}

export function buildLoggerTables(
	loggers: LoggerFile[],
	register: RegisterRow[],
	hobo: HoboRow[],
	sites: SiteCoord[],
	log: IssueLog
) {
	const nurseries = sites.filter((s) => s.kind === 'nursery' && s.lat != null && s.lon != null);
	const reg = new Map(register.map((r) => [r.serial, r]));
	const ref = (file: string) => ({ file, sheet: '' });
	const files = [...loggers].sort(
		(a, b) =>
			a.system.localeCompare(b.system) || a.logger.localeCompare(b.logger) || a.t[0] - b.t[0]
	);
	const seen = new Map<string, Set<number>>();
	const fileRows: {
		file: string;
		system: string;
		logger: string;
		serial: string | null;
		siteId: string | null;
		siteBasis: string | null;
		start: string | null;
		end: string | null;
		samples: number;
		kept: number;
		lat: number | null;
		lon: number | null;
		excluded: string | null;
	}[] = [];
	const entries: {
		row: (typeof fileRows)[number];
		label: string;
		siteId: string;
		key: string;
		hours: Map<number, number>;
	}[] = [];
	for (const f of files) {
		const { siteId, basis, conflict } = assignSite(f, nurseries, reg, hobo);
		const label = f.system === 'HOBO' ? `HOBO ${f.logger}` : `EnvLogger ${f.logger}`;
		if (conflict)
			log.add(
				'warning',
				'loggers',
				`${label} is named for ${conflict} but was downloaded at ${siteId} (phone GPS); its readings are assigned to ${siteId}`,
				ref(f.file)
			);
		if (f.system === 'HOBO' && f.tzLabel && !/^-10/.test(f.tzLabel))
			log.add(
				'info',
				'loggers',
				`${label}: header says GMT${f.tzLabel}; times are read as Moorea local time (checked against the other loggers)`,
				ref(f.file)
			);
		const { t, v, stats } = siteId
			? cleanFile(f, seen)
			: { t: [], v: [], stats: { kept: 0, trimmed: 0, implausible: 0, duplicate: 0 } };
		if (!siteId)
			log.add(
				'info',
				'loggers',
				`${label}: no nursery in its name and not downloaded at a nursery; skipped (lab test?)`,
				ref(f.file)
			);
		if (stats.implausible)
			log.add(
				'info',
				'loggers',
				`${label}: ${stats.implausible} readings outside ${PLAUSIBLE_C[0]}–${PLAUSIBLE_C[1]} °C dropped (logger out of the water?)`,
				ref(f.file)
			);
		const row = {
			file: f.file,
			system: f.system,
			logger: f.logger,
			serial: f.serial,
			siteId,
			siteBasis: basis,
			start: t.length ? hourIso(t[0] / 60) : null,
			end: t.length ? hourIso(t[t.length - 1] / 60) : null,
			samples: f.t.length,
			kept: stats.kept,
			lat: f.lat,
			lon: f.lon,
			excluded: null as string | null
		};
		fileRows.push(row);
		if (!siteId || !t.length) continue;
		entries.push({
			row,
			label,
			siteId,
			key: `${f.system}:${f.serial ?? f.logger}`,
			hours: hourly(t, v)
		});
	}

	// Check each download against the loggers at the other nurseries (independent of its own
	// site, so one bad logger can't drag down its partner): a clock that is off lines up better
	// when shifted; a logger out of the water barely follows the lagoon at all.
	const refCache = new Map<string, Map<number, number>>();
	const elsewhere = (siteId: string) => {
		let m = refCache.get(siteId);
		if (!m) {
			const sum = new Map<number, { s: number; n: number }>();
			for (const o of entries)
				if (o.siteId !== siteId)
					for (const [h, x] of o.hours) {
						const a = sum.get(h) ?? { s: 0, n: 0 };
						a.s += x;
						a.n++;
						sum.set(h, a);
					}
			m = new Map([...sum].map(([h, a]) => [h, a.s / a.n]));
			refCache.set(siteId, m);
		}
		return m;
	};
	const r2 = (x: number) => x.toFixed(2);
	for (const e of entries) {
		const cmp = compareSeries(e.hours, elsewhere(e.siteId));
		if (!cmp) continue;
		if (cmp.r < MIN_TRACK_R) {
			e.row.excluded = `follows the other nurseries poorly (r = ${r2(cmp.r0)})`;
			log.add(
				'warning',
				'loggers',
				`${e.label}: readings barely follow the loggers at the other nurseries (r = ${r2(cmp.r0)} over ${Math.round(cmp.n / 24)} days), so they are left out. Was it out of the water or buried?`,
				ref(e.row.file)
			);
		} else if (Math.abs(cmp.lag) >= MIN_CLOCK_LAG_H && cmp.r - cmp.r0 >= CLOCK_GAIN_R)
			log.add(
				'warning',
				'loggers',
				`${e.label}: its daily cycle lines up best with the other nurseries when shifted ${cmp.lag > 0 ? '+' : ''}${cmp.lag} h (r ${r2(cmp.r0)} → ${r2(cmp.r)}); the logger clock may be off`,
				ref(e.row.file)
			);
	}

	// site → logger → local clock hour → mean °C
	const acc = new Map<string, Map<string, Map<number, number>>>();
	for (const e of entries) {
		if (e.row.excluded) continue;
		const bySite = acc.get(e.siteId) ?? new Map<string, Map<number, number>>();
		acc.set(e.siteId, bySite);
		const hours = bySite.get(e.key) ?? new Map<number, number>();
		// Files of one logger never share minutes (deduplicated), but can share an hour at a join.
		for (const [h, m] of e.hours) hours.set(h, hours.has(h) ? (hours.get(h)! + m) / 2 : m);
		bySite.set(e.key, hours);
	}

	// Site-hourly: mean of the loggers at that nursery.
	const siteHourly = new Map<string, Map<number, number>>();
	const loggersAt = new Map<string, Map<number, number>>();
	for (const [siteId, byLogger] of acc) {
		const sum = new Map<number, { s: number; n: number }>();
		for (const hours of byLogger.values())
			for (const [h, m] of hours) {
				const a = sum.get(h) ?? { s: 0, n: 0 };
				a.s += m;
				a.n++;
				sum.set(h, a);
			}
		siteHourly.set(siteId, new Map([...sum].map(([h, a]) => [h, a.s / a.n])));
		loggersAt.set(siteId, new Map([...sum].map(([h, a]) => [h, a.n])));
	}

	const daily: {
		siteId: string;
		date: string;
		mean: number;
		min: number;
		max: number;
		hours: number;
		loggers: number;
	}[] = [];
	const diel = new Map<string, { s: number; n: number }>();
	for (const [siteId, hours] of siteHourly) {
		const byDay = new Map<string, number[]>();
		for (const h of [...hours.keys()].sort((a, b) => a - b)) {
			const d = isoDate(h);
			const l = byDay.get(d);
			if (l) l.push(h);
			else byDay.set(d, [h]);
		}
		for (const [date, hs] of byDay) {
			if (hs.length < MIN_DAY_HOURS) continue;
			const vals = hs.map((h) => hours.get(h)!);
			const r2 = (x: number) => Math.round(x * 100) / 100;
			daily.push({
				siteId,
				date,
				mean: r2(vals.reduce((a, b) => a + b, 0) / vals.length),
				min: r2(Math.min(...vals)),
				max: r2(Math.max(...vals)),
				hours: hs.length,
				loggers: Math.max(...hs.map((h) => loggersAt.get(siteId)!.get(h)!))
			});
			for (const h of hs) {
				const k = `${siteId}|${+date.slice(5, 7)}|${((h % 24) + 24) % 24}`;
				const a = diel.get(k) ?? { s: 0, n: 0 };
				a.s += hours.get(h)!;
				a.n++;
				diel.set(k, a);
			}
		}
	}
	const dielRows = [...diel].map(([k, a]) => {
		const [siteId, month, hour] = k.split('|');
		return {
			siteId,
			month: +month,
			hour: +hour,
			temp: Math.round((a.s / a.n) * 100) / 100,
			n: a.n
		};
	});

	/** Mean site temperature over local clock hours [h0, h1]; null when no logger was running. */
	const between = (siteId: string | null, h0: number, h1: number) => {
		const hours = siteId ? siteHourly.get(siteId) : undefined;
		if (!hours) return null;
		const vals: number[] = [];
		for (let h = Math.floor(h0); h <= Math.floor(h1); h++) {
			const x = hours.get(h);
			if (x != null) vals.push(x);
		}
		return vals.length
			? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
			: null;
	};

	return { files: fileRows, daily, diel: dielRows, between };
}
