/**
 * Nursery shark logs and set logs (#2, #3). One parser per sheet *kind*, driven by header
 * aliases, so new seasons with slightly different headers keep working.
 */
import { cell, findHeader, mapColumns, type Matcher } from './columns';
import { parseCrew } from './crew';
import type { IssueLog, SourceRef } from './issues';
import {
	ageClassOf,
	dateOf,
	durationOf,
	fixSeasonYear,
	int,
	isBlank,
	num,
	sexOf,
	speciesOf,
	str,
	tagsOf,
	text,
	timeOf,
	umbilicalFromNotes,
	umbilicalFromStage,
	umbilicalOf,
	yesNo,
	type AgeClass,
	type SpeciesCode
} from './normalize';
import { resolveSite } from './sites';
import type { CellValue, Sheet } from './xlsx';

export interface RawCapture {
	season: string;
	species: SpeciesCode;
	siteRaw: string | null;
	siteId: string | null;
	setNo: number | null;
	date: string | null;
	sharkNo: string | null;
	captureNo: number | null;
	kind: 'field' | 'hook' | 'lab_release';
	tags: string[];
	sex: 'M' | 'F' | null;
	ageClass: AgeClass | null;
	umbilical: 'open' | 'semi' | 'closed' | null;
	uss: number | null;
	pclMm: number | null;
	flMm: number | null;
	tlMm: number | null;
	pecGirthMm: number | null;
	dorsGirthMm: number | null;
	caudGirthMm: number | null;
	massKg: number | null;
	clasperL: number | null;
	clasperR: number | null;
	captureMin: number | null;
	landingMin: number | null;
	releaseMin: number | null;
	workupMin: number | null;
	toLab: number | null;
	died: number | null;
	blood: number | null;
	dna: number | null;
	usArea: number | null;
	usPerimeter: number | null;
	habitat: string | null;
	tideRaw: string | null;
	notes: string | null;
	/** Grouping key from a "Recaptures" sheet (2013-15) used to link untagged captures. */
	group?: string;
	ref: SourceRef;
}

export interface RawSet {
	season: string;
	setNo: number | null;
	siteRaw: string | null;
	siteId: string | null;
	date: string | null;
	gear: string;
	visit: number | null;
	crewRaw: string | null;
	crew: string[];
	startMin: number | null;
	endMin: number | null;
	durationMin: number | null;
	nCm: number | null;
	nNa: number | null;
	nNf: number | null;
	nTotal: number | null;
	cpueSheet: number | null;
	tideRaw: string | null;
	moonRaw: string | null;
	weatherRaw: string | null;
	cloudCover: number | null;
	waterTemp: number | null;
	ph: number | null;
	doMg: number | null;
	doPct: number | null;
	salinity: number | null;
	depthCm: number | null;
	notes: string | null;
	ref: SourceRef;
}

const eq =
	(...names: string[]): Matcher =>
	(k: string) =>
		names.includes(k);

const CAPTURE_SPEC = {
	site: [eq('site', 'location')],
	setNo: [eq('set', 'set no')],
	date: [eq('date', 'date of catch', 'date of capture')],
	sharkNo: [eq('shark no', 'shark n', 'shark n°', 'shark #')],
	captureNo: [eq('capture no', 'shark capture #', 'catch n', 'catch')],
	tag: [eq('tag no', 'tag #', 'tag', 'pit tag')],
	species: [eq('spp', 'sp', 'species')],
	sex: [eq('sex')],
	age: [eq('age', 'age class', 'stage')],
	uss: [eq('uss')],
	us: [eq('us', 'us open closed')],
	usArea: [/^us area/],
	usPerimeter: [/^us perimeter/],
	pcl: [/^pcl\b/],
	fl: [/^fl\b/],
	tl: [/^tl\b/],
	pec: [/^pec girth/, /^pg\b/],
	dors: [/^dors girth/, /^dg\b/],
	caud: [/^caud girth/, /^cg\b/],
	mass: [/^mass\b/, /^total weight/],
	clasperL: [/^left inner clasper/],
	clasperR: [/^right inner clasper/],
	clasper: [eq('clasper')],
	landing: [/^land(ing)? time/],
	release: [/^release time/],
	workup: [/^work ?up time/],
	capture: [eq('capture time', 'time')],
	blood: [/^blood/],
	dna: [/^dna\b/, /^fin clip y n/, /^fin clip genetics/],
	habitat: [eq('habitat')],
	tide: [eq('tide')],
	notes: [eq('notes', 'notes s', 'comments', 'comment')],
	recapPrev: [/^recap from previous year/],
	stomach: [/^stomach content/, /^lavage contents/]
} satisfies Record<string, Matcher[]>;

