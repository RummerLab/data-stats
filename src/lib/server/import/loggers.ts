/**
 * Raw in-situ temperature loggers (#10). Two systems were used in the nurseries:
 *
 * - Onset HOBO pendants (2015-19), exported from HOBOware as CSV. Exports are in English or
 *   French, comma- or tab-separated, UTF-8 or Mac Roman. Clocks are Moorea local time even when
 *   the header says GMT+10:00 (the light channel peaks at midday), so the label is ignored.
 * - ElectricBlue EnvLoggers (2019-24), self-describing CSVs with serial number, custom name,
 *   time zone and the phone's GPS at download. Time zones switch between UTC-1000 and UTC+0000.
 *
 * Files are only read. Every sample is converted to local clock minutes (the convention of the
 * other hourly series: local time written as if it were UTC).
 */
import type { Workbook } from './xlsx';

export type LoggerSystem = 'HOBO' | 'EnvLogger';

export interface LoggerFile {
	file: string;
	system: LoggerSystem;
	/** HOBO label from the file name (e.g. "12b") or the EnvLogger serial number. */
	logger: string;
	/** HOBO launch number (12 for "12b"), matching the workbooks' HOBO log. */
	hoboNo: number | null;
	serial: string | null;
	/** Site text from the custom name or file name, resolved later. */
	siteHint: string | null;
	/** EnvLogger: where the phone was when the logger was downloaded. */
	lat: number | null;
	lon: number | null;
	/** Local clock minutes since the epoch, ascending. */
	t: number[];
	v: number[];
	/** Mean light by local hour (HOBO only), to check the clock. */
	lightPeakHour: number | null;
	tzLabel: string | null;
}

export type ParsedCsv = LoggerFile | { skip: 'app-log' | 'empty' | 'unknown' };

const decode = (buf: Uint8Array) => {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(buf);
	} catch {
		// One 2015-16 export is Mac Roman with CR line ends. Only numbers matter, so latin1 will do.
		return new TextDecoder('latin1').decode(buf);
	}
};

/** Quote-aware split of one delimited line. */
export function splitLine(line: string, delim: string): string[] {
	const out: string[] = [];
	let cur = '';
	let q = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			if (q && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else q = !q;
		} else if (ch === delim && !q) {
			out.push(cur);
			cur = '';
		} else cur += ch;
	}
	out.push(cur);
	return out.map((c) => c.trim());
}

const clockMin = (y: number, mo: number, d: number, h: number, mi: number) =>
	Date.UTC(y, mo - 1, d, h, mi) / 60_000;

/** HOBOware dates are month-first: 11/26/15 05:00:00 PM, or 3/2/2018 19:00 in one export. */
export function hoboDate(s: string): number | null {
	const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
	if (!m) return null;
	const [mo, d] = [+m[1], +m[2]];
	let y = +m[3];
	if (y < 100) y += 2000;
	let h = +m[4] % (m[6] ? 12 : 24);
	if (m[6]?.toUpperCase() === 'PM') h += 12;
	if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
	return clockMin(y, mo, d, h, +m[5]);
}

const MOOREA_OFFSET_MIN = -600;

/** "2022-11-03 05:46:53" in a "UTC+0000" file → Moorea local clock minutes. */
export function envDate(s: string, offsetMin: number): number | null {
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
	if (!m) return null;
	return clockMin(+m[1], +m[2], +m[3], +m[4], +m[5]) - offsetMin + MOOREA_OFFSET_MIN;
}

const num = (s: string | undefined) => {
	if (s == null || s === '' || /^na$/i.test(s)) return null;
	const v = Number(s.replace(',', '.'));
	return Number.isFinite(v) ? v : null;
};

const fileBase = (rel: string) =>
	rel
		.split('/')
		.pop()!
		.replace(/\.csv$/i, '');

