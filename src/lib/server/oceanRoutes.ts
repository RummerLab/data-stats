/**
 * Shortest water routes between Moorea nurseries (#183).
 *
 * Adapted from water routing in hikeandexplore (#1661): rasterises Moorea's coastline
 * (src/lib/moorea-outline.json, OpenStreetMap ODbL 1.0) on a 35 m grid, runs A* over
 * water cells with a cost penalty near land, and pulls strings (straightens) where a
 * direct line stays entirely on water without crossing land.
 */
import outline from '../moorea-outline.json' with { type: 'json' };

const SQRT2 = Math.SQRT2;

export interface Bbox {
	minLon: number;
	minLat: number;
	maxLon: number;
	maxLat: number;
}

export interface WaterGrid {
	width: number;
	height: number;
	cell: number;
	bbox: Bbox;
	kx: number;
	ky: number;
	water: Uint8Array;
	distance: Float32Array;
}

export interface RouteResult {
	fromId: string;
	toId: string;
	km: number;
	straightKm: number;
	/** Ordered array of [lat, lon] coordinates from start site to destination site. */
	coordinates: [number, number][];
}

/** Binary min-heap of (priority, index) on typed arrays with dynamic resizing. */
class Heap {
	keys: Float64Array;
	values: Int32Array;
	size: number;

	constructor(capacity = 1024) {
		this.keys = new Float64Array(capacity);
		this.values = new Int32Array(capacity);
		this.size = 0;
	}

	push(key: number, value: number) {
		if (this.size === this.keys.length) {
			const keys = new Float64Array(this.size * 2);
			keys.set(this.keys);
			const values = new Int32Array(this.size * 2);
			values.set(this.values);
			this.keys = keys;
			this.values = values;
		}
		let i = this.size++;
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (this.keys[parent] <= key) break;
			this.keys[i] = this.keys[parent];
			this.values[i] = this.values[parent];
			i = parent;
		}
		this.keys[i] = key;
		this.values[i] = value;
	}

	pop(): number {
		const top = this.values[0];
		const key = this.keys[--this.size];
		const value = this.values[this.size];
		let i = 0;
		for (;;) {
			let child = 2 * i + 1;
			if (child >= this.size) break;
			if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child++;
			if (this.keys[child] >= key) break;
			this.keys[i] = this.keys[child];
			this.values[i] = this.values[child];
			i = child;
		}
		this.keys[i] = key;
		this.values[i] = value;
		return top;
	}
}

/**
 * Visit every cell a segment touches (4-connected supercover). Stops early when visit returns false.
 */
export function traverse(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	visit: (x: number, y: number) => boolean | void
): boolean {
	let cx = Math.floor(x0);
	let cy = Math.floor(y0);
	const ex = Math.floor(x1);
	const ey = Math.floor(y1);
	const dx = x1 - x0;
	const dy = y1 - y0;
	const stepX = dx > 0 ? 1 : -1;
	const stepY = dy > 0 ? 1 : -1;
	const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
	const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
	let tMaxX = dx !== 0 ? (dx > 0 ? cx + 1 - x0 : x0 - cx) * tDeltaX : Infinity;
	let tMaxY = dy !== 0 ? (dy > 0 ? cy + 1 - y0 : y0 - cy) * tDeltaY : Infinity;
	if (visit(cx, cy) === false) return false;
	let n = Math.abs(ex - cx) + Math.abs(ey - cy);
	while (n > 0) {
		if (Math.abs(tMaxX - tMaxY) < 1e-9 && n >= 2) {
			if (visit(cx + stepX, cy) === false || visit(cx, cy + stepY) === false) return false;
			tMaxX += tDeltaX;
			tMaxY += tDeltaY;
			cx += stepX;
			cy += stepY;
			n -= 2;
		} else if (tMaxX < tMaxY) {
			tMaxX += tDeltaX;
			cx += stepX;
			n--;
		} else {
			tMaxY += tDeltaY;
			cy += stepY;
			n--;
		}
		if (visit(cx, cy) === false) return false;
	}
	return true;
}

