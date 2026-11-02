/**
 * Secondary sheets (#4): lab sharks, tank and field water quality, feeding, HOBO deployments,
 * blood chemistry, mouth gape, prey and the 2014-15 site descriptions.
 */
import { cell, findHeader, mapColumns, type Matcher } from './columns';
import type { IssueLog } from './issues';
import {
	dateOf,
	headerKey,
	int,
	num,
	sexOf,
	speciesOf,
	str,
	tagsOf,
	text,
	timeOf,
	type SpeciesCode
} from './normalize';
import { resolveSite } from './sites';
import { ExcelDate, type Sheet } from './xlsx';

const eq = (...names: string[]): Matcher => (k: string) => names.includes(k);

export type SheetKind =
	| 'lab_sharks'
	| 'lab_diff'
	| 'lab_wq'
	| 'feeding'
	| 'field_wq'
	| 'site_salinity'
	| 'hobo'
	| 'blood'
	| 'mouth'
	| 'prey'
	| 'adult_samples'
	| 'location_names';

export function extraSheetKind(name: string): SheetKind | null {
	const n = name.trim().toLowerCase();
	if (n === 'lab log diff.' || n === 'lab log diff') return 'lab_diff';
	if (n === 'lab sharks' || n === 'lab log') return 'lab_sharks';
	if (n === 'lab wq' || n === 'lab water quality' || n.startsWith('tank log')) return 'lab_wq';
	if (n === 'lab shark feeding') return 'feeding';
	if (n === 'field wq') return 'field_wq';
	if (n === 'site salinity') return 'site_salinity';
	if (n === 'hobo log') return 'hobo';
	if (n === 'blood analysis') return 'blood';
	if (n === 'mouth') return 'mouth';
	if (n === 'prey species') return 'prey';
	if (n === 'cm log adult') return 'adult_samples';
	if (n === 'location name') return 'location_names';
	return null;
}

export interface LabShark {
	season: string;
	sharkNo: string | null;
	tags: string[];
	species: SpeciesCode | null;
	sex: 'M' | 'F' | null;
	siteId: string | null;
	arrivalDate: string | null;
	releaseDate: string | null;
	days: number | null;
	arrTlMm: number | null;
	arrFlMm: number | null;
	arrMassKg: number | null;
	relTlMm: number | null;
	relFlMm: number | null;
	relMassKg: number | null;
	tank: string | null;
	project: string | null;
	died: number | null;
	notes: string | null;
	ref: { file: string; sheet: string; row: number };
}

const LAB_SPEC = {
	arrival: [eq('arrival date', 'capture')],
	sharkNo: [eq('shark no', 'shark')],
	externalTag: [eq('external tag', 'tag no')],
	pit: [eq('pit tag')],
	species: [eq('spp')],
	sex: [eq('sex')],
	site: [eq('site')],
	fl: [/^fl\b/],
	tl: [/^tl\b/],
	mass: [/^mass kg/, /^mass kg at arrival/],
	tank: [eq('tank', 'current tank')],
	project: [eq('project')],
	days: [/^days/],
	notes: [eq('notes')]
} satisfies Record<string, Matcher[]>;

