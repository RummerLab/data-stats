/**
 * Import orchestrator (#2–#8, #21). Reads every workbook in DATA_DIR (read-only; the
 * spreadsheets are the source of truth and are never written), normalises them, links captures
 * to sets and to individual sharks, joins the environmental snapshots and writes a brand-new
 * SQLite file. The caller swaps it in atomically.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import * as schema from '../db/schema';
import { moonAt, sunTimes } from '../astro';
import { findExtrema, interpolate, tsToHour, type HourlyPoint } from '../tides';
import { EXTERNAL_FILES, readCsv, val } from './external';
import {
	extraSheetKind,
	parseAdultSamples,
	parseBlood,
	parseFeeding,
	parseFieldWq,
	parseHobo,
	parseLabDiff,
	parseLabSharks,
	parseLabWq,
	parseLocationNames,
	parseMouth,
	parsePrey,
	parseSiteSalinity,
	type AdultSampleRow,
	type BloodRow,
	type FeedingRow,
	type FieldWqRow,
	type HoboRow,
	type LabShark,
	type LabWqRow,
	type MouthRow,
	type PreyRow,
	type SiteDescription
} from './extras';
import { IssueLog } from './issues';
import {
	isCaptureSheet,
	isSetSheet,
	parseCaptureSheet,
	parseRecaptures2014,
	parseSetSheet,
	recaptureGroups2013,
	yearOffSetDate,
	type RawCapture,
	type RawSet
} from './logs';
import { daysBetween, seasonOf, weekday } from './normalize';
import {
	parseAdults,
	parseNurseryGps,
	parsePressure,
	pressureFromDataset,
	type AdultCapture,
	type AdultEffort,
	type SitePressure,
	type SiteGps
} from './reference';
import { crewKey } from './crew';
import {
	isLoggerRegister,
	parseLoggerCsv,
	parseLoggerRegister,
	type LoggerFile,
	type ParsedCsv,
	type RegisterRow
} from './loggers';
import { buildLoggerTables } from './insitu';
import { checkRecaptures } from './recaptures';
import { SITE_DEFS } from './sites';
import { computeAllNurseryRoutes } from '../oceanRoutes';
import { readWorkbook } from './xlsx';

/** Bump when import logic changes so existing caches rebuild on the next start. */
export const IMPORTER_VERSION = '13';