/** Two-pass chamfer distance (m) from each water cell to the nearest land cell. */
export function distanceToLand(
	water: Uint8Array,
	width: number,
	height: number,
	cell: number
): Float32Array {
	const d = new Float32Array(width * height);
	const diag = cell * SQRT2;
	for (let i = 0; i < d.length; i++) d[i] = water[i] ? Infinity : 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			if (!d[i]) continue;
			let v = d[i];
			if (x > 0) v = Math.min(v, d[i - 1] + cell);
			if (y > 0) {
				v = Math.min(v, d[i - width] + cell);
				if (x > 0) v = Math.min(v, d[i - width - 1] + diag);
				if (x < width - 1) v = Math.min(v, d[i - width + 1] + diag);
			}
			d[i] = v;
		}
	}
	for (let y = height - 1; y >= 0; y--) {
		for (let x = width - 1; x >= 0; x--) {
			const i = y * width + x;
			if (!d[i]) continue;
			let v = d[i];
			if (x < width - 1) v = Math.min(v, d[i + 1] + cell);
			if (y < height - 1) {
				v = Math.min(v, d[i + width] + cell);
				if (x < width - 1) v = Math.min(v, d[i + width + 1] + diag);
				if (x > 0) v = Math.min(v, d[i + width - 1] + diag);
			}
			d[i] = v;
		}
	}
	return d;
}

/**
 * Build the Moorea water raster grid from the simplified island coastline.
 * Everything inside the Moorea ring is land (0); the surrounding ocean is water (1).
 */
export function buildMooreaWaterGrid({
	cell = 35,
	padM = 2000
}: { cell?: number; padM?: number } = {}): WaterGrid {
	const ring = outline.ring as [number, number][];
	let minLon = Infinity;
	let maxLon = -Infinity;
	let minLat = Infinity;
	let maxLat = -Infinity;
	for (const [lon, lat] of ring) {
		minLon = Math.min(minLon, lon);
		maxLon = Math.max(maxLon, lon);
		minLat = Math.min(minLat, lat);
		maxLat = Math.max(maxLat, lat);
	}
	const midLat = (minLat + maxLat) / 2;
	const kx = 111320 * Math.cos((midLat * Math.PI) / 180);
	const ky = 110540;
	const dLat = padM / ky;
	const dLon = padM / kx;
	const bbox: Bbox = {
		minLon: minLon - dLon,
		maxLon: maxLon + dLon,
		minLat: minLat - dLat,
		maxLat: maxLat + dLat
	};

	const width = Math.ceil(((bbox.maxLon - bbox.minLon) * kx) / cell);
	const height = Math.ceil(((bbox.maxLat - bbox.minLat) * ky) / cell);

	const toCell = ([lon, lat]: [number, number]): [number, number] => [
		((lon - bbox.minLon) * kx) / cell,
		((lat - bbox.minLat) * ky) / cell
	];
	const pts = ring.map(toCell);

	const rows = new Map<number, number[]>();
	for (let i = 1; i < pts.length; i++) {
		const [x0, y0] = pts[i - 1];
		const [x1, y1] = pts[i];
		if (y0 === y1) continue;
		const lo = Math.max(0, Math.ceil(Math.min(y0, y1) - 0.5));
		const hi = Math.min(height - 1, Math.floor(Math.max(y0, y1) - 0.5));
		for (let row = lo; row <= hi; row++) {
			const yc = row + 0.5;
			if (yc < Math.min(y0, y1) || yc >= Math.max(y0, y1)) continue;
			const x = x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0);
			let list = rows.get(row);
			if (!list) rows.set(row, (list = []));
			list.push(x);
		}
	}

	const water = new Uint8Array(width * height).fill(1); // default water
	for (const [row, xs] of rows) {
		xs.sort((a, b) => a - b);
		for (let i = 0; i + 1 < xs.length; i += 2) {
			const from = Math.max(0, Math.ceil(xs[i] - 0.5));
			const to = Math.min(width - 1, Math.floor(xs[i + 1] - 0.5));
			for (let x = from; x <= to; x++) water[row * width + x] = 0; // land
		}
	}

	const distance = distanceToLand(water, width, height, cell);
	return { width, height, cell, bbox, kx, ky, water, distance };
}

/** Lon/lat of a cell centre. */
export function cellCentre(grid: WaterGrid, index: number): [lon: number, lat: number] {
	const x = index % grid.width;
	const y = Math.floor(index / grid.width);
	return [
		grid.bbox.minLon + ((x + 0.5) * grid.cell) / grid.kx,
		grid.bbox.minLat + ((y + 0.5) * grid.cell) / grid.ky
	];
}