export function parseLabSharks(sheet: Sheet, season: string, file: string): LabShark[] {
	const header = sheet.rows[0].cells;
	const releaseIdx = findHeader(header, /^release( date)?$/);
	const arr = mapColumns(header, LAB_SPEC, 0, releaseIdx >= 0 ? releaseIdx : header.length);
	const rel =
		releaseIdx >= 0
			? mapColumns(header, { fl: [/^fl\b/], tl: [/^tl\b/], mass: [/^mass kg/], days: [/^days/], notes: [eq('notes')] }, releaseIdx + 1)
			: {};
	const out: LabShark[] = [];
	for (const { r, cells } of sheet.rows.slice(1)) {
		const arrivalDate = dateOf(cell(cells, arr.arrival));
		const sharkNo = str(cell(cells, arr.sharkNo));
		if (!arrivalDate && !sharkNo) continue;
		const releaseCell = releaseIdx >= 0 ? cells[releaseIdx] : null;
		const releaseDate = dateOf(releaseCell);
		const notes = [text(cell(cells, arr.notes)), text(cell(cells, rel.notes)), releaseDate ? null : text(releaseCell)]
			.filter(Boolean)
			.join('; ');
		let days = num(cell(cells, rel.days)) ?? num(cell(cells, arr.days));
		if (days == null && arrivalDate && releaseDate)
			days = Math.round((Date.parse(releaseDate) - Date.parse(arrivalDate)) / 86_400_000);
		const scale = (v: number | null) => (v != null && v < 150 ? v * 10 : v);
		out.push({
			season,
			sharkNo,
			tags: [...tagsOf(cell(cells, arr.pit)), ...tagsOf(cell(cells, arr.externalTag))],
			species: speciesOf(cell(cells, arr.species)) ?? (sharkNo?.match(/^(cm|na)/i) ? speciesOf(sharkNo.slice(0, 2)) : null),
			sex: sexOf(cell(cells, arr.sex)),
			siteId: resolveSite(str(cell(cells, arr.site))),
			arrivalDate,
			releaseDate,
			days,
			arrTlMm: scale(num(cell(cells, arr.tl))),
			arrFlMm: scale(num(cell(cells, arr.fl))),
			arrMassKg: num(cell(cells, arr.mass)),
			relTlMm: scale(num(cell(cells, rel.tl))),
			relFlMm: scale(num(cell(cells, rel.fl))),
			relMassKg: num(cell(cells, rel.mass)),
			tank: str(cell(cells, arr.tank)),
			project: str(cell(cells, arr.project)),
			died: /died|dead|deceased|d[ée]c[èe]s/i.test(notes) ? 1 : null,
			notes: notes || null,
			ref: { file, sheet: sheet.name, row: r }
		});
	}
	return out;
}

/** 2016-17 "Lab Log Diff.": Pre-lab row followed by a Post-lab row for the same shark. */
export function parseLabDiff(sheet: Sheet, season: string, file: string): LabShark[] {
	const header = sheet.rows[0].cells;
	const c = mapColumns(header, {
		phase: [eq('time')],
		site: [eq('site')],
		date: [eq('date')],
		sharkNo: [eq('shark no')],
		tag: [eq('tag no')],
		species: [eq('spp')],
		sex: [eq('sex')],
		fl: [/^fl\b/],
		tl: [/^tl\b/],
		mass: [/^mass kg/],
		tank: [eq('tank #', 'tank')]
	});
	const out: LabShark[] = [];
	let pre: LabShark | null = null;
	for (const { r, cells } of sheet.rows.slice(1)) {
		const phase = str(cell(cells, c.phase))?.toLowerCase() ?? '';
		if (phase.startsWith('pre')) {
			pre = {
				season,
				sharkNo: str(cell(cells, c.sharkNo)),
				tags: tagsOf(cell(cells, c.tag)),
				species: speciesOf(cell(cells, c.species)),
				sex: sexOf(cell(cells, c.sex)),
				siteId: resolveSite(str(cell(cells, c.site))),
				arrivalDate: dateOf(cell(cells, c.date)),
				releaseDate: null,
				days: null,
				arrTlMm: num(cell(cells, c.tl)),
				arrFlMm: num(cell(cells, c.fl)),
				arrMassKg: num(cell(cells, c.mass)),
				relTlMm: null,
				relFlMm: null,
				relMassKg: null,
				tank: str(cell(cells, c.tank)),
				project: null,
				died: null,
				notes: null,
				ref: { file, sheet: sheet.name, row: r }
			};
			out.push(pre);
		} else if (phase.startsWith('post') && pre) {
			pre.relTlMm = num(cell(cells, c.tl));
			pre.relFlMm = num(cell(cells, c.fl));
			pre.relMassKg = num(cell(cells, c.mass));
			pre = null;
		}
	}
	return out;
}

export interface LabWqRow {
	season: string;
	date: string | null;
	timeMin: number | null;
	tank: string | null;
	temp: number | null;
	ph: number | null;
	doMg: number | null;
	doPct: number | null;
	salinity: number | null;
	recorder: string | null;
	notes: string | null;
}