/** Does this sheet hold shark captures (and not lab/set/HOBO/PIT logs)? */
export function isCaptureSheet(sheet: Sheet): boolean {
	const n = sheet.name.trim().toLowerCase();
	if (/lab|hobo|set log|boat|pit log|adult|physioshark|recapture|sampling|mouth|feeding/.test(n))
		return false;
	if (!/log|catch data|nurse/.test(n)) return false;
	const header = sheet.rows[0]?.cells ?? [];
	return findHeader(header, /^(fl|tl)\b/) >= 0 && findHeader(header, /^sex$/) >= 0;
}

function speciesFromSheetName(name: string): SpeciesCode | null {
	const n = name.trim().toLowerCase();
	if (/^cm|catch data cm/.test(n)) return 'Cm';
	if (/^na|catch data na/.test(n)) return 'Na';
	if (/^nf|^nurse|^gf/.test(n)) return 'Nf'; // 'GF Log Juv' is tawny nurse sharks (#12)
	return null;
}

const median = (xs: number[]) => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};

/** Bring a sheet's lengths/girths/claspers to mm when the sheet was recorded in cm. */
function harmoniseUnits(rows: RawCapture[], log: IssueLog, ref: SourceRef) {
	const lengths = rows.map((r) => r.tlMm ?? r.flMm).filter((v): v is number => v != null);
	const tlMed = median(lengths);
	if (tlMed != null && tlMed < 150) {
		for (const r of rows) {
			if (r.pclMm != null) r.pclMm *= 10;
			if (r.flMm != null) r.flMm *= 10;
			if (r.tlMm != null) r.tlMm *= 10;
		}
		log.add('info', 'units', `Lengths recorded in cm (median ${tlMed}); converted to mm`, ref);
	} else {
		// Individual cm values inside an mm sheet (e.g. 42.2 among 470s).
		for (const r of rows) {
			for (const f of ['pclMm', 'flMm', 'tlMm'] as const) {
				const v = r[f];
				if (v != null && v > 20 && v < 150) {
					r[f] = v * 10;
					log.add('warning', 'units', `${f} ${v} looks like cm in an mm sheet; ×10`, r.ref, f, v);
				}
			}
		}
	}
	const girths = rows.map((r) => r.pecGirthMm).filter((v): v is number => v != null);
	const gMed = median(girths);
	if (gMed != null && gMed < 60) {
		for (const r of rows) {
			if (r.pecGirthMm != null) r.pecGirthMm *= 10;
			if (r.dorsGirthMm != null) r.dorsGirthMm *= 10;
			if (r.caudGirthMm != null) r.caudGirthMm *= 10;
		}
		log.add('info', 'units', `Girths recorded in cm (median ${gMed}); converted to mm`, ref);
	}
	const claspers = rows
		.flatMap((r) => [r.clasperL, r.clasperR])
		.filter((v): v is number => v != null);
	const cMed = median(claspers);
	if (cMed != null && cMed < 12) {
		for (const r of rows) {
			if (r.clasperL != null) r.clasperL *= 10;
			if (r.clasperR != null) r.clasperR *= 10;
		}
		log.add(
			'info',
			'units',
			`Clasper lengths recorded in cm (median ${cMed}); converted to mm`,
			ref
		);
	}
	for (const r of rows) {
		if (r.massKg != null && r.massKg > 40 && (r.tlMm ?? 0) < 1200) {
			log.add(
				'warning',
				'units',
				`Mass ${r.massKg} looks like grams; ÷1000`,
				r.ref,
				'mass',
				r.massKg
			);
			r.massKg /= 1000;
		}
	}
}

