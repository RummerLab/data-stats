/**
 * "Download CSV" for every chart (#31). Each chart component registers a function that returns
 * its data as a table; the enclosing ChartCard turns the registered tables into a CSV file on
 * click. Nothing is computed until someone asks, and no call site has to pass extra props.
 */
import { getContext, setContext } from 'svelte';

export type Cell = string | number | null | undefined;
export interface CsvTable {
	columns: string[];
	rows: Cell[][];
}
export type CsvSource = () => CsvTable;

const KEY = Symbol('chart-csv');

/** ChartCard: collect the tables of the charts inside it. */
export function collectCsv(): CsvSource[] {
	const sources: CsvSource[] = [];
	setContext(KEY, (s: CsvSource) => sources.push(s));
	return sources;
}

/** Chart components: offer this chart's data to the enclosing ChartCard (if any). */
export function registerCsv(source: CsvSource) {
	getContext<((s: CsvSource) => void) | undefined>(KEY)?.(source);
}

const cell = (v: Cell) => {
	if (v == null || (typeof v === 'number' && !Number.isFinite(v))) return '';
	const s = typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : v;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV; several tables are separated by a blank line. */
export function toCsv(tables: CsvTable[]): string {
	return tables
		.filter((t) => t.rows.length)
		.map((t) => [t.columns, ...t.rows].map((r) => r.map(cell).join(',')).join('\r\n'))
		.join('\r\n\r\n');
}

export const slug = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60) || 'chart';

/** Day number (days since 1970-01-01) → ISO date. */
export const isoDay = (d: number) => new Date(d * 86_400_000).toISOString().slice(0, 10);