/**
 * Snap a point (lon, lat) to the nearest water cell within maxM metres.
 */
export function snapToWater(grid: WaterGrid, lon: number, lat: number, maxM = 3000): number {
	const cx = ((lon - grid.bbox.minLon) * grid.kx) / grid.cell;
	const cy = ((lat - grid.bbox.minLat) * grid.ky) / grid.cell;
	const sx = Math.floor(cx);
	const sy = Math.floor(cy);
	const reach = Math.ceil(maxM / grid.cell);
	let bestDist = Infinity;
	let bestIdx = -1;
	for (let dy = -reach; dy <= reach; dy++) {
		for (let dx = -reach; dx <= reach; dx++) {
			const x = sx + dx;
			const y = sy + dy;
			if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
			const idx = y * grid.width + x;
			if (grid.water[idx] !== 1) continue;
			const d = Math.hypot(dx, dy);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = idx;
			}
		}
	}
	return bestIdx;
}

/**
 * A* search over water cells from start to goal with distance-to-land penalty.
 */
export function findWaterPath(
	grid: WaterGrid,
	start: number,
	goal: number,
	{ clearanceM = 50, penalty = 2 }: { clearanceM?: number; penalty?: number } = {}
): number[] | null {
	const { width, height, water, distance, cell } = grid;
	const size = width * height;
	const cost = (i: number) => 1 + penalty * Math.max(0, (clearanceM - distance[i]) / clearanceM);
	const g = new Float32Array(size).fill(Infinity);
	const from = new Int32Array(size).fill(-1);
	const closed = new Uint8Array(size);
	const gx = goal % width;
	const gy = Math.floor(goal / width);
	const h = (i: number) => {
		const x = i % width;
		return Math.hypot(x - gx, Math.floor(i / width) - gy) * cell;
	};
	const heap = new Heap();
	g[start] = 0;
	heap.push(h(start), start);
	while (heap.size) {
		const current = heap.pop();
		if (closed[current]) continue;
		if (current === goal) break;
		closed[current] = 1;
		const x = current % width;
		const y = Math.floor(current / width);
		const cCost = cost(current);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (!dx && !dy) continue;
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
				const next = ny * width + nx;
				if (!water[next] || closed[next]) continue;
				// Do not cut land corners on diagonal steps.
				if (dx && dy && (!water[y * width + nx] || !water[ny * width + x])) continue;
				const step = (dx && dy ? SQRT2 : 1) * cell * ((cCost + cost(next)) / 2);
				const tentative = g[current] + step;
				if (tentative < g[next]) {
					g[next] = tentative;
					from[next] = current;
					heap.push(tentative + h(next), next);
				}
			}
		}
	}
	if (start !== goal && from[goal] < 0) return null;
	const path = [goal];
	for (let i = goal; i !== start; i = from[i]) path.push(from[i]);
	return path.reverse();
}

/**
 * Straighten a path using raycast string-pulling, ensuring every direct segment stays on water.
 */
export function straightenPath(
	grid: WaterGrid,
	path: number[],
	{ clearanceM = 50 }: { clearanceM?: number } = {}
): number[] {
	if (path.length <= 2) return path.slice();
	const { width, water, distance } = grid;
	const centre = (i: number): [number, number] => [(i % width) + 0.5, Math.floor(i / width) + 0.5];
	const clear = (a: number, b: number, need: number) => {
		const [x0, y0] = centre(a);
		const [x1, y1] = centre(b);
		return traverse(x0, y0, x1, y1, (x, y) => {
			const i = y * width + x;
			return water[i] === 1 && distance[i] >= need;
		});
	};
	const out = [path[0]];
	let anchor = 0;
	while (anchor < path.length - 1) {
		let need = Math.min(clearanceM, distance[path[anchor]]);
		let best = anchor + 1;
		for (let j = anchor + 1; j < path.length; j++) {
			need = Math.min(need, distance[path[j]]);
			if (clear(path[anchor], path[j], need)) best = j;
			else if (j - best > 64) break;
		}
		out.push(path[best]);
		anchor = best;
	}
	return out;
}

