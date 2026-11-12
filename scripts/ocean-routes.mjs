#!/usr/bin/env node
/**
 * Compute and verify shortest water routes between Moorea nurseries (#183).
 *
 * Usage:
 *   node scripts/ocean-routes.mjs
 *   node scripts/ocean-routes.mjs --geojson
 *
 * Uses Moorea coastline polygon from src/lib/moorea-outline.json (ODbL 1.0).
 */
import { SITE_DEFS } from '../src/lib/server/import/sites.ts';
import {
	buildMooreaWaterGrid,
	computeAllNurseryRoutes,
	crossesLand,
	routeToGeoJson
} from '../src/lib/server/oceanRoutes.ts';

const args = process.argv.slice(2);
const asGeoJson = args.includes('--geojson');

const nurseries = SITE_DEFS.filter(
	(s) => s.island === 'Moorea' && s.kind === 'nursery' && s.lat != null && s.lon != null
).map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon }));

const t0 = performance.now();
const grid = buildMooreaWaterGrid({ cell: 35, padM: 2000 });
const routes = computeAllNurseryRoutes(nurseries, grid);
const elapsedMs = Math.round(performance.now() - t0);

if (asGeoJson) {
	const fc = {
		type: 'FeatureCollection',
		features: routes.map((r) => routeToGeoJson(r))
	};
	process.stdout.write(JSON.stringify(fc, null, 2) + '\n');
	process.exit(0);
}

let landCrossings = 0;
for (const r of routes) {
	if (crossesLand(grid, r.coordinates)) {
		landCrossings++;
		console.error(`Warning: route ${r.fromId} -> ${r.toId} intersects land`);
	}
}

console.log(
	`Computed ${routes.length} water routes across ${nurseries.length} nurseries in ${elapsedMs} ms:\n`
);
console.log(
	`${'From'.padEnd(14)} ${'To'.padEnd(14)} ${'Water km'.padStart(10)} ${'Direct km'.padStart(10)} ${'Ratio'.padStart(8)} ${'Vertices'.padStart(10)}`
);
console.log('-'.repeat(72));

for (const r of routes) {
	const ratio = r.straightKm > 0 ? (r.km / r.straightKm).toFixed(2) : '-';
	console.log(
		`${r.fromId.padEnd(14)} ${r.toId.padEnd(14)} ${r.km.toFixed(1).padStart(10)} ${r.straightKm.toFixed(1).padStart(10)} ${ratio.padStart(8)} ${String(r.coordinates.length).padStart(10)}`
	);
}

console.log('-'.repeat(72));
console.log(`Total pairs: ${routes.length}`);
console.log(`Land crossings: ${landCrossings}`);
if (landCrossings === 0) {
	console.log('✓ All routes stay entirely on water (no land intersections).');
} else {
	console.error(`✗ ${landCrossings} route(s) intersect land.`);
	process.exit(1);
}