/** Sanity checks that never change values, only report them. */
function checkCapture(r: RawCapture, log: IssueLog) {
	if (r.tlMm != null && r.flMm != null && r.tlMm < r.flMm)
		log.add(
			'warning',
			'morphometrics',
			`TL (${r.tlMm}) shorter than FL (${r.flMm})`,
			r.ref,
			'TL',
			r.tlMm
		);
	if (r.flMm != null && r.pclMm != null && r.flMm < r.pclMm)
		log.add(
			'warning',
			'morphometrics',
			`FL (${r.flMm}) shorter than PCL (${r.pclMm})`,
			r.ref,
			'FL',
			r.flMm
		);
	if (r.kind === 'field' && r.tlMm != null && (r.tlMm < 300 || r.tlMm > 2200))
		log.add('warning', 'morphometrics', `Unusual TL ${r.tlMm} mm`, r.ref, 'TL', r.tlMm);
	if (r.massKg != null && r.tlMm != null && r.tlMm < 1000) {
		const expected = 3.2e-9 * r.tlMm ** 3.1;
		if (r.massKg > expected * 2.2 || r.massKg < expected / 2.2)
			log.add(
				'warning',
				'morphometrics',
				`Mass ${r.massKg} kg unusual for TL ${r.tlMm} mm`,
				r.ref,
				'mass',
				r.massKg
			);
	}
}

