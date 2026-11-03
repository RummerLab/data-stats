/**
 * Deterministic formatting (no locale lookups, so SSR and hydration always agree).
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = MONTHS;

export function num(v: number | null | undefined, dp = 0): string {
	if (v == null || !Number.isFinite(v)) return '–';
	const fixed = Math.abs(v).toFixed(dp);
	const [int, frac] = fixed.split('.');
	const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return `${v < 0 && Number(fixed) !== 0 ? '−' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** Compact numbers for axes: 1,234 → 1.2K. */
export function compact(v: number): string {
	const a = Math.abs(v);
	if (a >= 1e6) return `${num(v / 1e6, a >= 1e7 ? 0 : 1)}M`;
	if (a >= 1e4) return `${num(v / 1e3, 0)}K`;
	if (a >= 1000) return `${num(v / 1e3, 1)}K`;
	if (Number.isInteger(v)) return num(v);
	return num(v, a < 1 ? 2 : 1);
}

export function pct(v: number | null | undefined, dp = 0): string {
	return v == null || !Number.isFinite(v) ? '–' : `${num(v * 100, dp)}%`;
}

/** Minutes after midnight → `18:42` (wraps past midnight). */
export function clock(min: number | null | undefined): string {
	if (min == null || !Number.isFinite(min)) return '–';
	const m = Math.round(((min % 1440) + 1440) % 1440);
	return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Signed minutes → `+1h 12m` / `−25m`. */
export function minutesDelta(min: number | null | undefined): string {
	if (min == null || !Number.isFinite(min)) return '–';
	const sign = min < 0 ? '−' : '+';
	const a = Math.round(Math.abs(min));
	return a >= 60 ? `${sign}${Math.floor(a / 60)}h ${a % 60}m` : `${sign}${a}m`;
}

/** `2014-03-01` → `1 Mar 2014`. */
export function date(iso: string | null | undefined): string {
	if (!iso) return '–';
	const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
	return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthYear(iso: string): string {
	const [y, m] = iso.split('-').map(Number);
	return `${MONTHS[m - 1]} ${y}`;
}

/** Day of the fieldwork season (1 Aug = day 0) → `5 Nov`. */
export const seasonDayLabel = (day: number) => {
	const d = new Date(Date.UTC(2001, 7, 1) + day * 86_400_000);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** `2013-2014` → `2013–14`. */
export function season(s: string): string {
	return s.length === 9 ? `${s.slice(0, 4)}–${s.slice(7)}` : s;
}

export function mm(v: number | null | undefined): string {
	return v == null ? '–' : `${num(v)} mm`;
}

export function kg(v: number | null | undefined): string {
	return v == null ? '–' : `${num(v, 2)} kg`;
}

export function pValue(p: number | null | undefined): string {
	if (p == null || !Number.isFinite(p)) return '–';
	if (p < 0.001) return 'p < 0.001';
	return `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
	return `${num(n)} ${n === 1 ? one : many}`;
}
