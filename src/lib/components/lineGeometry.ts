/**
 * Directed move lines (#182, #183): shared by MooreaMap (SVG) and InteractiveMap (Leaflet).
 *
 * For straight lines or multi-segment water routes, lines are drawn with a directional arrow
 * sitting 60% of the way along. When the reverse move is also drawn, both lines shift sideways
 * to the right of their direction of travel, so A → B and B → A sit side by side without overlapping.
 */

interface Ends {
	from: { lat: number; lon: number };
	to: { lat: number; lon: number };
}

const key = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
	`${a.lat},${a.lon}|${b.lat},${b.lon}`;

/** For each line, whether a line in the opposite direction is drawn too. */
export function reversed(lines: Ends[]): boolean[] {
	const all = new Set(lines.map((l) => key(l.from, l.to)));
	return lines.map((l) => all.has(key(l.to, l.from)));
}

export const ARROW_AT = 0.6;

/** Screen points of a line, shifted `shift` px to the right of travel, with its arrow point. */
export function directedPoints(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	shift: number
): [number, number][] {
	const len = Math.hypot(x2 - x1, y2 - y1) || 1;
	// Right-hand normal in screen coordinates (y grows downwards).
	const nx = (-(y2 - y1) / len) * shift;
	const ny = ((x2 - x1) / len) * shift;
	const a: [number, number] = [x1 + nx, y1 + ny];
	const b: [number, number] = [x2 + nx, y2 + ny];
	return [a, [a[0] + (b[0] - a[0]) * ARROW_AT, a[1] + (b[1] - a[1]) * ARROW_AT], b];
}

/** Line width in px for a value, relative to the largest (shared by both maps). */
export const lineWidth = (value: number | undefined, max: number) =>
	1.5 + 6 * Math.sqrt((value ?? 1) / Math.max(1e-9, max));

/** Sideways shift for a line of this width when its reverse is drawn too. */
export const shiftFor = (width: number) => width / 2 + 4;

/** Animation duration in ms for a move of `km` water distance, clamped to [800, 2500]. */
export const moveDuration = (km: number | null | undefined) =>
	km != null && km > 0 ? Math.min(2500, Math.max(800, Math.round(500 + km * 60))) : 800;

/**
 * Shift a multi-point polyline in screen coordinates to the right of travel by `shift` px.
 * For 2-point lines, delegates to directedPoints so the line includes its 60% arrow point.
 */
export function offsetPolyline(pts: [number, number][], shift: number): [number, number][] {
	if (pts.length < 2) return pts.map(([x, y]) => [x, y]);
	if (pts.length === 2) {
		return directedPoints(pts[0][0], pts[0][1], pts[1][0], pts[1][1], shift);
	}
	if (!shift) return pts.map(([x, y]) => [x, y]);
	// Drop sub-2px interior stubs (such as shore-snapping steps) so endpoint normals follow the coast.
	const last = pts[pts.length - 1];
	const clean: [number, number][] = [pts[0]];
	for (let i = 1; i < pts.length - 1; i++) {
		const prev = clean[clean.length - 1];
		if (
			Math.hypot(pts[i][0] - prev[0], pts[i][1] - prev[1]) >= 2 &&
			Math.hypot(last[0] - pts[i][0], last[1] - pts[i][1]) >= 2
		) {
			clean.push(pts[i]);
		}
	}
	clean.push(last);
	const n = clean.length;
	if (n === 2) {
		return directedPoints(clean[0][0], clean[0][1], clean[1][0], clean[1][1], shift);
	}
	const normals: [number, number][] = [];
	for (let i = 0; i < n - 1; i++) {
		const dx = clean[i + 1][0] - clean[i][0];
		const dy = clean[i + 1][1] - clean[i][1];
		const len = Math.hypot(dx, dy) || 1;
		normals.push([(-dy / len) * shift, (dx / len) * shift]);
	}
	const out: [number, number][] = [];
	out.push([clean[0][0] + normals[0][0], clean[0][1] + normals[0][1]]);
	for (let i = 1; i < n - 1; i++) {
		const mx = (normals[i - 1][0] + normals[i][0]) / 2;
		const my = (normals[i - 1][1] + normals[i][1]) / 2;
		const mLen = Math.hypot(mx, my);
		if (mLen > 1e-6) {
			out.push([
				clean[i][0] + (mx / mLen) * Math.abs(shift),
				clean[i][1] + (my / mLen) * Math.abs(shift)
			]);
		} else {
			out.push([clean[i][0] + normals[i][0], clean[i][1] + normals[i][1]]);
		}
	}
	out.push([clean[n - 1][0] + normals[n - 2][0], clean[n - 1][1] + normals[n - 2][1]]);
	return out;
}

/**
 * Returns a 3-point segment around the 60% cumulative-length point of a polyline,
 * oriented in the direction of travel, for SVG marker-mid arrow rendering.
 */
export function polylineArrow(pts: [number, number][], arrowAt = ARROW_AT): [number, number][] {
	if (pts.length < 2) return [pts[0] ?? [0, 0], pts[0] ?? [0, 0], pts[0] ?? [0, 0]];
	let total = 0;
	const lens: number[] = [];
	for (let i = 0; i < pts.length - 1; i++) {
		const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
		lens.push(d);
		total += d;
	}
	if (total === 0) return [pts[0], pts[0], pts[0]];
	const target = total * arrowAt;
	let acc = 0;
	for (let i = 0; i < pts.length - 1; i++) {
		if (acc + lens[i] >= target || i === pts.length - 2) {
			const segLen = lens[i] || 1;
			const rem = Math.max(0, target - acc);
			const t = Math.min(1, rem / segLen);
			const x0 = pts[i][0];
			const y0 = pts[i][1];
			const x1 = pts[i + 1][0];
			const y1 = pts[i + 1][1];
			const ax = x0 + t * (x1 - x0);
			const ay = y0 + t * (y1 - y0);
			const ux = (x1 - x0) / segLen;
			const uy = (y1 - y0) / segLen;
			return [
				[ax - ux * 2, ay - uy * 2],
				[ax, ay],
				[ax + ux * 2, ay + uy * 2]
			];
		}
		acc += lens[i];
	}
	return [pts[0], pts[0], pts[0]];
}

/**
 * Interpolate a position along a multi-point path at fraction f in [0, 1].
 */
export function pointAlongPath(path: [number, number][], f: number): [number, number] {
	if (path.length === 0) return [0, 0];
	if (path.length === 1 || f <= 0) return path[0];
	if (f >= 1) return path[path.length - 1];
	let total = 0;
	const lens: number[] = [];
	for (let i = 0; i < path.length - 1; i++) {
		const d = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
		lens.push(d);
		total += d;
	}
	if (total === 0) return path[0];
	const target = total * f;
	let acc = 0;
	for (let i = 0; i < path.length - 1; i++) {
		if (acc + lens[i] >= target || i === path.length - 2) {
			const segLen = lens[i] || 1;
			const rem = Math.max(0, target - acc);
			const t = Math.min(1, rem / segLen);
			return [
				path[i][0] + t * (path[i + 1][0] - path[i][0]),
				path[i][1] + t * (path[i + 1][1] - path[i][1])
			];
		}
		acc += lens[i];
	}
	return path[path.length - 1];
}