export function parseLabWq(sheet: Sheet, season: string): LabWqRow[] {
	const header = sheet.rows[0].cells;
	const c = mapColumns(header, {
		date: [eq('date')],
		time: [eq('time')],
		tank: [eq('tank', 'tank #')],
		ph: [eq('ph')],
		temp: [eq('temp c', 't c')],
		doMg: [eq('d o mg l 1', 'do')],
		doPct: [eq('d o %', 'sat', 'do%', 'do %')],
		sal: [/^sal/],
		recorder: [eq('recorder')],
		notes: [eq('notes', 'comments')]
	});
	const out: LabWqRow[] = [];
	let lastDate: string | null = null;
	for (const { cells } of sheet.rows.slice(1)) {
		const d = dateOf(cell(cells, c.date));
		if (d) lastDate = d;
		const row: LabWqRow = {
			season,
			date: d ?? lastDate,
			timeMin: timeOf(cell(cells, c.time)),
			tank: str(cell(cells, c.tank)),
			temp: num(cell(cells, c.temp)),
			ph: num(cell(cells, c.ph)),
			doMg: num(cell(cells, c.doMg)),
			doPct: num(cell(cells, c.doPct)),
			salinity: num(cell(cells, c.sal)),
			recorder: str(cell(cells, c.recorder)),
			notes: text(cell(cells, c.notes))
		};
		if (row.temp == null && row.ph == null && row.doMg == null && row.doPct == null && row.salinity == null) continue;
		// Plausibility: drop sensor typos that would wreck the charts.
		if (row.temp != null && (row.temp < 15 || row.temp > 40)) row.temp = null;
		if (row.ph != null && (row.ph < 6 || row.ph > 9.5)) row.ph = null;
		if (row.doPct != null && row.doPct > 200) row.doPct = null;
		out.push(row);
	}
	return out;
}

export interface FeedingRow {
	season: string;
	date: string | null;
	tank: string | null;
	shark: string | null;
	tag: string | null;
	foodG: number | null;
	rejectedG: number | null;
	pct: number | null;
	notes: string | null;
}

export function parseFeeding(sheet: Sheet, season: string): FeedingRow[] {
	const header = sheet.rows[0].cells;
	const c = mapColumns(header, {
		tank: [eq('tank')],
		tag: [eq('shark id')],
		shark: [eq('shark #')],
		date: [eq('date of feeding')],
		food: [/^food given/],
		rejected: [/^food rejected/],
		pct: [/^percentage/],
		notes: [eq('notes')]
	});
	const out: FeedingRow[] = [];
	for (const { cells } of sheet.rows.slice(1)) {
		const date = dateOf(cell(cells, c.date));
		if (!date) continue;
		const food = num(cell(cells, c.food));
		const rejected = num(cell(cells, c.rejected));
		let pct = num(cell(cells, c.pct));
		if (pct == null && food) pct = ((food - (rejected ?? 0)) / food) * 100;
		out.push({
			season,
			date,
			tank: str(cell(cells, c.tank)),
			shark: str(cell(cells, c.shark)),
			tag: tagsOf(cell(cells, c.tag))[0] ?? null,
			foodG: food,
			rejectedG: rejected,
			pct,
			notes: text(cell(cells, c.notes))
		});
	}
	return out;
}

export interface FieldWqRow {
	season: string;
	date: string | null;
	siteId: string | null;
	timeMin: number | null;
	depthCm: number | null;
	salinity: number | null;
	doMg: number | null;
	doPct: number | null;
	temp: number | null;
	ph: number | null;
	source: string;
}