function parseHobo(lines: string[], rel: string): LoggerFile | null {
	const hi = lines.findIndex((l) => /LGR S\/N/.test(l) && /date/i.test(l));
	if (hi < 0) return null;
	const delim = lines[hi].includes('\t') ? '\t' : ',';
	const header = splitLine(lines[hi], delim);
	const di = header.findIndex((h) => /^date/i.test(h));
	const ti = header.findIndex((h) => /^temp/i.test(h));
	const li = header.findIndex((h) => /^intens/i.test(h));
	if (di < 0 || ti < 0) return null;
	const base = fileBase(rel);
	const title = lines.slice(0, hi).join(' ');
	const label =
		base.match(/HOBO\s*(\d+[a-z]?)/i)?.[1] ?? title.match(/HOBO\s*(\d+[a-z]?)/i)?.[1] ?? null;
	if (!label) return null;
	const t: number[] = [];
	const v: number[] = [];
	const light = Array.from({ length: 24 }, () => ({ s: 0, n: 0 }));
	for (const line of lines.slice(hi + 1)) {
		if (!line) continue;
		const c = splitLine(line, delim);
		const ts = hoboDate(c[di] ?? '');
		const temp = num(c[ti]);
		if (ts == null || temp == null) continue;
		t.push(ts);
		v.push(temp);
		const lux = li >= 0 ? num(c[li]) : null;
		if (lux != null) {
			const h = Math.floor((((ts % 1440) + 1440) % 1440) / 60);
			light[h].s += lux;
			light[h].n++;
		}
	}
	const means = light.map((b) => (b.n ? b.s / b.n : -1));
	const peak = Math.max(...means);
	// The suffix after the date range names the site on a few early files ("…_Intercontinental").
	const suffix = base.match(/\d{2}\s*_([A-Za-z][A-Za-z ]+)$/)?.[1] ?? null;
	return {
		file: rel,
		system: 'HOBO',
		logger: label.toLowerCase(),
		hoboNo: parseInt(label, 10),
		serial: header[ti].match(/LGR S\/N:\s*(\d+)/)?.[1] ?? null,
		siteHint: suffix,
		lat: null,
		lon: null,
		t,
		v,
		lightPeakHour: peak > 0 ? means.indexOf(peak) : null,
		tzLabel: header[di].match(/GMT\s*([+-]\d{1,2}:?\d{2})/)?.[1] ?? null
	};
}

function parseEnv(lines: string[], rel: string): ParsedCsv {
	const meta = new Map<string, string>();
	let i = 0;
	for (; i < lines.length; i++) {
		if (/^time\s*,\s*temp/i.test(lines[i])) break;
		const [k, ...rest] = lines[i].split(',');
		if (rest.length) meta.set(k.trim().toLowerCase(), rest.join(',').trim());
	}
	const serial = meta.get('serial number')?.replace(/\s+/g, ' ').toUpperCase() || null;
	const tz = (meta.get('time zone') ?? 'UTC-1000').match(/UTC\s*([+-])(\d{2}):?(\d{2})/);
	const offset = tz ? (tz[1] === '-' ? -1 : 1) * (+tz[2] * 60 + +tz[3]) : MOOREA_OFFSET_MIN;
	const t: number[] = [];
	const v: number[] = [];
	for (const line of lines.slice(i + 1)) {
		const [ts, val] = line.split(',');
		const m = envDate(ts?.trim() ?? '', offset);
		const temp = num(val?.trim());
		if (m == null || temp == null) continue;
		t.push(m);
		v.push(temp);
	}
	if (!serial || !t.length) return { skip: 'empty' };
	// Early exports drop the minus signs: Moorea is south and west.
	const coord = (s: string | undefined) => {
		const x = num(s);
		return x == null || x === 0 ? null : -Math.abs(x);
	};
	const name = meta.get('custom name') || null;
	return {
		file: rel,
		system: 'EnvLogger',
		logger: serial,
		hoboNo: null,
		serial,
		// "Apaura 1", or the file name prefix ("PIAENA_2_048A …") when the name is blank.
		siteHint: name ?? fileBase(rel).match(/^([A-Za-z][A-Za-z_ ]*?)_\d/)?.[1] ?? null,
		lat: coord(meta.get('lat')),
		lon: coord(meta.get('long')),
		t,
		v,
		lightPeakHour: null,
		tzLabel: tz ? tz[0] : null
	};
}

/** Parse one logger CSV. Unknown CSVs are skipped, never guessed at. */
export function parseLoggerCsv(buf: Uint8Array, rel: string): ParsedCsv {
	const text = decode(buf).replace(/^\uFEFF/, '');
	const lines = text.split(/\r\n|\r|\n/);
	const head = lines.slice(0, 4).join('\n');
	if (/^time\s*,\s*action/i.test(lines[0] ?? '')) return { skip: 'app-log' };
	if (/electricblue/i.test(head)) return parseEnv(lines, rel);
	if (/LGR S\/N/.test(head)) {
		const f = parseHobo(lines, rel);
		return f && f.t.length ? f : f ? { skip: 'empty' } : { skip: 'unknown' };
	}
	return { skip: 'unknown' };
}

// ------------------------------------------------------------------------------------------
// Cleaning and aggregation