export function parseCaptureSheet(
	sheet: Sheet,
	season: string,
	file: string,
	log: IssueLog
): RawCapture[] {
	const header = sheet.rows[0].cells;
	// 2015-16 carries recaptures as extra column blocks: "1st Recap Site", "2nd Recap Site", …
	const recapStarts: number[] = [];
	header.forEach((_, i) => {
		if (
			/^\d+(st|nd|rd|th) recap site$/.test(
				String(header[i] ?? '')
					.trim()
					.toLowerCase()
					.replace(/\s+/g, ' ')
			)
		)
			recapStarts.push(i);
	});
	const mainEnd = recapStarts[0] ?? header.length;
	const cols = mapColumns(header, CAPTURE_SPEC, 0, mainEnd);
	if (cols.date == null) {
		// 2016-17 stores the date column's header as a date value; anything date-like counts.
		const i = header.findIndex((h) => h != null && typeof h === 'object');
		if (i >= 0) cols.date = i;
	}
	const sheetSpecies = speciesFromSheetName(sheet.name);
	const out: RawCapture[] = [];

	const build = (
		row: CellValue[],
		r: number,
		c: Partial<Record<keyof typeof CAPTURE_SPEC, number>>,
		inherit?: RawCapture,
		captureNo?: number
	): RawCapture | null => {
		const ref = { file, sheet: sheet.name, row: r };
		let date = dateOf(cell(row, c.date));
		if (date) {
			const fixed = fixSeasonYear(date, season);
			if (fixed.fixed) {
				log.add(
					'warning',
					'dates',
					`Date ${date} outside season ${season}; read as ${fixed.date}`,
					ref,
					'date',
					date
				);
				date = fixed.date;
			}
		}
		const tl = num(cell(row, c.tl));
		const fl = num(cell(row, c.fl));
		if (!inherit && !date && tl == null && fl == null) return null;
		if (inherit && !date && tl == null && fl == null && cell(row, c.site) == null) return null;
		const siteRaw = str(cell(row, c.site)) ?? inherit?.siteRaw ?? null;
		const species =
			sheetSpecies ?? speciesOf(cell(row, c.species)) ?? inherit?.species ?? 'Unknown';
		const notes = text(cell(row, c.notes));
		const usStage = int(cell(row, c.uss));
		const usArea = num(cell(row, c.usArea));
		let umbilical =
			umbilicalOf(cell(row, c.us)) ?? umbilicalFromStage(usStage) ?? umbilicalFromNotes(notes);
		if (!umbilical && usArea != null) umbilical = usArea > 0 ? 'open' : 'closed';
		const clasper = num(cell(row, c.clasper));
		const releaseCell = cell(row, c.release);
		const releaseText = str(releaseCell)?.toLowerCase() ?? '';
		const tagCell = cell(row, c.tag);
		const tags = tagsOf(tagCell);
		const ageCell = cell(row, c.age);
		const capNoRaw = cell(row, c.captureNo);
		const capNoText = str(capNoRaw)?.toLowerCase() ?? '';
		let kind: RawCapture['kind'] = 'field';
		const siteId = resolveSite(siteRaw);
		const habitat = text(cell(row, c.habitat));
		const age = ageClassOf(ageCell);
		if (siteId === 'lab' || capNoText.includes('release lab')) kind = 'lab_release';
		else if (
			age === 'adult' ||
			(habitat && !/nursery/i.test(habitat)) ||
			['chez-stephan', 'taotoi', 'ray-feeding', 'tiahura'].includes(siteId ?? '')
		)
			kind = 'hook';
		const notesLower = (notes ?? '').toLowerCase();
		const rec: RawCapture = {
			season,
			species,
			siteRaw,
			siteId,
			setNo: int(cell(row, c.setNo)) ?? inherit?.setNo ?? null,
			date,
			sharkNo: str(cell(row, c.sharkNo)) ?? inherit?.sharkNo ?? null,
			captureNo: captureNo ?? int(capNoRaw),
			kind,
			tags: tags.length ? tags : (inherit?.tags ?? []),
			sex: sexOf(cell(row, c.sex)) ?? inherit?.sex ?? null,
			ageClass: age,
			umbilical,
			uss: usStage,
			pclMm: num(cell(row, c.pcl)),
			flMm: fl,
			tlMm: tl,
			pecGirthMm: num(cell(row, c.pec)),
			dorsGirthMm: num(cell(row, c.dors)),
			caudGirthMm: num(cell(row, c.caud)),
			massKg: num(cell(row, c.mass)),
			clasperL: num(cell(row, c.clasperL)) ?? clasper,
			clasperR: num(cell(row, c.clasperR)) ?? clasper,
			captureMin: timeOf(cell(row, c.capture)),
			landingMin: timeOf(cell(row, c.landing)),
			releaseMin: timeOf(releaseCell),
			workupMin: durationOf(cell(row, c.workup)),
			toLab:
				releaseText.includes('lab') || /brought to criobe|to the lab|collection/.test(notesLower)
					? 1
					: null,
			died: /\b(died|dead|death|deceased|d[ée]c[èe]s|mort)\b/.test(notesLower) ? 1 : null,
			blood: yesNo(cell(row, c.blood)),
			dna: yesNo(cell(row, c.dna)),
			usArea,
			usPerimeter: num(cell(row, c.usPerimeter)),
			habitat,
			tideRaw: text(cell(row, c.tide)),
			notes,
			ref
		};
		if (!rec.sex && !isBlank(cell(row, c.sex)) && cell(row, c.sex) != null)
			log.add('info', 'values', `Unrecognised sex value`, ref, 'sex', cell(row, c.sex));
		if (!rec.siteId && rec.siteRaw)
			log.add('warning', 'sites', `Unknown site "${rec.siteRaw}"`, ref, 'site', rec.siteRaw);
		if (
			rec.workupMin == null &&
			rec.releaseMin != null &&
			(rec.landingMin ?? rec.captureMin) != null
		) {
			const w = rec.releaseMin - (rec.landingMin ?? rec.captureMin)!;
			if (w >= 0 && w < 180) rec.workupMin = w;
		}
		return rec;
	};

	for (const { r, cells } of sheet.rows.slice(1)) {
		const base = build(cells, r, cols);
		if (!base) continue;
		out.push(base);
		recapStarts.forEach((start, i) => {
			const end = recapStarts[i + 1] ?? header.length;
			if (!cells.slice(start, end).some((v) => v != null && !isBlank(v))) return;
			const blockCols = mapColumns(header, CAPTURE_SPEC, start, end);
			blockCols.site = start;
			blockCols.notes = blockCols.notes ?? undefined;
			const recap = build(cells, r, blockCols, base, i + 2);
			if (recap && recap.date) {
				recap.kind = base.kind;
				recap.ageClass = null;
				recap.umbilical = null;
				// Same spreadsheet row = same shark, even when it carries no tag.
				base.group = recap.group = `block:${file}:${r}`;
				base.captureNo ??= 1;
				out.push(recap);
			}
		});
	}

	harmoniseUnits(out, log, { file, sheet: sheet.name });
	for (const c of out) checkCapture(c, log);
	return out;
}