const MIGRATIONS = import.meta.glob('/drizzle/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Sheets we know about and deliberately skip (derived summaries, schedules, duplicates). */
const SKIPPED_SHEETS = new Set([
	'shark log physioshark', // 2013-14 duplicate of "Catch data" (#9)
	'set log physioshark', // 2013-14 duplicate of "Set Log" (#9)
	'nursery efficiency',
	'analyses',
	'feuil1',
	'fishing schedule',
	'sites',
	'pit log' // #11
]);

export interface ImportOptions {
	dataDir: string;
	externalDir: string;
}

export interface SourceFile {
	path: string;
	size: number;
	mtime: number;
}

/**
 * Every workbook and logger CSV under `dir`. Folders or files the app can't read (e.g. EACCES
 * when the host folder isn't readable by the container user) are skipped and reported through
 * `onError`, so a permissions slip shows up on the Data quality page instead of taking the site
 * down (#83).
 */
export function listDataFiles(
	dir: string,
	onError?: (path: string, err: NodeJS.ErrnoException) => void
): SourceFile[] {
	if (!existsSync(dir)) return [];
	const out: SourceFile[] = [];
	const walk = (d: string) => {
		let entries;
		try {
			entries = readdirSync(d, { withFileTypes: true });
		} catch (err) {
			onError?.(d, err as NodeJS.ErrnoException);
			return;
		}
		for (const ent of entries) {
			const p = join(d, ent.name);
			if (ent.isDirectory()) walk(p);
			else if (/\.(xlsx|csv)$/i.test(ent.name) && !ent.name.startsWith('~$')) {
				try {
					const st = statSync(p);
					out.push({ path: p, size: st.size, mtime: Math.round(st.mtimeMs) });
				} catch (err) {
					onError?.(p, err as NodeJS.ErrnoException);
				}
			}
		}
	};
	walk(dir);
	return out.sort((a, b) => a.path.localeCompare(b.path));
}

export const listWorkbooks = (
	dir: string,
	onError?: (path: string, err: NodeJS.ErrnoException) => void
) => listDataFiles(dir, onError).filter((f) => /\.xlsx$/i.test(f.path));

/** Fingerprint of everything an import depends on. */
export function importHash(opts: ImportOptions): string {
	const h = createHash('sha256');
	h.update(`importer:${IMPORTER_VERSION}\n`);
	for (const [name, sql] of Object.entries(MIGRATIONS).sort())
		h.update(`${name}:${sql.length}:${sql}\n`);
	// Unreadable paths are part of the fingerprint, so fixing their permissions triggers a rebuild.
	const unreadable = (p: string, err: NodeJS.ErrnoException) =>
		h.update(`!${relative(opts.dataDir, p)}:${err.code}\n`);
	for (const f of listDataFiles(opts.dataDir, unreadable))
		h.update(`${relative(opts.dataDir, f.path)}:${f.size}:${f.mtime}\n`);
	for (const name of EXTERNAL_FILES) {
		for (const p of [join(opts.externalDir, name), join(opts.externalDir, `${name}.gz`)]) {
			if (existsSync(p)) {
				const st = statSync(p);
				h.update(`${name}:${st.size}:${Math.round(st.mtimeMs)}\n`);
			}
		}
	}
	return h.digest('hex').slice(0, 16);
}

// ------------------------------------------------------------------------------------------

interface Parsed {
	captures: RawCapture[];
	sets: RawSet[];
	labSharks: LabShark[];
	labWq: LabWqRow[];
	feeding: FeedingRow[];
	fieldWq: FieldWqRow[];
	hobo: HoboRow[];
	blood: BloodRow[];
	mouth: MouthRow[];
	prey: PreyRow[];
	adultSamples: AdultSampleRow[];
	descriptions: SiteDescription[];
	gps: SiteGps[];
	pressure: SitePressure[];
	adults: AdultCapture[];
	adultEffort: AdultEffort[];
	loggers: LoggerFile[];
	register: RegisterRow[];
	files: { file: string; kind: string; sheets: number }[];
}

function parseAll(dataDir: string, log: IssueLog): Parsed {
	const p: Parsed = {
		captures: [],
		sets: [],
		labSharks: [],
		labWq: [],
		feeding: [],
		fieldWq: [],
		hobo: [],
		blood: [],
		mouth: [],
		prey: [],
		adultSamples: [],
		descriptions: [],
		gps: [],
		pressure: [],
		adults: [],
		adultEffort: [],
		loggers: [],
		register: [],
		files: []
	};
	const unreadable = (path: string, err: NodeJS.ErrnoException) =>
		log.add(
			'error',
			'files',
			`Could not read ${path === dataDir ? 'the data folder' : 'this path'} (${err.code ?? err.message}). ` +
				'Make it readable by the app (in Docker, uid 65532), e.g. chmod -R o+rX on the host folder.',
			{ file: relative(dataDir, path).replace(/\\/g, '/') || '.', sheet: '' }
		);
	const loggerFolders = new Map<string, { kinds: Set<string>; n: number }>();
	for (const f of listDataFiles(dataDir, unreadable)) {
		const rel = relative(dataDir, f.path).replace(/\\/g, '/');
		const base = basename(f.path);
		if (/\.csv$/i.test(base)) {
			let parsed: ParsedCsv;
			try {
				parsed = parseLoggerCsv(readFileSync(f.path), rel);
			} catch (err) {
				log.add('error', 'files', `Could not read CSV: ${(err as Error).message}`, {
					file: rel,
					sheet: ''
				});
				continue;
			}
			if ('skip' in parsed) {
				if (parsed.skip === 'unknown')
					log.add('info', 'files', 'CSV not recognised as a logger export; skipped', {
						file: rel,
						sheet: ''
					});
				else if (parsed.skip === 'empty')
					log.add('info', 'loggers', 'Logger export has no readings; skipped', {
						file: rel,
						sheet: ''
					});
				continue;
			}
			p.loggers.push(parsed);
			const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : './';
			const e = loggerFolders.get(folder) ?? { kinds: new Set<string>(), n: 0 };
			e.kinds.add(parsed.system);
			e.n++;
			loggerFolders.set(folder, e);
			continue;
		}
		let wb;
		try {
			wb = readWorkbook(readFileSync(f.path));
		} catch (err) {
			log.add('error', 'files', `Could not read workbook: ${(err as Error).message}`, {
				file: rel,
				sheet: ''
			});
			continue;
		}
		const seasonMatch = base.match(/(20\d\d)\s*[-–_]\s*(20\d\d)/);
		if (isLoggerRegister(wb)) {
			// Checked first: its name ("…Locations…") would otherwise read as the nursery GPS sheet.
			p.files.push({ file: rel, kind: 'Temperature logger register', sheets: wb.sheets.length });
			p.register.push(...parseLoggerRegister(wb));
		} else if (/shark log/i.test(base) && seasonMatch) {
			const season = `${seasonMatch[1]}-${seasonMatch[2]}`;
			p.files.push({ file: rel, kind: `Season log ${season}`, sheets: wb.sheets.length });
			const caps: RawCapture[] = [];
			let groups: Map<string, string> | null = null;
			for (const sheet of wb.sheets) {
				if (sheet.rows.length < 2) continue;
				const name = sheet.name.trim().toLowerCase();
				const kind = extraSheetKind(sheet.name);
				if (isCaptureSheet(sheet)) caps.push(...parseCaptureSheet(sheet, season, rel, log));
				else if (isSetSheet(sheet)) p.sets.push(...parseSetSheet(sheet, season, rel, log));
				else if (name === 'recaptures') {
					if (season === '2013-2014') groups = recaptureGroups2013(sheet);
					else caps.push(...parseRecaptures2014(sheet, season, rel, log));
				} else if (kind === 'lab_sharks') p.labSharks.push(...parseLabSharks(sheet, season, rel));
				else if (kind === 'lab_diff') p.labSharks.push(...parseLabDiff(sheet, season, rel));
				else if (kind === 'lab_wq') p.labWq.push(...parseLabWq(sheet, season));
				else if (kind === 'feeding') p.feeding.push(...parseFeeding(sheet, season));
				else if (kind === 'field_wq') p.fieldWq.push(...parseFieldWq(sheet, season));
				else if (kind === 'site_salinity') p.fieldWq.push(...parseSiteSalinity(sheet, season));
				else if (kind === 'hobo') p.hobo.push(...parseHobo(sheet, season));
				else if (kind === 'blood') p.blood.push(...parseBlood(sheet, season));
				else if (kind === 'mouth') p.mouth.push(...parseMouth(sheet, season));
				else if (kind === 'prey') p.prey.push(...parsePrey(sheet, season));
				else if (kind === 'adult_samples') p.adultSamples.push(...parseAdultSamples(sheet));
				else if (kind === 'location_names') p.descriptions.push(...parseLocationNames(sheet, log));
				else if (!SKIPPED_SHEETS.has(name))
					log.add('info', 'sheets', `Sheet not imported (unknown layout)`, {
						file: rel,
						sheet: sheet.name
					});
			}
			if (groups)
				for (const c of caps)
					if (c.sharkNo && groups.has(c.sharkNo)) c.group = groups.get(c.sharkNo);
			// The lab-diff sheet repeats the lab log for 2016-17: keep the richer of the two per shark.
			p.captures.push(...caps);
		} else if (/adult/i.test(base)) {
			p.files.push({ file: rel, kind: 'Adult captures', sheets: wb.sheets.length });
			const a = parseAdults(wb, rel);
			p.adults.push(...a.captures);
			p.adultEffort.push(...a.effort);
		} else if (/gps|location/i.test(base)) {
			p.files.push({ file: rel, kind: 'Nursery GPS', sheets: wb.sheets.length });
			p.gps.push(...parseNurseryGps(wb, log, rel));
		} else if (/anthropogenic|ranking|pressure/i.test(base)) {
			p.files.push({ file: rel, kind: 'Anthropogenic pressure', sheets: wb.sheets.length });
			p.pressure.push(...parsePressure(wb, log, rel));
		} else {
			p.files.push({ file: rel, kind: 'Not recognised', sheets: wb.sheets.length });
			log.add('info', 'files', 'Workbook not recognised; skipped', { file: rel, sheet: '' });
		}
	}
	for (const [folder, e] of loggerFolders)
		p.files.push({
			file: folder,
			kind: `Temperature logger CSVs (${[...e.kinds].sort().join(', ')})`,
			sheets: e.n
		});
	return p;
}

// ------------------------------------------------------------------------------------------

class UnionFind {
	parent: number[];
	constructor(n: number) {
		this.parent = Array.from({ length: n }, (_, i) => i);
	}
	find(i: number): number {
		while (this.parent[i] !== i) {
			this.parent[i] = this.parent[this.parent[i]];
			i = this.parent[i];
		}
		return i;
	}
	union(a: number, b: number) {
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) this.parent[rb] = ra;
	}
}