export function parseFieldWq(sheet: Sheet, season: string): FieldWqRow[] {
	const header = sheet.rows[0].cells;
	const c = mapColumns(header, {
		date: [eq('date')],
		site: [eq('site')],
		time: [eq('time')],
		depth: [eq('depth')],
		sal: [eq('sal')],
		doMg: [eq('do')],
		sat: [eq('sat')],
		temp: [eq('temp')],
		ph: [eq('ph')]
	});
	const out: FieldWqRow[] = [];
	let date: string | null = null;
	let site: string | null = null;
	let time: number | null = null;
	for (const { cells } of sheet.rows.slice(1)) {
		const d = dateOf(cell(cells, c.date));
		if (d) date = d;
		const s = resolveSite(str(cell(cells, c.site)));
		if (s) {
			site = s;
			time = null;
		}
		time = timeOf(cell(cells, c.time)) ?? time;
		const row: FieldWqRow = {
			season,
			date,
			siteId: site,
			timeMin: time,
			depthCm: num(cell(cells, c.depth)),
			salinity: num(cell(cells, c.sal)),
			doMg: num(cell(cells, c.doMg)),
			doPct: num(cell(cells, c.sat)),
			temp: num(cell(cells, c.temp)),
			ph: num(cell(cells, c.ph)),
			source: 'field_wq'
		};
		if (row.temp == null && row.salinity == null && row.doMg == null && row.ph == null) continue;
		out.push(row);
	}
	return out;
}

export function parseSiteSalinity(sheet: Sheet, season: string): FieldWqRow[] {
	const out: FieldWqRow[] = [];
	for (const { cells } of sheet.rows.slice(1)) {
		const siteId = resolveSite(str(cells[0]));
		const sal = num(cells[2]);
		if (!siteId || sal == null) continue;
		const depth = str(cells[1])?.toLowerCase();
		out.push({
			season,
			date: null,
			siteId,
			timeMin: null,
			depthCm: depth === 'shallow' ? 20 : depth === 'deep' ? 60 : null,
			salinity: sal,
			doMg: null,
			doPct: null,
			temp: null,
			ph: null,
			source: 'site_salinity'
		});
	}
	return out;
}

export interface HoboRow {
	season: string;
	siteId: string | null;
	siteRaw: string | null;
	logger: string | null;
	deployed: string | null;
	retrieved: string | null;
	status: string | null;
	notes: string | null;
}

/**
 * HOBO logs are wide, repeating Deployed / Checked / Retrieved blocks. Reduce each row to the
 * first deployment date, the last check/retrieval date, the last status and all comments.
 */
export function parseHobo(sheet: Sheet, season: string): HoboRow[] {
	const header = sheet.rows[0].cells.map((h) => headerKey(h));
	const out: HoboRow[] = [];
	let site: string | null = null;
	const blockStarts = header.map((h, i) => (h === 'site' ? i : -1)).filter((i) => i >= 0);
	const blocks = blockStarts.length ? blockStarts : [0];
	for (const { cells } of sheet.rows.slice(1)) {
		blocks.forEach((start, bi) => {
			const end = blocks[bi + 1] ?? header.length;
			const rawSite = str(cells[start]);
			if (rawSite) site = rawSite;
			const logger = str(cells[start + 1]);
			if (!logger) return;
			let deployed: string | null = null;
			let retrieved: string | null = null;
			let status: string | null = null;
			const notes: string[] = [];
			for (let i = start + 2; i < end; i++) {
				const h = header[i] ?? '';
				const v = cells[i];
				if (v == null) continue;
				const d = v instanceof ExcelDate ? dateOf(v) : null;
				if (/deployed/.test(h) && d) deployed ??= d;
				else if (/retr|checked|retired/.test(h) && d) retrieved = d;
				else if (/status/.test(h)) status = str(v);
				else if (/comment|notes/.test(h) && text(v)) notes.push(text(v)!);
			}
			out.push({
				season,
				siteId: resolveSite(site),
				siteRaw: site,
				logger,
				deployed,
				retrieved,
				status,
				notes: notes.join('; ') || null
			});
		});
	}
	return out;
}

export interface BloodRow {
	season: string;
	siteId: string | null;
	date: string | null;
	species: SpeciesCode | null;
	experiment: string | null;
	sharkNo: string | null;
	hct: number | null;
	hb: number | null;
	cholesterol: number | null;
	ffa: number | null;
	triglycerides: number | null;
}

