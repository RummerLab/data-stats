/**
 * Cell-level parsers shared by every sheet importer. All of them accept the raw
 * {@link CellValue} and return `null` for blanks and the many "not available" spellings.
 */
import { ExcelDate, type CellValue } from './xlsx';

const NA_TOKENS = new Set([
	'',
	'na',
	'n/a',
	'n.a.',
	'nan',
	'#n/a',
	'#na',
	'#value!',
	'#ref!',
	'#div/0!',
	'-',
	'--',
	'?',
	'??',
	'nd',
	'none',
	'null',
	'x'
]);

export function isBlank(v: CellValue | undefined): boolean {
	if (v == null) return true;
	if (typeof v === 'string') return NA_TOKENS.has(v.trim().toLowerCase());
	return false;
}

export function str(v: CellValue | undefined): string | null {
	if (v == null) return null;
	if (v instanceof ExcelDate) return v.toString();
	const s = String(v).replace(/\s+/g, ' ').trim();
	return s === '' ? null : s;
}

/** Free text that keeps NA-like words (notes are allowed to say "na"). */
export function text(v: CellValue | undefined): string | null {
	const s = str(v);
	if (s == null) return null;
	return /^(#n\/a|na|n\/a|-|\?)$/i.test(s) ? null : s;
}

export type StomachState = 'full' | 'traces' | 'empty';

/** Lavage / stomach fullness (#40): "full", "empty", "almost empty", "traces of food"… */
export function stomachOf(v: CellValue | undefined): StomachState | null {
	const s = text(v)?.toLowerCase();
	if (!s || /no sample/.test(s)) return null;
	if (/almost empty|trace/.test(s)) return 'traces';
	if (/^(empty|no food)\b/.test(s)) return 'empty';
	if (/^full\b/.test(s)) return 'full';
	return null;
}

/** Free-text stomach contents, without the cells that only restate fullness or "no sample". */
export function contentsOf(v: CellValue | undefined): string | null {
	const s = text(v);
	if (!s) return null;
	return /^(no sample|no food|none|empty|full|almost empty|traces? of food\b.*)$/i.test(s.trim())
		? null
		: s;
}

/** Numbers, including strings like "1,2", "~45", "45 mm", "0.9kg". */
export function num(v: CellValue | undefined): number | null {
	if (v == null || typeof v === 'boolean') return null;
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	if (v instanceof ExcelDate) return null;
	const s = v.trim();
	if (isBlank(s)) return null;
	const m = s.replace(',', '.').match(/^[~≈<>]?\s*(-?\d+(?:\.\d+)?)(?:\s*[a-zA-Z%°/()]*)?$/);
	return m ? Number(m[1]) : null;
}

export function int(v: CellValue | undefined): number | null {
	const n = num(v);
	return n == null ? null : Math.round(n);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(y: number, m: number, d: number): string | null {
	if (y < 100) y += 2000;
	const t = Date.UTC(y, m - 1, d);
	const dt = new Date(t);
	if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
	return `${y}-${pad(m)}-${pad(d)}`;
}

/** Calendar date from an Excel serial or a `dd/mm/yyyy`, `dd.mm.yyyy` or ISO string. */
export function dateOf(v: CellValue | undefined): string | null {
	if (v == null) return null;
	if (v instanceof ExcelDate) return v.serial >= 1 ? v.toISODate() : null;
	if (typeof v === 'number') {
		// A bare number in a date column is a serial that lost its format (e.g. 41570).
		return v > 30_000 && v < 60_000 ? new ExcelDate(v).toISODate() : null;
	}
	if (typeof v !== 'string') return null;
	const s = v.trim();
	let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (m) return isoDate(+m[1], +m[2], +m[3]);
	m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
	if (m) return isoDate(+m[3], +m[2], +m[1]);
	return null;
}

/**
 * Clock time as minutes after midnight. Accepts Excel times, full datetimes (time part), day
 * fractions, and strings like `18:30`, `18h30`, `18.30`, `1830`.
 */
export function timeOf(v: CellValue | undefined): number | null {
	if (v == null) return null;
	if (v instanceof ExcelDate) return v.toMinutes();
	if (typeof v === 'number') {
		if (v >= 0 && v < 1) return Math.round(v * 86_400) / 60;
		if (Number.isInteger(v) && v >= 0 && v <= 2359 && v % 100 < 60) {
			return Math.floor(v / 100) * 60 + (v % 100);
		}
		return null;
	}
	if (typeof v !== 'string') return null;
	const m = v.trim().match(/(?:^|\D)(\d{1,2})\s*[:hH.]\s*(\d{2})(?:\s*[:.]\s*(\d{2}))?/);
	if (m) {
		const h = +m[1];
		const mi = +m[2];
		if (h < 24 && mi < 60) return h * 60 + mi + (m[3] ? +m[3] / 60 : 0);
	}
	return null;
}

/** Duration in minutes (Excel time cell, `h:mm`, or a number of minutes). */
export function durationOf(v: CellValue | undefined): number | null {
	if (v == null) return null;
	if (v instanceof ExcelDate) return Math.round(v.serial * 1440 * 100) / 100;
	if (typeof v === 'number') return v >= 0 && v < 1 ? v * 1440 : v;
	return timeOf(v);
}

export function sexOf(v: CellValue | undefined): 'M' | 'F' | null {
	const s = str(v)?.toLowerCase();
	if (!s) return null;
	if (/^(m|male|mâle|male\s*\?)$/.test(s) || s.startsWith('male')) return 'M';
	if (/^(f|female|femelle)$/.test(s) || s.startsWith('female')) return 'F';
	return null;
}

export type SpeciesCode = 'Cm' | 'Na' | 'Nf' | 'Unknown';

export function speciesOf(v: CellValue | undefined): SpeciesCode | null {
	const s = str(v)
		?.toLowerCase()
		.replace(/[^a-z]/g, '');
	if (!s) return null;
	if (s === 'cm' || s.includes('melanopterus') || s === 'blacktip') return 'Cm';
	if (s === 'na' || s.includes('acutidens') || s.includes('lemon')) return 'Na';
	if (s === 'nf' || s.includes('nurse') || s.includes('ferrugineus') || s.includes('nebrius'))
		return 'Nf';
	// 'GF' / 'Gf1' (2024-25) is the tawny nurse shark; G likely from Ginglymostoma, the Atlantic nurse shark genus (#12).
	if (s.startsWith('gf')) return 'Nf';
	if (s.includes('unknown') || s.includes('unknonw')) return 'Unknown';
	return null;
}

export type AgeClass = 'neonate' | 'juvenile' | 'subadult' | 'adult';

export function ageClassOf(v: CellValue | undefined): AgeClass | null {
	const s = str(v)?.toLowerCase();
	if (!s) return null;
	if (s.startsWith('neo')) return 'neonate';
	if (s.startsWith('juv') || s.includes('yoy')) return 'juvenile';
	if (s.startsWith('sub')) return 'subadult';
	if (s.startsWith('adult') || s === 'mature') return 'adult';
	return null;
}

/** Umbilical scar: open (fresh), semi (healing) or closed (healed). */
export function umbilicalOf(v: CellValue | undefined): 'open' | 'semi' | 'closed' | null {
	const s = str(v)?.toLowerCase();
	if (!s) return null;
	if (s.includes('medium') || s.includes('semi') || s.includes('partial')) return 'semi';
	if (s.startsWith('open') || s === 'yes' || s === 'o') return 'open';
	if (s.startsWith('close') || s === 'c') return 'closed';
	return null;
}

/** Umbilical scar stage 1–3 (2016-18 sheets): 1 open, 2 semi-healed, 3 healed. */
export function umbilicalFromStage(stage: number | null): 'open' | 'semi' | 'closed' | null {
	if (stage == null) return null;
	if (stage <= 1) return 'open';
	if (stage === 2) return 'semi';
	return 'closed';
}

/** Read umbilical status out of free-text notes ("Umbilical scar open", "cordon ombilical non cicatrisé"). */
export function umbilicalFromNotes(notes: string | null): 'open' | 'semi' | 'closed' | null {
	if (!notes) return null;
	const s = notes.toLowerCase();
	if (/non cicatris/.test(s)) return 'open';
	const m = s.match(/umbilical\s+sca(?:r|re)\s+(?:is\s+)?(\w+)/);
	if (m) {
		if (m[1].startsWith('open')) return 'open';
		if (m[1].startsWith('close')) return 'closed';
		if (m[1].startsWith('heal')) return 'closed';
	}
	if (/cicatris/.test(s)) return 'closed';
	return null;
}

/** Yes/no-ish cells → 1/0. Strings that start with "y" (incl. "Y (DNA + SIA)") are yes. */
export function yesNo(v: CellValue | undefined): number | null {
	if (v == null) return null;
	if (typeof v === 'boolean') return v ? 1 : 0;
	const s = str(v)?.toLowerCase();
	if (!s || isBlank(s)) return null;
	if (/^(y|yes|oui|true|1)\b/.test(s) || s.startsWith('blood sample')) return 1;
	if (/^(n|no|non|false|0)\b/.test(s)) return 0;
	return null;
}

/**
 * Tags in one cell: 15-digit PIT numbers (stored as numbers or strings) and external
 * `COFA 12345` dart tags. "COFA 03691 -> COFA 12589" (re-tagged) yields both.
 */
export function tagsOf(v: CellValue | undefined): string[] {
	if (v == null) return [];
	if (typeof v === 'number') {
		if (v >= 1e13) return [String(Math.round(v))];
		return v >= 1000 ? [`TAG ${Math.round(v)}`] : [];
	}
	const s = str(v);
	if (!s) return [];
	const out: string[] = [];
	for (const m of s.matchAll(/\b(\d{14,16})\b/g)) out.push(m[1]);
	for (const m of s.matchAll(/cofa\s*-?\s*(\d{3,6})/gi)) out.push(`COFA ${m[1].padStart(5, '0')}`);
	if (out.length === 0) {
		const n = s.match(/^\d{4,6}$/);
		if (n) out.push(`TAG ${n[0]}`);
	}
	return [...new Set(out)];
}

/** Degrees–minutes–seconds or degrees–decimal-minutes string → signed decimal degrees. */
export function dmsToDecimal(v: CellValue | undefined, negativeHemisphere = false): number | null {
	if (typeof v === 'number') return v;
	const s = str(v);
	if (!s) return null;
	const nums = [...s.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
	if (nums.length === 0) return null;
	const [d, m = 0, sec = 0] = nums;
	let dec = d + m / 60 + sec / 3600;
	if (/[SW]/i.test(s) || negativeHemisphere) dec = -dec;
	return Math.round(dec * 1e6) / 1e6;
}

/** Season label for a date: Aug–Jul fieldwork years, e.g. 2014-03-01 → "2013-2014". */
export function seasonOf(date: string): string {
	const y = Number(date.slice(0, 4));
	const m = Number(date.slice(5, 7));
	return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/** True when the date falls inside the season's Aug–Jul window. */
export function inSeason(date: string, season: string): boolean {
	return seasonOf(date) === season;
}

/**
 * Fix the classic year typo: a date one year outside its season (e.g. 2014-01-11 in the
 * 2014-2015 sheet) is moved into the season when that lands it inside the window.
 */
export function fixSeasonYear(date: string, season: string): { date: string; fixed: boolean } {
	if (inSeason(date, season)) return { date, fixed: false };
	for (const delta of [1, -1]) {
		const y = Number(date.slice(0, 4)) + delta;
		const candidate = `${y}${date.slice(4)}`;
		if (inSeason(candidate, season) && isoDate(y, +date.slice(5, 7), +date.slice(8, 10))) {
			return { date: candidate, fixed: true };
		}
	}
	return { date, fixed: false };
}

/** Normalise a header for matching: lower case, accents stripped, punctuation → spaces. */
export function headerKey(v: CellValue | undefined): string {
	if (v instanceof ExcelDate) return 'date';
	const s = str(v);
	if (!s) return '';
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9#%]+/g, ' ')
		.trim();
}

export function weekday(date: string): number {
	return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function daysBetween(a: string, b: string): number {
	return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
