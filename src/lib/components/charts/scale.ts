/** Minimal scales and ticks for the SVG charts (#27). */

export interface Scale {
	(v: number): number;
	domain: [number, number];
	range: [number, number];
	invert(px: number): number;
}

export function linear(domain: [number, number], range: [number, number], log = false): Scale {
	const [d0, d1] = log ? [Math.log10(domain[0]), Math.log10(domain[1])] : domain;
	const [r0, r1] = range;
	const span = d1 - d0 || 1;
	const f = ((v: number) => r0 + (((log ? Math.log10(v) : v) - d0) / span) * (r1 - r0)) as Scale;
	f.domain = domain;
	f.range = range;
	f.invert = (px: number) => {
		const t = d0 + ((px - r0) / (r1 - r0 || 1)) * span;
		return log ? 10 ** t : t;
	};
	return f;
}

function step(span: number, count: number) {
	const raw = span / Math.max(1, count);
	const pow = 10 ** Math.floor(Math.log10(raw));
	const n = raw / pow;
	return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

/** Extend a domain to round tick values. */
export function nice(lo: number, hi: number, count = 5, zero = false): [number, number] {
	if (zero) {
		lo = Math.min(0, lo);
		hi = Math.max(0, hi);
	}
	if (lo === hi) {
		const d = lo === 0 ? 1 : Math.abs(lo) * 0.1;
		lo -= d;
		hi += d;
	}
	const s = step(hi - lo, count);
	return [Math.floor(lo / s + 1e-9) * s, Math.ceil(hi / s - 1e-9) * s];
}

export function ticks(lo: number, hi: number, count = 5): number[] {
	const s = step(hi - lo, count);
	const out: number[] = [];
	for (let v = Math.ceil(lo / s - 1e-9) * s; v <= hi + s * 1e-9; v += s)
		out.push(Math.round(v / s) * s);
	return out.map((v) => (Math.abs(v) < s * 1e-9 ? 0 : v));
}

export function logTicks(lo: number, hi: number): number[] {
	const out: number[] = [];
	for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
		for (const m of [1, 2, 5]) {
			const v = m * 10 ** e;
			if (v >= lo && v <= hi) out.push(v);
		}
	return out;
}

/** Epoch-day helpers for date axes (x values are days since 1970-01-01). */
export const toDay = (iso: string) =>
	Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
export const fromDay = (d: number) => new Date(d * 86_400_000).toISOString().slice(0, 10);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Date ticks: years for long spans, months otherwise. */
export function dateTicks(lo: number, hi: number, maxTicks = 8): { v: number; label: string }[] {
	const a = new Date(lo * 86_400_000);
	const b = new Date(hi * 86_400_000);
	const years = b.getUTCFullYear() - a.getUTCFullYear();
	const out: { v: number; label: string }[] = [];
	if (years >= 2) {
		const every = Math.ceil((years + 1) / maxTicks);
		for (let y = a.getUTCFullYear() + 1; y <= b.getUTCFullYear(); y++)
			if ((y - a.getUTCFullYear() - 1) % every === 0)
				out.push({ v: toDay(`${y}-01-01`), label: String(y) });
		return out;
	}
	const months = years * 12 + b.getUTCMonth() - a.getUTCMonth();
	const every = Math.max(1, Math.ceil(months / maxTicks));
	const d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 1));
	let i = 0;
	while (d <= b) {
		if (i % every === 0)
			out.push({
				v: Math.round(d.getTime() / 86_400_000),
				label:
					d.getUTCMonth() === 0 ? `${MONTHS[0]} ${d.getUTCFullYear()}` : MONTHS[d.getUTCMonth()]
			});
		d.setUTCMonth(d.getUTCMonth() + 1);
		i++;
	}
	return out;
}

/** Path through points, breaking at nulls. */
export function linePath(pts: { x: number; y: number | null }[], sx: Scale, sy: Scale): string {
	let d = '';
	let pen = false;
	for (const p of pts) {
		if (p.y == null || !Number.isFinite(p.y)) {
			pen = false;
			continue;
		}
		d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
		pen = true;
	}
	return d;
}

/** Bar path with a 4px rounded data end and a square baseline (vertical bars). */
export function barPath(x: number, w: number, y0: number, y1: number, r = 4): string {
	const top = Math.min(y0, y1);
	const bottom = Math.max(y0, y1);
	const h = bottom - top;
	const rr = Math.min(r, w / 2, h);
	if (h <= 0) return '';
	if (y1 <= y0) {
		// grows upward: round the top
		return `M${x},${bottom}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + w - rr}Q${x + w},${top} ${x + w},${top + rr}V${bottom}Z`;
	}
	return `M${x},${top}V${bottom - rr}Q${x},${bottom} ${x + rr},${bottom}H${x + w - rr}Q${x + w},${bottom} ${x + w},${bottom - rr}V${top}Z`;
}

/** Horizontal bar from the baseline x0 to the data end x1 (rounded), either direction. */
export function hbarPath(x0: number, x1: number, y: number, h: number, r = 4): string {
	const w = Math.abs(x1 - x0);
	if (w <= 0) return '';
	const rr = Math.min(r, h / 2, w);
	if (x1 < x0) {
		return `M${x0},${y}H${x1 + rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 + rr},${y + h}H${x0}Z`;
	}
	return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`;
}
