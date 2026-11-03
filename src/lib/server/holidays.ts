/**
 * Human-activity proxies for French Polynesia (#25): public holidays (computed, including the
 * Easter-based ones), the Christmas–New Year festive period and school holidays. Dates are local
 * (UTC−10) ISO strings, like set dates.
 *
 * School holidays change every year, so they come from `external/school-holidays.csv` (archived
 * calendar orders for 2013-14 to 2016-17, the Ministry's open data since) via `schoolDays`.
 */

/** Easter Sunday (Gregorian, anonymous algorithm) as an ISO date. */
export function easter(year: number): string {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const addDays = (iso: string, n: number) =>
	new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Public holidays of French Polynesia in a year: ISO date → name. */
export function publicHolidays(year: number): Map<string, string> {
	const e = easter(year);
	const fixed: [string, string][] = [
		['01-01', "New Year's Day"],
		['03-05', 'Arrival of the Gospel'],
		['05-01', 'Labour Day'],
		['05-08', 'Victory in Europe Day'],
		['07-14', 'Bastille Day'],
		['08-15', 'Assumption'],
		['11-01', "All Saints' Day"],
		['11-11', 'Armistice Day'],
		['12-25', 'Christmas Day']
	];
	// Matari'i i ni'a (20 Nov) replaced Internal Autonomy Day (29 Jun) from 2025.
	fixed.push(year >= 2025 ? ['11-20', "Matari'i i ni'a"] : ['06-29', 'Internal Autonomy Day']);
	const out = new Map<string, string>(fixed.map(([md, name]) => [`${year}-${md}`, name]));
	out.set(addDays(e, -2), 'Good Friday');
	out.set(addDays(e, 1), 'Easter Monday');
	out.set(addDays(e, 39), 'Ascension Day');
	out.set(addDays(e, 50), 'Whit Monday');
	return out;
}

const cache = new Map<number, Map<string, string>>();

/** Name of the public holiday on this date, or null. */
export function holidayOn(iso: string): string | null {
	const y = Number(iso.slice(0, 4));
	if (!cache.has(y)) cache.set(y, publicHolidays(y));
	return cache.get(y)!.get(iso) ?? null;
}

/** 20 December – 5 January: Christmas and New Year, when beaches and lagoons are busiest. */
export function isFestive(iso: string): boolean {
	const md = iso.slice(5);
	return md >= '12-20' || md <= '01-05';
}

export interface SchoolBreak {
	name: string;
	start: string; // first day off
	end: string; // last day off
}

/** Every day of the school breaks: ISO date → break name. */
export function schoolDays(breaks: SchoolBreak[]): Map<string, string> {
	const out = new Map<string, string>();
	for (const b of breaks) for (let d = b.start; d <= b.end; d = addDays(d, 1)) out.set(d, b.name);
	return out;
}

export type DayType =
	'Public holiday' | 'Festive period' | 'School holidays' | 'Weekend' | 'Weekday';
export const DAY_TYPES: DayType[] = [
	'Weekday',
	'Weekend',
	'School holidays',
	'Public holiday',
	'Festive period'
];

/**
 * One label per date: a public holiday wins over the festive window, which wins over the school
 * holidays, which win over the weekend.
 */
export function dayType(iso: string, school: Map<string, string> = new Map()): DayType {
	if (holidayOn(iso)) return 'Public holiday';
	if (isFestive(iso)) return 'Festive period';
	if (school.has(iso)) return 'School holidays';
	const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
	return wd === 0 || wd === 6 ? 'Weekend' : 'Weekday';
}
