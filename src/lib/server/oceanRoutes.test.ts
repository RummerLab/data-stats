import { describe, expect, it } from 'vitest';
import { SITE_DEFS } from './import/sites';
import {
	buildMooreaWaterGrid,
	computeAllNurseryRoutes,
	crossesLand,
	routeToGeoJson,
	routeWater,
	snapToWater
} from './oceanRoutes';

describe('oceanRoutes', () => {
	const grid = buildMooreaWaterGrid({ cell: 35, padM: 2000 });

	it('builds a valid Moorea water raster grid', () => {
		expect(grid.width).toBeGreaterThan(400);
		expect(grid.height).toBeGreaterThan(300);
		expect(grid.water.length).toBe(grid.width * grid.height);
		expect(grid.distance.length).toBe(grid.width * grid.height);
		// More water than land in the padded bbox
		let waterCount = 0;
		for (let i = 0; i < grid.water.length; i++) {
			if (grid.water[i] === 1) waterCount++;
		}
		expect(waterCount).toBeGreaterThan(grid.water.length / 2);
	});

	it('snaps coastal points to water cells', () => {
		const haapiti = SITE_DEFS.find((s) => s.id === 'haapiti')!;
		const cellIdx = snapToWater(grid, haapiti.lon!, haapiti.lat!);
		expect(cellIdx).toBeGreaterThanOrEqual(0);
		expect(grid.water[cellIdx]).toBe(1);
	});

	it('computes shortest water route avoiding land', () => {
		const haapiti = SITE_DEFS.find((s) => s.id === 'haapiti')!;
		const vaiane = SITE_DEFS.find((s) => s.id === 'vaiane')!;
		const route = routeWater(
			grid,
			{ id: haapiti.id, lat: haapiti.lat!, lon: haapiti.lon! },
			{ id: vaiane.id, lat: vaiane.lat!, lon: vaiane.lon! }
		);
		expect(route).not.toBeNull();
		if (!route) return;
		expect(route.fromId).toBe('haapiti');
		expect(route.toId).toBe('vaiane');
		expect(route.km).toBeGreaterThanOrEqual(route.straightKm);
		expect(route.coordinates[0]).toEqual([haapiti.lat, haapiti.lon]);
		expect(route.coordinates[route.coordinates.length - 1]).toEqual([vaiane.lat, vaiane.lon]);
		expect(crossesLand(grid, route.coordinates)).toBe(false);
	});

	it('computes long-distance routes around Moorea', () => {
		const apaura = SITE_DEFS.find((s) => s.id === 'apaura')!;
		const maharepa = SITE_DEFS.find((s) => s.id === 'maharepa')!;
		const route = routeWater(
			grid,
			{ id: apaura.id, lat: apaura.lat!, lon: apaura.lon! },
			{ id: maharepa.id, lat: maharepa.lat!, lon: maharepa.lon! }
		);
		expect(route).not.toBeNull();
		if (!route) return;
		// Straight line is ~11 km across mountain, water route around coast is ~22 km
		expect(route.straightKm).toBeLessThan(15);
		expect(route.km).toBeGreaterThan(20);
		expect(crossesLand(grid, route.coordinates)).toBe(false);
		expect(
			crossesLand(grid, [
				[apaura.lat!, apaura.lon!],
				[maharepa.lat!, maharepa.lon!]
			])
		).toBe(true);
	});

	it('computes all nursery routes without crossing land', () => {
		const nurseries = SITE_DEFS.filter(
			(s) => s.island === 'Moorea' && s.kind === 'nursery' && s.lat != null && s.lon != null
		).map((s) => ({ id: s.id, lat: s.lat!, lon: s.lon! }));
		const routes = computeAllNurseryRoutes(nurseries, grid);
		const expectedPairs = (nurseries.length * (nurseries.length - 1)) / 2;
		expect(routes.length).toBe(expectedPairs);
		for (const r of routes) {
			expect(r.km).toBeGreaterThanOrEqual(r.straightKm * 0.99);
			expect(crossesLand(grid, r.coordinates)).toBe(false);
		}
	});

	it('exports valid GeoJSON LineString Feature', () => {
		const haapiti = SITE_DEFS.find((s) => s.id === 'haapiti')!;
		const vaiane = SITE_DEFS.find((s) => s.id === 'vaiane')!;
		const route = routeWater(
			grid,
			{ id: haapiti.id, lat: haapiti.lat!, lon: haapiti.lon! },
			{ id: vaiane.id, lat: vaiane.lat!, lon: vaiane.lon! }
		)!;
		const gj = routeToGeoJson(route);
		expect(gj.type).toBe('Feature');
		expect(gj.geometry.type).toBe('LineString');
		expect(gj.geometry.coordinates[0]).toEqual([haapiti.lon, haapiti.lat]);
		expect(gj.geometry.coordinates[gj.geometry.coordinates.length - 1]).toEqual([
			vaiane.lon,
			vaiane.lat
		]);
	});
});
