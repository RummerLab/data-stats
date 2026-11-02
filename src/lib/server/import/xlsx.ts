/**
 * Minimal read-only .xlsx reader (#1).
 *
 * The workbooks are plain data sheets, so this only needs: workbook/sheet lookup, shared and
 * inline strings, numbers, booleans, errors, cached formula values and dates. Unzipping is done
 * by `fflate`; XML is scanned with regular expressions, which is enough for the
 * machine-written SpreadsheetML Excel produces and avoids SheetJS/exceljs and their stale deps.
 *
 * Dates are returned as {@link ExcelDate} (the raw serial) rather than JS `Date`, so callers
 * decide whether a cell is a calendar date, a clock time or a duration without time-zone math.
 */
import { unzipSync, strFromU8 } from 'fflate';

/** An Excel date/time serial: days since 1899-12-30 (fraction = time of day). */
export class ExcelDate {
	readonly serial: number;

	constructor(serial: number) {
		this.serial = serial;
	}

	/** True for a time-of-day / duration cell (no calendar part). */
	get isTimeOnly() {
		return this.serial < 1;
	}

	/** Calendar date as `YYYY-MM-DD` (UTC arithmetic on the serial, no zone shifts). */
	toISODate(): string {
		const ms = Date.UTC(1899, 11, 30) + Math.floor(this.serial + 1e-9) * 86_400_000;
		return new Date(ms).toISOString().slice(0, 10);
	}

	/** Minutes since midnight for the fractional part, rounded to the nearest second. */
	toMinutes(): number {
		const frac = this.serial - Math.floor(this.serial + 1e-9);
		return Math.round(Math.max(0, frac) * 86_400) / 60;
	}

	toString() {
		return this.isTimeOnly ? formatClock(this.toMinutes()) : this.toISODate();
	}
}

export type CellValue = string | number | boolean | ExcelDate | null;

export interface SheetRow {
	/** 1-based row number in the sheet, kept for data-quality references. */
	r: number;
	cells: CellValue[];
}

export interface Sheet {
	name: string;
	hidden: boolean;
	rows: SheetRow[];
}

export interface Workbook {
	sheets: Sheet[];
	sheet(name: string): Sheet | undefined;
}

const BUILTIN_DATE_FORMATS = new Set([
	14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
	52, 53, 54, 55, 56, 57, 58
]);

export function formatClock(minutes: number): string {
	const total = Math.round(minutes);
	const h = Math.floor(total / 60) % 24;
	const m = total % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Does an Excel number format code render dates or times? */
export function isDateFormat(code: string): boolean {
	const stripped = code
		.replace(/"[^"]*"/g, '') // quoted literals
		.replace(/\\./g, '') // escaped characters
		.replace(/\[(?!h\]|hh\]|m\]|mm\]|s\]|ss\])[^\]]*\]/gi, '') // colours/conditions/locales, keep [h]/[mm]/[ss]
		.replace(/General/gi, '');
	if (/[#0?]/.test(stripped) && !/[dmyhs]/i.test(stripped)) return false;
	return /[dmyhs]/i.test(stripped);
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s: string): string {
	return s
		.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
			if (e[0] === '#') {
				const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1));
				return String.fromCodePoint(code);
			}
			return ENTITY[e.toLowerCase()] ?? _;
		})
		.replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Concatenate the `<t>` runs of a string item, ignoring phonetic `<rPh>` hints. */
function textOf(xml: string): string {
	const body = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
	let out = '';
	for (const m of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)) out += m[1] ?? '';
	return decodeXml(out);
}

function attr(tag: string, name: string): string | undefined {
	const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
	return m ? decodeXml(m[1]) : undefined;
}

export function columnIndex(ref: string): number {
	let n = 0;
	for (const ch of ref) {
		const c = ch.charCodeAt(0);
		if (c < 65 || c > 90) break;
		n = n * 26 + (c - 64);
	}
	return n - 1;
}

function resolveTarget(target: string): string {
	if (target.startsWith('/')) return target.slice(1);
	return `xl/${target.replace(/^\.\//, '')}`;
}