/**
 * 2013-14 "Catch data" + "Recaptures": recaptures are ordinary catch rows, grouped in the
 * Recaptures sheet under an "Individual Shark number". Returns shark number → group key.
 */
export function recaptureGroups2013(sheet: Sheet): Map<string, string> {
	const header = sheet.rows[0].cells;
	const cols = mapColumns(header, {
		group: [eq('individual shark number')],
		catchNo: [eq('catch')],
		sharkNo: [eq('shark n', 'shark n°')]
	});
	const groups = new Map<string, string>();
	let current: string | null = null;
	for (const { r, cells } of sheet.rows.slice(1)) {
		const g = str(cell(cells, cols.group));
		const catchNo = int(cell(cells, cols.catchNo));
		if (g && catchNo == null) continue; // section titles ("Sharks sampled three times")
		if (g || catchNo === 1) current = `2013-recap-${r}`;
		const shark = str(cell(cells, cols.sharkNo));
		if (current && shark && /^\d+$/.test(shark)) groups.set(shark, current);
	}
	return groups;
}

/**
 * 2014-15 "Recaptures": each group starts with catch 1 (already in Catch data) followed by
 * catch 2, 3… rows that exist only here. Returns those extra captures.
 */
export function parseRecaptures2014(
	sheet: Sheet,
	season: string,
	file: string,
	log: IssueLog
): RawCapture[] {
	const header = sheet.rows[0].cells;
	const cols = mapColumns(header, {
		catchNo: [eq('catch n', 'catch n°')],
		species: [eq('species')],
		sharkNo: [eq('shark n', 'shark n°')],
		date: [eq('date of catch')],
		time: [eq('time')],
		site: [eq('location')],
		sex: [eq('sex')],
		fl: [/^fl\b/],
		tl: [/^tl\b/],
		mass: [/^total weight/],
		tag: [eq('tag #', 'tag')],
		notes: [eq('comments')]
	});
	const out: RawCapture[] = [];
	let first: {
		species: SpeciesCode;
		sex: 'M' | 'F' | null;
		sharkNo: string | null;
		tags: string[];
	} | null = null;
	for (const { r, cells } of sheet.rows.slice(1)) {
		const catchNo = int(cell(cells, cols.catchNo));
		if (catchNo == null) continue;
		const tags = tagsOf(cell(cells, cols.tag));
		if (catchNo === 1) {
			first = {
				species: speciesOf(cell(cells, cols.species)) ?? 'Unknown',
				sex: sexOf(cell(cells, cols.sex)),
				sharkNo: str(cell(cells, cols.sharkNo)),
				tags
			};
			continue;
		}
		if (!first) continue;
		const ref = { file, sheet: sheet.name, row: r };
		let date = dateOf(cell(cells, cols.date));
		if (date) {
			const fixed = fixSeasonYear(date, season);
			if (fixed.fixed) {
				log.add(
					'warning',
					'dates',
					`Date ${date} outside season ${season}; read as ${fixed.date}`,
					ref,
					'date',
					date
				);
				date = fixed.date;
			}
		}
		const siteRaw = str(cell(cells, cols.site));
		const notes = text(cell(cells, cols.notes));
		const fl = num(cell(cells, cols.fl));
		const tl = num(cell(cells, cols.tl));
		out.push({
			season,
			species: first.species,
			siteRaw,
			siteId: resolveSite(siteRaw),
			setNo: null,
			date,
			sharkNo: first.sharkNo,
			captureNo: catchNo,
			kind: 'field',
			tags: tags.length ? tags : first.tags,
			sex: first.sex,
			ageClass: null,
			umbilical: null,
			uss: null,
			pclMm: null,
			flMm: fl != null ? fl * 10 : null,
			tlMm: tl != null ? tl * 10 : null,
			pecGirthMm: null,
			dorsGirthMm: null,
			caudGirthMm: null,
			massKg: num(cell(cells, cols.mass)),
			clasperL: null,
			clasperR: null,
			captureMin: timeOf(cell(cells, cols.time)),
			landingMin: null,
			releaseMin: null,
			workupMin: null,
			toLab: null,
			died: /d[ée]c[èe]s|died|dead/i.test(notes ?? '') ? 1 : null,
			blood: null,
			dna: null,
			usArea: null,
			usPerimeter: null,
			habitat: null,
			tideRaw: null,
			notes,
			ref
		});
	}
	return out;
}