const tagRank = (t: string) => (/^\d{14,16}$/.test(t) ? 0 : t.startsWith('COFA') ? 1 : 2);

function mode<T>(xs: (T | null)[]): T | null {
	const m = new Map<T, number>();
	for (const x of xs) if (x != null) m.set(x, (m.get(x) ?? 0) + 1);
	let best: T | null = null;
	let n = 0;
	for (const [k, v] of m) if (v > n) [best, n] = [k, v];
	return best;
}

export interface ImportSummary {
	hash: string;
	durationMs: number;
	counts: Record<string, number>;
	issues: number;
}

/** Run a full import into a fresh SQLite file at `outPath`. */
export function runImport(
	opts: ImportOptions,
	outPath: string,
	hash = importHash(opts)
): ImportSummary {
	const t0 = performance.now();
	const log = new IssueLog();
	const p = parseAll(opts.dataDir, log);
	if (p.files.length === 0)
		log.add('warning', 'files', `No spreadsheets found in DATA_DIR (${opts.dataDir})`);

	// --- sets: ids, crew ----------------------------------------------------------------------
	// One display spelling per person: "Felicie"/"Félicie" or "Isa"/"ISA" become the most common form.
	const spellings = new Map<string, Map<string, number>>();
	for (const s of p.sets)
		for (const name of s.crew) {
			const m = spellings.get(crewKey(name)) ?? new Map<string, number>();
			m.set(name, (m.get(name) ?? 0) + 1);
			spellings.set(crewKey(name), m);
		}
	const display = new Map(
		[...spellings.entries()].map(([k, m]) => [
			k,
			[...m.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
		])
	);
	for (const s of p.sets) s.crew = [...new Set(s.crew.map((n) => display.get(crewKey(n)) ?? n))];
	const sets = p.sets.map((s, i) => ({
		...s,
		id: i + 1,
		linked: { Cm: 0, Na: 0, Nf: 0, other: 0 }
	}));
	const bySeasonNo = new Map<string, typeof sets>();
	const byDateSite = new Map<string, typeof sets>();
	const byDate = new Map<string, typeof sets>();
	const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
		const l = m.get(k);
		if (l) l.push(v);
		else m.set(k, [v]);
	};
	for (const s of sets) {
		if (s.setNo != null) push(bySeasonNo, `${s.season}|${s.setNo}`, s);
		if (s.date && s.siteId) push(byDateSite, `${s.date}|${s.siteId}`, s);
		if (s.date) push(byDate, s.date, s);
	}

	// --- captures: link to sets -----------------------------------------------------------------
	const caps = p.captures.map((c, i) => ({
		...c,
		id: i + 1,
		setId: null as number | null,
		individualId: ''
	}));
	let unlinked = 0;
	for (const c of caps) {
		if (c.kind === 'lab_release') continue;
		let s: (typeof sets)[number] | undefined;
		const setDate = yearOffSetDate(c, bySeasonNo.get(`${c.season}|${c.setNo}`) ?? []);
		if (setDate && setDate !== c.date) {
			log.add(
				'warning',
				'dates',
				`Capture dated ${c.writtenDate} (outside season ${c.season}) is in set ${c.setNo}, dated ${setDate}; read as ${setDate}`,
				c.ref,
				'date',
				c.writtenDate
			);
			c.date = setDate;
		}
		if (c.setNo != null) {
			const cands = (bySeasonNo.get(`${c.season}|${c.setNo}`) ?? []).filter(
				(x) => !c.date || !x.date || Math.abs(daysBetween(x.date, c.date)) <= 1
			);
			s = cands.find((x) => x.siteId === c.siteId) ?? (cands.length === 1 ? cands[0] : undefined);
		}
		if (!s && c.date && c.siteId) s = byDateSite.get(`${c.date}|${c.siteId}`)?.[0];
		if (!s && c.date) {
			const ds = byDate.get(c.date);
			if (ds?.length === 1) s = ds[0];
		}
		if (s) {
			c.setId = s.id;
			c.date ??= s.date;
			c.siteId ??= s.siteId;
			if (c.species === 'Cm' || c.species === 'Na' || c.species === 'Nf') s.linked[c.species]++;
			else s.linked.other++;
		} else if (c.kind === 'field' && c.date) unlinked++;
	}
	if (unlinked)
		log.add(
			'info',
			'linking',
			`${unlinked} field captures could not be matched to a set (no set log row for that date/site)`
		);

	// --- individuals --------------------------------------------------------------------------
	const uf = new UnionFind(caps.length);
	const tagOwner = new Map<string, number>();
	const groupOwner = new Map<string, number>();
	caps.forEach((c, i) => {
		for (const t of c.tags) {
			const o = tagOwner.get(t);
			if (o == null) tagOwner.set(t, i);
			else uf.union(o, i);
		}
		if (c.group) {
			const o = groupOwner.get(c.group);
			if (o == null) groupOwner.set(c.group, i);
			else uf.union(o, i);
		}
	});
	const labTags = new Set(p.labSharks.flatMap((l) => l.tags));
	const comps = new Map<number, number[]>();
	caps.forEach((_, i) => push(comps as unknown as Map<string, number[]>, String(uf.find(i)), i));
	const individuals: (typeof schema.individuals.$inferInsert)[] = [];
	for (const members of (comps as unknown as Map<string, number[]>).values()) {
		const list = members
			.map((i) => caps[i])
			.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
		const tags = [...new Set(list.flatMap((c) => c.tags))];
		const best = [...tags].sort((a, b) => tagRank(a) - tagRank(b))[0];
		const first = list[0];
		const id = best ?? `${first.season}:${first.species}:${first.sharkNo ?? 'x'}:${first.id}`;
		const species = mode(list.map((c) => c.species)) ?? 'Unknown';
		const sexes = new Set(list.map((c) => c.sex).filter(Boolean));
		const conflicts: string[] = [];
		if (sexes.size > 1) conflicts.push('sex');
		if (new Set(list.map((c) => c.species)).size > 1) conflicts.push('species');
		for (let k = 1; k < list.length; k++) {
			const a = list[k - 1].tlMm;
			const b = list[k].tlMm;
			if (a != null && b != null && b < a - 50) conflicts.push('length');
		}
		if (conflicts.length)
			log.add(
				'warning',
				'identity',
				`Shark ${id}: captures disagree on ${[...new Set(conflicts)].join(', ')}`,
				first.ref
			);
		checkRecaptures(
			list,
			log,
			tags.some((t) => labTags.has(t))
		);
		for (const c of list) c.individualId = id;
		const siteSeq: string[] = [];
		for (const c of list)
			if (c.siteId && siteSeq[siteSeq.length - 1] !== c.siteId) siteSeq.push(c.siteId);
		const withTl = list.filter((c) => c.tlMm != null);
		individuals.push({
			id,
			species,
			sex: mode(list.map((c) => c.sex)),
			firstDate: first.date,
			lastDate: list[list.length - 1].date,
			nCaptures: list.length,
			nSeasons: new Set(list.map((c) => c.season)).size,
			sites: JSON.stringify(siteSeq),
			firstTlMm: withTl[0]?.tlMm ?? null,
			lastTlMm: withTl[withTl.length - 1]?.tlMm ?? null,
			tags: JSON.stringify(tags),
			conflict: conflicts.length ? [...new Set(conflicts)].join(',') : null
		});
	}
	const tagToIndividual = new Map<string, string>();
	for (const c of caps) for (const t of c.tags) tagToIndividual.set(t, c.individualId);

	// --- environment ----------------------------------------------------------------------------
	const wDaily = new Map(readCsv(opts.externalDir, 'weather-daily.csv').map((r) => [r.date, r]));
	const wHourly = new Map(readCsv(opts.externalDir, 'weather-hourly.csv').map((r) => [r.ts, r]));
	const ocean = new Map(readCsv(opts.externalDir, 'ocean-daily.csv').map((r) => [r.date, r]));
	const climate = new Map(readCsv(opts.externalDir, 'climate-monthly.csv').map((r) => [r.ym, r]));
	const chlRows = readCsv(opts.externalDir, 'chlorophyll-weekly.csv').filter((r) => r.date);
	// Each weekly composite covers its centre date ± 3 days.
	const chlByDay = new Map<string, number>();
	for (const r of chlRows) {
		const v = val(r.chl);
		if (v == null) continue;
		const t = Date.parse(`${r.date}T00:00:00Z`);
		for (let k = -3; k <= 3; k++)
			chlByDay.set(new Date(t + k * 86_400_000).toISOString().slice(0, 10), v);
	}
	const cyclones = readCsv(opts.externalDir, 'cyclones.csv');
	const school = readCsv(opts.externalDir, 'school-holidays.csv');
	const tidePts: HourlyPoint[] = readCsv(opts.externalDir, 'tide-papeete-hourly.csv')
		.map((r) => ({ t: tsToHour(r.ts), mm: Number(r.mm) }))
		.filter((x) => Number.isFinite(x.mm))
		.sort((a, b) => a.t - b.t);
	const tideIdx = new Map(tidePts.map((pt, i) => [pt.t, i]));
	const extrema = findExtrema(tidePts);
	const tideRange = new Map<string, { lo: number; hi: number }>();
	for (const e of extrema) {
		const d = e.ts.slice(0, 10);
		const r = tideRange.get(d) ?? { lo: Infinity, hi: -Infinity };
		r.lo = Math.min(r.lo, e.mm);
		r.hi = Math.max(r.hi, e.mm);
		tideRange.set(d, r);
	}
	const dayHour = (date: string, minutes: number) =>
		Date.parse(`${date}T00:00:00Z`) / 3_600_000 + minutes / 60;
	const tideAt = (date: string, minutes: number) =>
		interpolate(tidePts, tideIdx, dayHour(date, minutes));
	const trendAt = (date: string, minutes: number) => {
		const a = tideAt(date, minutes - 30);
		const b = tideAt(date, minutes + 30);
		return a == null || b == null ? null : b > a + 2 ? 'rising' : b < a - 2 ? 'falling' : 'slack';
	};
	const hourlyMean = (
		date: string,
		from: number,
		to: number,
		key: string,
		agg: 'mean' | 'sum' = 'mean'
	) => {
		const vals: number[] = [];
		for (let m = Math.floor(from / 60) * 60; m <= to; m += 60) {
			const h = new Date(dayHour(date, m) * 3_600_000).toISOString().slice(0, 13);
			const v = val(wHourly.get(h)?.[key]);
			if (v != null) vals.push(v);
		}
		if (!vals.length) return null;
		const s = vals.reduce((a, b) => a + b, 0);
		return agg === 'sum' ? s : s / vals.length;
	};
	const ymOf = (d: string) => d.slice(0, 7);

	// --- in-situ loggers (#10) ------------------------------------------------------------------
	const gpsBySite = new Map(p.gps.map((g) => [g.siteId, g]));
	const insitu = buildLoggerTables(
		p.loggers,
		p.register,
		p.hobo,
		SITE_DEFS.map((d) => ({
			id: d.id,
			kind: d.kind,
			lat: gpsBySite.get(d.id)?.lat ?? d.lat ?? null,
			lon: gpsBySite.get(d.id)?.lon ?? d.lon ?? null
		})),
		log
	);

	const setRows: (typeof schema.sets.$inferInsert)[] = sets.map((s) => {
		const linkedTotal = s.linked.Cm + s.linked.Na + s.linked.Nf + s.linked.other;
		const sheetTotal =
			s.nTotal ??
			(s.nCm != null || s.nNa != null ? (s.nCm ?? 0) + (s.nNa ?? 0) + (s.nNf ?? 0) : null);
		const nTotal = Math.max(sheetTotal ?? 0, linkedTotal);
		const nCm = Math.max(s.nCm ?? 0, s.linked.Cm);
		const nNa = Math.max(s.nNa ?? 0, s.linked.Na);
		const hours = s.durationMin ? s.durationMin / 60 : null;
		if (sheetTotal != null && sheetTotal !== linkedTotal && linkedTotal > 0)
			log.add(
				'info',
				'counts',
				`Set log says ${sheetTotal} sharks, shark logs have ${linkedTotal}`,
				s.ref
			);
		let env: Partial<typeof schema.sets.$inferInsert> = {};
		if (s.date) {
			const sun = sunTimes(s.date);
			const start = s.startMin ?? sun.sunset - 60;
			const end = s.endMin ?? sun.sunset + 120;
			const mid = (start + end) / 2;
			const moon = moonAt(s.date, mid);
			const o = ocean.get(s.date);
			const range = tideRange.get(s.date);
			env = {
				sunsetMin: sun.sunset,
				civilDuskMin: sun.civilDusk,
				moonPhase: moon.phase,
				moonIllum: moon.fraction,
				moonAltMid: s.startMin != null ? moon.altitude : null,
				tideStartMm: s.startMin != null ? tideAt(s.date, s.startMin) : null,
				tideMidMm: s.startMin != null ? tideAt(s.date, mid) : tideAt(s.date, mid),
				tideTrend: trendAt(s.date, mid),
				tideRangeMm: range && Number.isFinite(range.lo) ? range.hi - range.lo : null,
				airTemp: hourlyMean(s.date, start, end, 'temp'),
				windSpeed: hourlyMean(s.date, start, end, 'wind'),
				windDir: hourlyMean(s.date, start, end, 'wind_dir'),
				gusts: hourlyMean(s.date, start, end, 'gust'),
				rainEvening: hourlyMean(s.date, start, end, 'precip', 'sum'),
				rain24h: hourlyMean(s.date, start - 1440, start, 'precip', 'sum'),
				cloudEvening: hourlyMean(s.date, start, end, 'cloud'),
				pressure: hourlyMean(s.date, start, end, 'pressure'),
				sst: val(o?.oisst) ?? val(o?.crw_sst),
				sstAnom: val(o?.crw_anom),
				dhw: val(o?.crw_dhw),
				chl: chlByDay.get(s.date) ?? null,
				waveHeight: val(o?.wave_max),
				swellHeight: val(o?.swell_max),
				oni: val(climate.get(ymOf(s.date))?.oni),
				insituTemp: insitu.between(s.siteId, dayHour(s.date, start), dayHour(s.date, end))
			};
		}
		return {
			id: s.id,
			season: s.season,
			setNo: s.setNo,
			siteId: s.siteId,
			siteRaw: s.siteRaw,
			date: s.date,
			weekday: s.date ? weekday(s.date) : null,
			gear: s.gear,
			visit: s.visit,
			crewRaw: s.crewRaw,
			crewSize: s.crew.length || null,
			startMin: s.startMin,
			endMin: s.endMin,
			durationMin: s.durationMin,
			nCm,
			nNa,
			nNf: Math.max(s.nNf ?? 0, s.linked.Nf),
			nTotal,
			nLinked: linkedTotal,
			cpue: hours ? nTotal / hours : null,
			cpueCm: hours ? nCm / hours : null,
			cpueNa: hours ? nNa / hours : null,
			cpueSheet: s.cpueSheet,
			tideRaw: s.tideRaw,
			moonRaw: s.moonRaw,
			weatherRaw: s.weatherRaw,
			cloudCover: s.cloudCover,
			waterTemp: s.waterTemp,
			ph: s.ph,
			doMg: s.doMg,
			doPct: s.doPct,
			salinity: s.salinity,
			depthCm: s.depthCm,
			notes: s.notes,
			...env,
			sourceFile: s.ref.file,
			sourceSheet: s.ref.sheet,
			sourceRow: s.ref.row ?? null
		};
	});
	const setById = new Map(setRows.map((s) => [s.id!, s]));

	const captureRows: (typeof schema.captures.$inferInsert)[] = caps.map((c) => {
		let env: Partial<typeof schema.captures.$inferInsert> = {};
		if (c.date) {
			const sun = sunTimes(c.date);
			let t = c.captureMin;
			if (t != null && t < 6 * 60) t += 1440; // after midnight belongs to the evening set
			const set = c.setId ? setById.get(c.setId) : undefined;
			const moon = moonAt(c.date, t ?? 19 * 60);
			const o = ocean.get(c.date);
			env = {
				minAfterSunset: t != null ? t - sun.sunset : null,
				minAfterNetIn: t != null && set?.startMin != null ? t - set.startMin : null,
				tideMm: t != null ? tideAt(c.date, t) : null,
				tideTrend: t != null ? trendAt(c.date, t) : null,
				moonIllum: moon.fraction,
				moonPhase: moon.phase,
				sst: val(o?.oisst) ?? val(o?.crw_sst),
				dhw: val(o?.crw_dhw)
			};
		}
		return {
			id: c.id,
			season: c.season,
			species: c.species,
			siteId: c.siteId,
			siteRaw: c.siteRaw,
			setId: c.setId,
			setNo: c.setNo,
			date: c.date,
			sharkNo: c.sharkNo,
			captureNo: c.captureNo,
			kind: c.kind,
			tag: [...c.tags].sort((a, b) => tagRank(a) - tagRank(b))[0] ?? null,
			tags: c.tags.length ? JSON.stringify(c.tags) : null,
			individualId: c.individualId,
			sex: c.sex,
			ageClass: c.ageClass,
			umbilical: c.umbilical,
			uss: c.uss,
			pclMm: c.pclMm,
			flMm: c.flMm,
			tlMm: c.tlMm,
			pecGirthMm: c.pecGirthMm,
			dorsGirthMm: c.dorsGirthMm,
			caudGirthMm: c.caudGirthMm,
			massKg: c.massKg,
			clasperL: c.clasperL,
			clasperR: c.clasperR,
			captureMin: c.captureMin,
			landingMin: c.landingMin,
			releaseMin: c.releaseMin,
			workupMin: c.workupMin,
			toLab: c.toLab,
			died: c.died,
			blood: c.blood,
			dna: c.dna,
			usArea: c.usArea,
			usPerimeter: c.usPerimeter,
			habitat: c.habitat,
			tideRaw: c.tideRaw,
			notes: c.notes,
			lavage: c.lavage,
			stomach: c.stomach,
			stomachContents: c.stomachContents,
			...env,
			sourceFile: c.ref.file,
			sourceSheet: c.ref.sheet,
			sourceRow: c.ref.row ?? null
		};
	});

	// --- sites ----------------------------------------------------------------------------------
	const aliases = new Map<string, Set<string>>();
	for (const x of [...p.sets, ...p.captures])
		if (x.siteId && x.siteRaw) {
			const s = aliases.get(x.siteId) ?? new Set();
			s.add(x.siteRaw);
			aliases.set(x.siteId, s);
		}
	const gps = new Map(p.gps.map((g) => [g.siteId, g]));
	// The paper's dataset (#131) overrides the ranking workbook's values digitised from its Fig. 4.
	const dataset = pressureFromDataset(
		readCsv(opts.externalDir, 'pressure-bouyoucos2024.csv'),
		log,
		'external/pressure-bouyoucos2024.csv'
	);
	const pressure = new Map([...p.pressure, ...dataset].map((g) => [g.siteId, g]));
	const desc = new Map(p.descriptions.map((g) => [g.siteId, g]));
	const siteRows: (typeof schema.sites.$inferInsert)[] = SITE_DEFS.map((d) => {
		const g = gps.get(d.id);
		const pr = pressure.get(d.id);
		return {
			id: d.id,
			name: d.name,
			code: d.code ?? null,
			island: d.island,
			kind: d.kind,
			lat: g?.lat ?? d.lat ?? null,
			lon: g?.lon ?? d.lon ?? null,
			coordSource: g ? 'Logger GPS sheet' : d.lat != null ? 'uMap' : null,
			retired: g?.retired ?? null,
			fishingEffort: pr?.fishingEffort ?? null,
			humanImpact: pr?.humanImpact ?? null,
			artificialisation: pr?.artificialisation ?? null,
			pressureComposite: pr?.composite ?? null,
			pressureTier: pr?.tier ?? null,
			directions: desc.get(d.id)?.directions ?? null,
			habitat: desc.get(d.id)?.habitat ?? null,
			aliases: JSON.stringify([...(aliases.get(d.id) ?? [])].sort())
		};
	});

	// --- nursery water routes (#183) ------------------------------------------------------------
	const mooreaNurseries = siteRows
		.filter((s) => s.island === 'Moorea' && s.kind === 'nursery' && s.lat != null && s.lon != null)
		.map((s) => ({ id: s.id, lat: s.lat!, lon: s.lon! }));
	const routes = computeAllNurseryRoutes(mooreaNurseries);
	const routeRows: (typeof schema.nurseryRoutes.$inferInsert)[] = routes.map((r, i) => ({
		id: i + 1,
		fromId: r.fromId,
		toId: r.toId,
		km: r.km,
		straightKm: r.straightKm,
		coordinates: JSON.stringify(r.coordinates)
	}));

	// --- lab sharks: link to individuals -------------------------------------------------------
	const labRows: (typeof schema.labSharks.$inferInsert)[] = p.labSharks.map((l, i) => ({
		id: i + 1,
		season: l.season,
		sharkNo: l.sharkNo,
		tag: l.tags[0] ?? null,
		individualId: l.tags.map((t) => tagToIndividual.get(t)).find(Boolean) ?? null,
		species: l.species,
		sex: l.sex,
		siteId: l.siteId,
		arrivalDate: l.arrivalDate,
		releaseDate: l.releaseDate,
		days: l.days,
		arrTlMm: l.arrTlMm,
		arrFlMm: l.arrFlMm,
		arrMassKg: l.arrMassKg,
		relTlMm: l.relTlMm,
		relFlMm: l.relFlMm,
		relMassKg: l.relMassKg,
		tank: l.tank,
		project: l.project,
		died: l.died,
		notes: l.notes,
		sourceFile: l.ref.file,
		sourceSheet: l.ref.sheet,
		sourceRow: l.ref.row
	}));

	// --- field notes ----------------------------------------------------------------------------
	const notes: (typeof schema.fieldNotes.$inferInsert)[] = [];
	for (const s of setRows)
		if (s.notes)
			notes.push({
				season: s.season,
				date: s.date,
				siteId: s.siteId,
				kind: 'set',
				refId: s.id,
				text: s.notes
			});
	for (const s of setRows)
		if (s.weatherRaw && s.weatherRaw.length > 25)
			notes.push({
				season: s.season,
				date: s.date,
				siteId: s.siteId,
				kind: 'set',
				refId: s.id,
				text: s.weatherRaw
			});
	for (const c of captureRows)
		if (c.notes)
			notes.push({
				season: c.season,
				date: c.date,
				siteId: c.siteId,
				kind: 'capture',
				refId: c.id,
				species: c.species,
				text: c.notes
			});
	for (const l of labRows)
		if (l.notes)
			notes.push({
				season: l.season,
				date: l.arrivalDate,
				siteId: l.siteId,
				kind: 'lab',
				refId: l.id,
				species: l.species,
				text: l.notes
			});
	for (const h of p.hobo)
		if (h.notes)
			notes.push({
				season: h.season,
				date: h.deployed,
				siteId: h.siteId,
				kind: 'hobo',
				text: `Logger ${h.logger}: ${h.notes}`
			});
	p.adults.forEach((a, i) => {
		if (a.comments)
			notes.push({
				season: a.date ? seasonOf(a.date) : null,
				date: a.date,
				kind: 'adult',
				refId: i + 1,
				species: 'Cm',
				text: a.comments
			});
	});
	for (const e of p.adultEffort)
		if (e.comments)
			notes.push({
				season: e.date ? seasonOf(e.date) : null,
				date: e.date,
				kind: 'adult',
				text: e.comments
			});
	for (const pr of p.prey)
		notes.push({
			season: pr.season,
			date: pr.date,
			kind: 'prey',
			text: [pr.name, pr.size, pr.location, pr.notes].filter(Boolean).join(' · ')
		});

	// --- write ------------------------------------------------------------------------------------
	const sqlite = new Database(outPath);
	sqlite.pragma('journal_mode = OFF');
	sqlite.pragma('synchronous = OFF');
	for (const [, sql] of Object.entries(MIGRATIONS).sort(([a], [b]) => a.localeCompare(b))) {
		for (const stmt of sql.split('--> statement-breakpoint')) if (stmt.trim()) sqlite.exec(stmt);
	}
	const db = drizzle(sqlite, { schema });
	const insert = <T extends object>(table: Parameters<typeof db.insert>[0], rows: T[]) => {
		if (!rows.length) return;
		const cols = Object.keys(rows[0]).length || 1;
		const size = Math.max(1, Math.floor(30_000 / cols));
		for (let i = 0; i < rows.length; i += size)
			db.insert(table)
				.values(rows.slice(i, i + size) as never)
				.run();
	};

	const counts: Record<string, number> = {
		workbooks: p.files.filter((f) => !f.kind.startsWith('Temperature logger CSVs')).length,
		sets: setRows.length,
		captures: captureRows.length,
		individuals: individuals.length,
		labSharks: labRows.length,
		adultCaptures: p.adults.length,
		loggerFiles: insitu.files.length,
		loggerDays: insitu.daily.length,
		nurseryRoutes: routeRows.length
	};

	sqlite.transaction(() => {
		insert(schema.sites, siteRows);
		insert(schema.nurseryRoutes, routeRows);
		insert(schema.sets, setRows);
		insert(
			schema.setCrew,
			sets.flatMap((s) => s.crew.map((person) => ({ setId: s.id, person })))
		);
		insert(schema.captures, captureRows);
		insert(schema.individuals, individuals);
		insert(schema.labSharks, labRows);
		insert(schema.labWq, p.labWq);
		insert(schema.labFeeding, p.feeding);
		insert(schema.fieldWq, p.fieldWq);
		insert(schema.hobo, p.hobo);
		insert(schema.loggerFiles, insitu.files);
		insert(schema.loggerDaily, insitu.daily);
		insert(schema.loggerDiel, insitu.diel);
		insert(schema.blood, p.blood);
		insert(schema.mouth, p.mouth);
		insert(schema.prey, p.prey);
		insert(
			schema.adultCaptures,
			p.adults.map(({ ref, ...a }, i) => ({
				id: i + 1,
				...a,
				sourceFile: ref.file,
				sourceSheet: ref.sheet,
				sourceRow: ref.row
			}))
		);
		insert(
			schema.adultEffort,
			p.adultEffort.map((e) => ({ ...e, sharkTimes: JSON.stringify(e.sharkTimes) }))
		);
		insert(schema.adultSamples, p.adultSamples);
		insert(schema.fieldNotes, notes);
		insert(
			schema.weatherDaily,
			[...wDaily.values()].map((r) => ({
				date: r.date,
				tmax: val(r.tmax),
				tmin: val(r.tmin),
				tmean: val(r.tmean),
				precip: val(r.precip),
				windMax: val(r.wind_max),
				gustMax: val(r.gust_max),
				windDir: val(r.wind_dir),
				radiation: val(r.radiation),
				cloud: val(r.cloud),
				pressure: val(r.pressure),
				humidity: val(r.humidity),
				sunshineH: val(r.sunshine_h)
			}))
		);
		insert(
			schema.weatherHourly,
			[...wHourly.values()].map((r) => ({
				ts: r.ts,
				temp: val(r.temp),
				precip: val(r.precip),
				cloud: val(r.cloud),
				wind: val(r.wind),
				windDir: val(r.wind_dir),
				gust: val(r.gust),
				pressure: val(r.pressure)
			}))
		);
		insert(
			schema.oceanDaily,
			[...ocean.values()].map((r) => ({
				date: r.date,
				oisst: val(r.oisst),
				crwSst: val(r.crw_sst),
				crwAnom: val(r.crw_anom),
				crwHotspot: val(r.crw_hotspot),
				crwDhw: val(r.crw_dhw),
				crwBaa: val(r.crw_baa),
				waveMax: val(r.wave_max),
				wavePeriod: val(r.wave_period),
				waveDir: val(r.wave_dir),
				swellMax: val(r.swell_max)
			}))
		);
		insert(
			schema.chlorophyllWeekly,
			chlRows.map((r) => ({ date: r.date, chl: val(r.chl), pixels: val(r.pixels) ?? 0 }))
		);
		insert(
			schema.tideHourly,
			tidePts.map((pt) => ({
				ts: new Date(pt.t * 3_600_000).toISOString().slice(0, 13),
				mm: pt.mm
			}))
		);
		insert(schema.tideExtrema, extrema);
		insert(
			schema.climateMonthly,
			[...climate.values()].map((r) => ({ ym: r.ym, oni: val(r.oni), soi: val(r.soi) }))
		);
		insert(
			schema.cyclonePoints,
			cyclones
				.filter((r) => r.sid && r.time && val(r.lat) != null && val(r.dist_km) != null)
				.map((r) => ({
					sid: r.sid,
					name: r.name || 'UNNAMED',
					ts: r.time,
					lat: val(r.lat)!,
					lon: val(r.lon)!,
					windKt: val(r.wind_kt),
					presHpa: val(r.pres_hpa),
					distKm: val(r.dist_km)!
				}))
		);
		insert(
			schema.schoolHolidays,
			school
				.filter((r) => r.start && r.end)
				.map((r) => ({
					schoolYear: r.school_year,
					name: r.name,
					start: r.start,
					end: r.end,
					source: r.source
				}))
		);
		insert(schema.dataIssues, log.items);
		const metaRows = {
			hash,
			importer_version: IMPORTER_VERSION,
			imported_at: new Date().toISOString(),
			files: JSON.stringify(p.files),
			counts: JSON.stringify(counts),
			external: JSON.stringify({
				weather: [...wDaily.keys()].sort().at(-1) ?? null,
				ocean: [...ocean.keys()].sort().at(-1) ?? null,
				chlorophyll: chlRows.at(-1)?.date ?? null,
				tide: tidePts.length
					? new Date(tidePts[tidePts.length - 1].t * 3_600_000).toISOString().slice(0, 10)
					: null,
				climate: [...climate.keys()].sort().at(-1) ?? null
			})
		};
		insert(
			schema.meta,
			Object.entries(metaRows).map(([key, value]) => ({ key, value }))
		);
	})();
	sqlite.close();
	return { hash, durationMs: Math.round(performance.now() - t0), counts, issues: log.items.length };
}
