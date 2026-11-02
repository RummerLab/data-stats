import { headerKey } from './normalize';
import type { CellValue } from './xlsx';

export type Matcher = RegExp | ((key: string) => boolean);

/**
 * Map logical fields to column indexes from a header row. For each field the left-most column
 * whose normalised header matches wins, searching only `[from, to)` so repeated blocks (e.g.
 * release measurements after "Release Date") can be mapped separately.
 */
export function mapColumns<F extends string>(
	header: CellValue[],
	spec: Record<F, Matcher[]>,
	from = 0,
	to = header.length
): Partial<Record<F, number>> {
	const keys = header.map((h) => headerKey(h));
	const out: Partial<Record<F, number>> = {};
	const used = new Set<number>();
	for (const field of Object.keys(spec) as F[]) {
		for (let i = from; i < Math.min(to, keys.length); i++) {
			if (used.has(i) || !keys[i]) continue;
			const k = keys[i];
			if (spec[field].some((m) => (m instanceof RegExp ? m.test(k) : m(k)))) {
				out[field] = i;
				used.add(i);
				break;
			}
		}
	}
	return out;
}

/** Index of the first header whose key matches. */
export function findHeader(header: CellValue[], re: RegExp, from = 0): number {
	for (let i = from; i < header.length; i++) if (re.test(headerKey(header[i]))) return i;
	return -1;
}

export function cell(row: CellValue[], idx: number | undefined): CellValue {
	return idx == null ? null : (row[idx] ?? null);
}
