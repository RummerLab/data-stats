/**
 * Tide helpers on the hourly Papeete gauge series (#18). Heights are millimetres above the
 * gauge datum; timestamps are local (`YYYY-MM-DDTHH`).
 */
export interface HourlyPoint {
	t: number; // epoch hours (local clock treated as UTC)
	mm: number;
}

export interface Extremum {
	ts: string; // YYYY-MM-DDTHH:MM local
	kind: 'H' | 'L';
	mm: number;
}

export const tsToHour = (ts: string) => Date.parse(`${ts.slice(0, 13)}:00:00Z`) / 3_600_000;

export function hourToTs(h: number, withMinutes = false): string {
	const iso = new Date(h * 3_600_000).toISOString();
	return withMinutes ? iso.slice(0, 16) : iso.slice(0, 13);
}

/**
 * Highs and lows: an hour that is the strict max/min of a ±3 h window, refined by a parabola
 * through its neighbours (sub-hour timing). Gaps longer than 2 h break the series.
 */
export function findExtrema(points: HourlyPoint[]): Extremum[] {
	const out: Extremum[] = [];
	const W = 3;
	for (let i = W; i < points.length - W; i++) {
		const p = points[i];
		if (points[i + W].t - points[i - W].t !== 2 * W) continue; // gap
		let isMax = true;
		let isMin = true;
		for (let k = -W; k <= W; k++) {
			if (k === 0) continue;
			const q = points[i + k].mm;
			if (q >= p.mm && !(k > 0 && q === p.mm)) isMax = false;
			if (q <= p.mm && !(k > 0 && q === p.mm)) isMin = false;
		}
		if (!isMax && !isMin) continue;
		const y0 = points[i - 1].mm;
		const y1 = p.mm;
		const y2 = points[i + 1].mm;
		const denom = y0 - 2 * y1 + y2;
		const dx = denom === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / denom));
		const mm = y1 - 0.25 * (y0 - y2) * dx;
		out.push({ ts: hourToTs(p.t + dx, true), kind: isMax ? 'H' : 'L', mm: Math.round(mm) });
	}
	return out;
}

/** Linear interpolation of the hourly series at a fractional epoch hour. */
export function interpolate(
	points: HourlyPoint[],
	index: Map<number, number>,
	hour: number
): number | null {
	const h0 = Math.floor(hour);
	const i0 = index.get(h0);
	const i1 = index.get(h0 + 1);
	if (i0 == null) return null;
	if (i1 == null) return hour === h0 ? points[i0].mm : null;
	const f = hour - h0;
	return points[i0].mm * (1 - f) + points[i1].mm * f;
}
