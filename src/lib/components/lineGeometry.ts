/**
 * Directed move lines (#182): shared by MooreaMap (SVG) and InteractiveMap (Leaflet).
 *
 * A line is drawn as three points (start, arrow point, end) so an SVG `marker-mid` arrow sits
 * 60% of the way along, clear of the circles at either end; the arrows of A → B and B → A then
 * land at different places instead of side by side. When the reverse move is also drawn, both lines
 * shift sideways to the right of their direction of travel, so A → B and B → A sit side by side
 * instead of on top of each other.
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

const ARROW_AT = 0.6;

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
