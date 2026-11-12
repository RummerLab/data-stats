/**
 * Kernel density of capture locations (#174), on a local flat projection in km.
 *
 * Gaussian kernel, one bandwidth for both axes (Silverman's rule on the pooled spread, with a
 * floor so a tight cluster still draws as an area). The grid covers the points plus three
 * bandwidths; cells under 5% of the peak are dropped and the rest binned into `BINS` classes.
 */
import outline from '#lib/moorea-outline.json';

export const BINS = 5;
export const MIN_POINTS = 20;
const FLOOR_KM = 0.3;
const CELLS = 60;
const CUTOFF = 0.05;

export interface LatLon {
	lat: number;
	lon: number;
}

export interface DensityCell {
	south: number;
	west: number;
	north: number;
	east: number;
	/** 1 (lowest) … BINS (peak). */
	bin: number;
}

export interface Density {
	n: number;
	bandwidthKm: number;
	cells: DensityCell[];
}

const KM_LAT = 110.574;
const kmLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

function sd(xs: number[]): number {
	const m = xs.reduce((a, b) => a + b, 0) / xs.length;
	return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1));
}

function iqr(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const q = (p: number) => {
		const i = (s.length - 1) * p;
		const lo = Math.floor(i);
		return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
	};
	return q(0.75) - q(0.25);
}

/** Silverman's rule of thumb, averaged over the two axes, in km. */
export function bandwidth(xs: number[], ys: number[]): number {
	const n = xs.length;
	const axis = (v: number[]) => {
		const spread = Math.min(sd(v), iqr(v) / 1.34 || sd(v));
		return 1.06 * spread * n ** -0.2;
	};
	return Math.max(FLOOR_KM, (axis(xs) + axis(ys)) / 2);
}

export function kde(points: LatLon[]): Density | null {
	if (points.length < MIN_POINTS) return null;
	const lat0 = points.reduce((a, p) => a + p.lat, 0) / points.length;
	const lon0 = points.reduce((a, p) => a + p.lon, 0) / points.length;
	const kx = kmLon(lat0);
	const xs = points.map((p) => (p.lon - lon0) * kx);
	const ys = points.map((p) => (p.lat - lat0) * KM_LAT);
	const h = bandwidth(xs, ys);
	const pad = 3 * h;
	const x0 = Math.min(...xs) - pad;
	const x1 = Math.max(...xs) + pad;
	const y0 = Math.min(...ys) - pad;
	const y1 = Math.max(...ys) + pad;
	const step = Math.max(x1 - x0, y1 - y0) / CELLS;
	const nx = Math.ceil((x1 - x0) / step);
	const ny = Math.ceil((y1 - y0) / step);
	const grid: number[] = [];
	let max = 0;
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) {
			const cx = x0 + (i + 0.5) * step;
			const cy = y0 + (j + 0.5) * step;
			let v = 0;
			for (let k = 0; k < xs.length; k++)
				v += Math.exp(-((cx - xs[k]) ** 2 + (cy - ys[k]) ** 2) / (2 * h * h));
			grid.push(v);
			if (v > max) max = v;
		}
	const cells: DensityCell[] = [];
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) {
			const share = grid[j * nx + i] / max;
			if (share < CUTOFF) continue;
			const west = lon0 + (x0 + i * step) / kx;
			const south = lat0 + (y0 + j * step) / KM_LAT;
			cells.push({
				south,
				west,
				north: south + step / KM_LAT,
				east: west + step / kx,
				bin: Math.min(BINS, Math.max(1, Math.ceil(share * BINS)))
			});
		}
	return { n: points.length, bandwidthKm: h, cells };
}

const ring = outline.ring as [number, number][];

/** Point-in-polygon against Moorea's coastline (ray casting). */
export function onLand(p: LatLon): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

/** Distance in km to the nearest coastline vertex. */
export function kmFromCoast(p: LatLon): number {
	const kx = kmLon(p.lat);
	let best = Infinity;
	for (const [lon, lat] of ring)
		best = Math.min(best, Math.hypot((lon - p.lon) * kx, (lat - p.lat) * KM_LAT));
	return best;
}