// ---------------------------------------------------------------------------------------------
// Set logs

const SET_SPEC = {
	setNo: [eq('set', 'set no', 'number', 'trip', 'trip#', 'trip #')],
	site: [eq('site', 'location')],
	gear: [eq('gear')],
	visit: [eq('visit', 'visit no', 'round', 'total visits', 'total visite')],
	date: [eq('date')],
	crew: [eq('crew', 'team')],
	start: [eq('set start', 'net in', 'arrival time', 'arrive')],
	end: [eq('set end', 'net out', 'departure time', 'depart')],
	duration: [eq('set duration', 'time in')],
	nCm: [eq('cm', '#cm', 'nombre de nouveaux cm captures')],
	nNa: [eq('na', '#na', 'nombre de nouveaux na captures')],
	nNf: [eq('nf', '#nf')],
	nTotal: [eq('sharks', '#sharks', 'total caught')],
	cpueTotal: [eq('cpue total')],
	cpueCm: [/^cpue cm/],
	cpueNa: [/^cpue na/],
	tide: [eq('tidal stage', 'tide')],
	moon: [/^moon/, /^lunar stage/],
	weather: [eq('weather')],
	cloud: [/^cloud coverage/],
	waterTempStart: [/^water temp .*start/],
	temp: [eq('temp c', 't c')],
	phStart: [eq('ph start')],
	ph: [eq('ph')],
	doMg: [/^d o mg/],
	doPct: [eq('d o %', 'd o')],
	salinity: [/^sal\b/],
	depth: [/^depth/],
	notes: [eq('notes', 'comments')]
} satisfies Record<string, Matcher[]>;

export function isSetSheet(sheet: Sheet): boolean {
	const n = sheet.name.trim().toLowerCase();
	if (n === 'set log physioshark') return false; // 2013-14 duplicate of "Set Log" (#9)
	return /^set log|^sampling days|^boat log/.test(n);
}