/**
 * Compute the shortest water route between two locations.
 * Returns coordinates as an ordered array of [lat, lon] tuples.
 */
export function routeWater(
	grid: WaterGrid,
	from: { id?: string; lat: number; lon: number },
	to: { id?: string; lat: number; lon: number },
	{ clearanceM = 50, penalty = 2 }: { clearanceM?: number; penalty?: number } = {}
): RouteResult | null {
	const s1 = snapToWater(grid, from.lon, from.lat);
	const s2 = snapToWater(grid, to.lon, to.lat);
	if (s1 < 0 || s2 < 0) return null;

	const rawPath = findWaterPath(grid, s1, s2, { clearanceM, penalty });
	if (!rawPath) return null;

	const smoothed = straightenPath(grid, rawPath, { clearanceM });
	const coordinates: [number, number][] = [[from.lat, from.lon]];
	for (const idx of smoothed) {
		const [lon, lat] = cellCentre(grid, idx);
		coordinates.push([lat, lon]);
	}
	coordinates.push([to.lat, to.lon]);

	// Filter out zero-length steps if start/end coincided with snapped cell
	const cleaned = coordinates.filter(
		(pt, i) =>
			i === 0 || Math.hypot(pt[0] - coordinates[i - 1][0], pt[1] - coordinates[i - 1][1]) > 1e-7
	);

	let km = 0;
	for (let i = 1; i < cleaned.length; i++) {
		const dX = (cleaned[i][1] - cleaned[i - 1][1]) * grid.kx;
		const dY = (cleaned[i][0] - cleaned[i - 1][0]) * grid.ky;
		km += Math.hypot(dX, dY) / 1000;
	}

	const straightKm =
		Math.hypot((to.lon - from.lon) * grid.kx, (to.lat - from.lat) * grid.ky) / 1000;

	return {
		fromId: from.id ?? '',
		toId: to.id ?? '',
		km: Math.round(km * 100) / 100,
		straightKm: Math.round(straightKm * 100) / 100,
		coordinates: cleaned
	};
}

/**
 * Check whether any segment of coordinates (excluding the short landing legs) crosses land.
 */
export function crossesLand(grid: WaterGrid, coordinates: [number, number][]): boolean {
	const toCell = ([lat, lon]: [number, number]): [number, number] => [
		((lon - grid.bbox.minLon) * grid.kx) / grid.cell,
		((lat - grid.bbox.minLat) * grid.ky) / grid.cell
	];
	// Only test intermediate water segments (skip indices 0->1 and (N-2)->(N-1) which are shore landings).
	if (coordinates.length <= 3) return false;
	for (let i = 2; i < coordinates.length - 1; i++) {
		const [x0, y0] = toCell(coordinates[i - 1]);
		const [x1, y1] = toCell(coordinates[i]);
		const ok = traverse(x0, y0, x1, y1, (x, y) => {
			if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return true;
			return grid.water[y * grid.width + x] === 1;
		});
		if (!ok) return true;
	}
	return false;
}

/**
 * Precompute shortest water routes for all pairs of Moorea nurseries.
 * Generates an unordered pair (a, b) where a.id < b.id.
 */
export function computeAllNurseryRoutes(
	nurseries: { id: string; lat: number; lon: number }[],
	grid?: WaterGrid
): RouteResult[] {
	const g = grid ?? buildMooreaWaterGrid();
	const results: RouteResult[] = [];
	const sorted = [...nurseries].sort((a, b) => a.id.localeCompare(b.id));
	for (let i = 0; i < sorted.length; i++) {
		for (let j = i + 1; j < sorted.length; j++) {
			const route = routeWater(g, sorted[i], sorted[j]);
			if (route) {
				results.push(route);
			}
		}
	}
	return results;
}

/**
 * Export a route as standard GeoJSON Feature (RFC 7946, [lon, lat] coordinates).
 */
export function routeToGeoJson(route: RouteResult) {
	return {
		type: 'Feature' as const,
		properties: {
			from: route.fromId,
			to: route.toId,
			km: route.km,
			straightKm: route.straightKm
		},
		geometry: {
			type: 'LineString' as const,
			coordinates: route.coordinates.map(([lat, lon]) => [lon, lat])
		}
	};
}