/** Hours dropped at each end of a file: deployment and retrieval, when loggers are in the air.
 *  HOBOs were read out back at the station, often the day after retrieval. */
export const TRIM_HOURS: Record<LoggerSystem, { start: number; end: number }> = {
	HOBO: { start: 2, end: 24 },
	EnvLogger: { start: 2, end: 2 }
};

/** Readings outside this range are a logger in the sun or the air, not lagoon water. */
export const PLAUSIBLE_C: [number, number] = [15, 40];

export interface CleanStats {
	kept: number;
	trimmed: number;
	implausible: number;
	duplicate: number;
}

/**
 * Trim deployment edges, drop implausible readings and samples already read from another
 * download of the same logger. `seen` holds the minutes already taken per logger.
 */
export function cleanFile(
	f: LoggerFile,
	seen: Map<string, Set<number>>
): { t: number[]; v: number[]; stats: CleanStats } {
	const trim = TRIM_HOURS[f.system];
	const lo = f.t[0] + trim.start * 60;
	const hi = f.t[f.t.length - 1] - trim.end * 60;
	const key = `${f.system}:${f.serial ?? f.logger}`;
	const taken = seen.get(key) ?? new Set<number>();
	seen.set(key, taken);
	const t: number[] = [];
	const v: number[] = [];
	const stats: CleanStats = { kept: 0, trimmed: 0, implausible: 0, duplicate: 0 };
	for (let i = 0; i < f.t.length; i++) {
		if (f.t[i] < lo || f.t[i] > hi) stats.trimmed++;
		else if (f.v[i] < PLAUSIBLE_C[0] || f.v[i] > PLAUSIBLE_C[1]) stats.implausible++;
		else if (taken.has(f.t[i])) stats.duplicate++;
		else {
			taken.add(f.t[i]);
			t.push(f.t[i]);
			v.push(f.v[i]);
			stats.kept++;
		}
	}
	return { t, v, stats };
}

/** Hourly means keyed by local clock hour (minutes / 60, floored). */
export function hourly(t: number[], v: number[]): Map<number, number> {
	const acc = new Map<number, { s: number; n: number }>();
	for (let i = 0; i < t.length; i++) {
		const h = Math.floor(t[i] / 60);
		const a = acc.get(h) ?? { s: 0, n: 0 };
		a.s += v[i];
		a.n++;
		acc.set(h, a);
	}
	return new Map([...acc].map(([h, a]) => [h, a.s / a.n]));
}

export const hourIso = (h: number) => new Date(h * 3_600_000).toISOString().slice(0, 16);

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
	const r = Math.PI / 180;
	const a =
		Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
		Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
	return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/** "O472-EF00-482F-OE" (letter O typed for zero) → "0472 EF00 482F 0E". */
export function normalSerial(raw: string): string | null {
	const hex = raw
		.toUpperCase()
		.replace(/O/g, '0')
		.replace(/[^0-9A-F]/g, '');
	if (hex.length !== 14) return null;
	return `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)} ${hex.slice(12)}`;
}

export interface RegisterRow {
	serial: string;
	name: string | null;
	site: string | null;
}

/** Is this the EnvLogger register (serial number, custom name, site, GPS…)? */
export function isLoggerRegister(wb: Workbook): boolean {
	return wb.sheets.some((s) =>
		s.rows
			.slice(0, 5)
			.some(
				(r) =>
					r.cells.some((c) => /^serial number$/i.test(String(c ?? '').trim())) &&
					r.cells.some((c) => /^custom name$/i.test(String(c ?? '').trim()))
			)
	);
}

export function parseLoggerRegister(wb: Workbook): RegisterRow[] {
	const out: RegisterRow[] = [];
	for (const sheet of wb.sheets) {
		const hr = sheet.rows.find((r) =>
			r.cells.some((c) => /^serial number$/i.test(String(c ?? '').trim()))
		);
		if (!hr) continue;
		const col = (re: RegExp) => hr.cells.findIndex((c) => re.test(String(c ?? '').trim()));
		const [si, ni, ti] = [col(/^serial number$/i), col(/^custom name$/i), col(/^site$/i)];
		for (const { cells } of sheet.rows.filter((r) => r.r > hr.r)) {
			const serial = normalSerial(String(cells[si] ?? ''));
			if (!serial) continue;
			const s = (i: number) => (i >= 0 && cells[i] != null ? String(cells[i]).trim() : null);
			out.push({ serial, name: s(ni), site: s(ti) });
		}
	}
	return out;
}