export function readWorkbook(bytes: Uint8Array): Workbook {
	const files = unzipSync(bytes, {
		filter: (f) => f.name.startsWith('xl/') && (f.name.endsWith('.xml') || f.name.endsWith('.rels'))
	});
	const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');

	const workbookXml = text('xl/workbook.xml');
	const date1904 = /<workbookPr\b[^>]*\bdate1904="(1|true)"/.test(workbookXml);

	const rels = new Map<string, string>();
	for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
		const id = attr(m[0], 'Id');
		const target = attr(m[0], 'Target');
		if (id && target) rels.set(id, resolveTarget(target));
	}

	const shared: string[] = [];
	for (const m of text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) {
		shared.push(m[1] ? textOf(m[1]) : '');
	}

	const stylesXml = text('xl/styles.xml');
	const customFormats = new Map<number, string>();
	for (const m of stylesXml.matchAll(/<numFmt\b[^>]*>/g)) {
		const id = Number(attr(m[0], 'numFmtId'));
		const code = attr(m[0], 'formatCode') ?? '';
		customFormats.set(id, code);
	}
	const dateStyles: boolean[] = [];
	const cellXfs = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);
	if (cellXfs) {
		for (const m of cellXfs[1].matchAll(/<xf\b[^>]*>/g)) {
			const id = Number(attr(m[0], 'numFmtId') ?? 0);
			const custom = customFormats.get(id);
			dateStyles.push(custom != null ? isDateFormat(custom) : BUILTIN_DATE_FORMATS.has(id));
		}
	}

	const sheets: Sheet[] = [];
	for (const m of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
		const name = attr(m[0], 'name') ?? `Sheet${sheets.length + 1}`;
		const rid = attr(m[0], 'r:id');
		const path = rid ? rels.get(rid) : undefined;
		const state = attr(m[0], 'state');
		sheets.push({
			name,
			hidden: state === 'hidden' || state === 'veryHidden',
			rows: path ? parseSheet(text(path), shared, dateStyles, date1904) : []
		});
	}

	return { sheets, sheet: (name) => sheets.find((s) => s.name === name) };
}

function parseSheet(
	xml: string,
	shared: string[],
	dateStyles: boolean[],
	date1904: boolean
): SheetRow[] {
	const data = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/);
	if (!data) return [];
	const rows: SheetRow[] = [];
	let lastRow = 0;
	for (const rm of data[1].matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
		const rAttr = rm[1].match(/\sr="(\d+)"/);
		const r = rAttr ? Number(rAttr[1]) : lastRow + 1;
		lastRow = r;
		if (!rm[2]) continue;
		const cells: CellValue[] = [];
		let lastCol = -1;
		for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
			const tag = cm[1];
			const ref = tag.match(/\sr="([A-Z]+)\d+"/);
			const col = ref ? columnIndex(ref[1]) : lastCol + 1;
			lastCol = col;
			const value = cellValue(tag, cm[2] ?? '', shared, dateStyles, date1904);
			if (value === null) continue;
			while (cells.length < col) cells.push(null);
			cells[col] = value;
		}
		if (cells.some((c) => c !== null && !(typeof c === 'string' && c.trim() === ''))) {
			rows.push({ r, cells });
		}
	}
	return rows;
}

function cellValue(
	tag: string,
	inner: string,
	shared: string[],
	dateStyles: boolean[],
	date1904: boolean
): CellValue {
	const type = tag.match(/\st="([^"]*)"/)?.[1] ?? 'n';
	const styleIdx = Number(tag.match(/\ss="(\d+)"/)?.[1] ?? 0);
	if (type === 'inlineStr') {
		const is = inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
		return is ? textOf(is[1]) : null;
	}
	const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
	if (v == null) return null;
	switch (type) {
		case 's':
			return shared[Number(v)] ?? null;
		case 'str':
			return decodeXml(v);
		case 'b':
			return v === '1';
		case 'e':
			return decodeXml(v); // e.g. "#N/A", "#DIV/0!"
		case 'd': {
			const ms = Date.parse(v);
			if (Number.isNaN(ms)) return decodeXml(v);
			return new ExcelDate(ms / 86_400_000 + 25_569);
		}
		default: {
			const n = Number(v);
			if (!Number.isFinite(n)) return decodeXml(v);
			if (dateStyles[styleIdx]) return new ExcelDate(date1904 ? n + 1462 : n);
			return n;
		}
	}
}