export function parseSetSheet(sheet: Sheet, season: string, file: string, log: IssueLog): RawSet[] {
	const header = sheet.rows[0].cells;
	const cols = mapColumns(header, SET_SPEC);
	if (cols.date == null) {
		// 2021-22 has a garbled date header ("16("); pick the column holding calendar dates.
		const counts = new Map<number, number>();
		for (const { cells } of sheet.rows.slice(1, 30))
			cells.forEach((c, i) => {
				if (c && typeof c === 'object' && !(c as { isTimeOnly: boolean }).isTimeOnly)
					counts.set(i, (counts.get(i) ?? 0) + 1);
			});
		const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
		if (best) cols.date = best[0];
	}
	const boat = /^boat log/i.test(sheet.name.trim());
	const out: RawSet[] = [];
	for (const { r, cells } of sheet.rows.slice(1)) {
		const ref = { file, sheet: sheet.name, row: r };
		let date = dateOf(cell(cells, cols.date));
		const siteRaw = str(cell(cells, cols.site));
		if (!date && !siteRaw) continue;
		if (!date) {
			log.add(
				'warning',
				'dates',
				'Set without a readable date',
				ref,
				'date',
				cell(cells, cols.date)
			);
			continue;
		}
		const fixed = fixSeasonYear(date, season);
		if (fixed.fixed) {
			log.add(
				'warning',
				'dates',
				`Date ${date} outside season ${season}; read as ${fixed.date}`,
				ref,
				'date',
				date
			);
			date = fixed.date;
		}
		const startMin = timeOf(cell(cells, cols.start));
		let endMin = timeOf(cell(cells, cols.end));
		if (startMin != null && endMin != null && endMin < startMin) endMin += 1440;
		let durationMin =
			startMin != null && endMin != null
				? endMin - startMin
				: durationOf(cell(cells, cols.duration));
		if (durationMin != null && (durationMin <= 0 || durationMin > 12 * 60)) {
			log.add(
				'warning',
				'effort',
				`Implausible set duration ${durationMin} min`,
				ref,
				'duration',
				durationMin
			);
			durationMin = null;
		}
		const crewRaw = text(cell(cells, cols.crew));
		const gearRaw = text(cell(cells, cols.gear));
		const gear = boat
			? 'Hook and line'
			: gearRaw && /hook/i.test(gearRaw)
				? 'Hook and line'
				: 'Gillnet';
		const cpueCell = cell(cells, cols.cpueTotal) ?? null;
		const siteId = resolveSite(siteRaw);
		if (!siteId && siteRaw)
			log.add('warning', 'sites', `Unknown site "${siteRaw}"`, ref, 'site', siteRaw);
		out.push({
			season,
			setNo: boat ? null : int(cell(cells, cols.setNo)),
			siteRaw,
			siteId,
			date,
			gear,
			visit: int(cell(cells, cols.visit)),
			crewRaw,
			crew: parseCrew(crewRaw),
			startMin,
			endMin,
			durationMin,
			nCm: int(cell(cells, cols.nCm)),
			nNa: int(cell(cells, cols.nNa)),
			nNf: int(cell(cells, cols.nNf)),
			nTotal: int(cell(cells, cols.nTotal)),
			cpueSheet: num(cpueCell),
			tideRaw: text(cell(cells, cols.tide)),
			moonRaw: str(cell(cells, cols.moon)),
			weatherRaw: text(cell(cells, cols.weather)),
			cloudCover: num(cell(cells, cols.cloud)),
			waterTemp: num(cell(cells, cols.waterTempStart)) ?? num(cell(cells, cols.temp)),
			ph: num(cell(cells, cols.phStart)) ?? num(cell(cells, cols.ph)),
			doMg: num(cell(cells, cols.doMg)),
			doPct: num(cell(cells, cols.doPct)),
			salinity: num(cell(cells, cols.salinity)),
			depthCm: num(cell(cells, cols.depth)),
			notes: text(cell(cells, cols.notes)),
			ref
		});
	}
	return out;
}