export function parseBlood(sheet: Sheet, season: string): BloodRow[] {
	// Row 1 holds group labels; the real header is row 2.
	const headerRow = sheet.rows.find((r) => findHeader(r.cells, /^hematocrite/) >= 0);
	if (!headerRow) return [];
	const header = headerRow.cells;
	const c = mapColumns(header, {
		site: [eq('site')],
		date: [/^date/],
		species: [eq('sp')],
		experiment: [/^experiment/],
		shark: [eq('shark #')],
		hct: [eq('hematocrite %')],
		hb: [eq('hemoglobin %')],
		chol: [/^cholesterol value/],
		ffa: [/^free fatty acid value/],
		tg: [/^triglyceride value/]
	});
	const out: BloodRow[] = [];
	for (const { cells } of sheet.rows.filter((r) => r.r > headerRow.r)) {
		const date = dateOf(cell(cells, c.date));
		const hct = num(cell(cells, c.hct));
		if (!date && hct == null) continue;
		out.push({
			season,
			siteId: resolveSite(str(cell(cells, c.site))),
			date,
			species: speciesOf(cell(cells, c.species)),
			experiment: str(cell(cells, c.experiment)),
			sharkNo: str(cell(cells, c.shark)),
			hct,
			hb: num(cell(cells, c.hb)),
			cholesterol: num(cell(cells, c.chol)),
			ffa: num(cell(cells, c.ffa)),
			triglycerides: num(cell(cells, c.tg))
		});
	}
	return out;
}

export interface MouthRow {
	season: string;
	sharkNo: string | null;
	siteId: string | null;
	tag: string | null;
	species: SpeciesCode | null;
	sex: 'M' | 'F' | null;
	mol: number | null;
	mow: number | null;
}

export function parseMouth(sheet: Sheet, season: string): MouthRow[] {
	return sheet.rows.slice(1).map(({ cells }) => ({
		season,
		sharkNo: str(cells[0]),
		siteId: resolveSite(str(cells[1])),
		tag: tagsOf(cells[2])[0] ?? null,
		species: speciesOf(cells[3]),
		sex: sexOf(cells[4]),
		mol: num(cells[5]),
		mow: num(cells[6])
	}));
}

export interface PreyRow {
	season: string;
	date: string | null;
	location: string | null;
	name: string | null;
	size: string | null;
	notes: string | null;
}

export function parsePrey(sheet: Sheet, season: string): PreyRow[] {
	return sheet.rows
		.slice(1)
		.map(({ cells }) => ({
			season,
			date: dateOf(cells[2]),
			location: str(cells[1]),
			name: str(cells[3]),
			size: str(cells[4]),
			notes: text(cells[8])
		}))
		.filter((p) => p.name);
}

export interface AdultSampleRow {
	sample: string | null;
	sizeCm: number | null;
	sex: 'M' | 'F' | null;
	island: string | null;
	location: string | null;
	year: number | null;
	notes: string | null;
}

export function parseAdultSamples(sheet: Sheet): AdultSampleRow[] {
	return sheet.rows
		.slice(1)
		.map(({ cells }) => ({
			sample: str(cells[0]),
			sizeCm: num(cells[2]),
			sex: sexOf(cells[3]),
			island: str(cells[4]),
			location: str(cells[5]),
			year: int(cells[7]),
			notes: text(cells[8])
		}))
		.filter((s) => s.sample);
}

export interface SiteDescription {
	siteId: string;
	directions: string | null;
	habitat: string | null;
}

/** 2014-15 "Location name": directions and habitat notes (in French) per nursery. */
export function parseLocationNames(sheet: Sheet, log: IssueLog): SiteDescription[] {
	const out: SiteDescription[] = [];
	for (const { cells } of sheet.rows.slice(1)) {
		const siteId = resolveSite(str(cells[1]));
		if (!siteId) {
			if (str(cells[1])) log.add('info', 'sites', `Site description for unknown site "${str(cells[1])}"`);
			continue;
		}
		out.push({ siteId, directions: text(cells[3]), habitat: text(cells[4]) });
	}
	return out;
}
