<script lang="ts" module>
	import type { MapLine, MapPoint } from './MooreaMap.svelte';

	/** A density surface as grid cells, coloured on the sequential scale by `bin` (1–5). */
	export interface MapDensity {
		name: string;
		cells: { south: number; west: number; north: number; east: number; bin: number }[];
	}

	export interface MapLineLayer {
		name: string;
		/** CSS colour, applied through CSS so it follows the theme. */
		color: string;
		lines: MapLine[];
	}

	export interface MapLayer {
		name: string;
		/** CSS colour, e.g. var(--series-1); applied through CSS so it follows the theme. */
		color: string;
		points: MapPoint[];
		/** Size circles by `value` (area-proportional) or use a fixed radius. */
		sized?: boolean;
		/** Fixed radius in px when not sized (default 5). */
		radius?: number;
		/** Value that gets the largest circle; fix it to keep sizes comparable as points change. */
		max?: number;
	}

	/** Base maps (#29). Hosts must match img-src in vite.config.ts. */
	const BASEMAPS = [
		{
			name: 'Satellite',
			url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			attribution:
				'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
			maxZoom: 18
		},
		{
			name: 'Map',
			url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
			attribution:
				'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19
		}
	];
</script>

<script lang="ts">
	import 'leaflet/dist/leaflet.css';
	import { onMount, tick } from 'svelte';
	import MooreaMap from './MooreaMap.svelte';
	import { registerCsv } from './charts/csv';

	let {
		layers,
		lineLayers = [],
		lineLabel = '',
		density,
		label,
		valueLabel = '',
		format = (v: number) => String(Math.round(v)),
		focus,
		height = 440,
		fallback
	}: {
		layers: MapLayer[];
		/** Lines drawn under the circles, width by value, one toggle per layer. */
		lineLayers?: MapLineLayer[];
		lineLabel?: string;
		/** Drawn under everything else, with its own toggle. */
		density?: MapDensity;
		/** Accessible name of the map region. */
		label: string;
		valueLabel?: string;
		format?: (v: number) => string;
		/** Open zoomed on this point instead of fitting all points. */
		focus?: { lat: number; lon: number; zoom?: number };
		height?: number;
		/** Points for the server-rendered SVG map shown before Leaflet loads (default: first layer). */
		fallback?: MapPoint[];
	} = $props();

	registerCsv(() => ({
		columns: ['layer', 'name', 'lat', 'lon', valueLabel || 'value'],
		rows: layers.flatMap((l) => l.points.map((p) => [l.name, p.label, p.lat, p.lon, p.value]))
	}));
	registerCsv(() => ({
		columns: ['layer', 'line', 'from lat', 'from lon', 'to lat', 'to lon', lineLabel || 'value'],
		rows: lineLayers.flatMap((g) =>
			g.lines.map((l) => [g.name, l.label, l.from.lat, l.from.lon, l.to.lat, l.to.lon, l.value])
		)
	}));

	let el = $state<HTMLDivElement>();
	let ready = $state(false);

	function popup(p: MapPoint | MapLine, unit = valueLabel) {
		const href = 'href' in p ? p.href : undefined;
		const box = document.createElement('div');
		const title = document.createElement(href ? 'a' : 'strong');
		title.textContent = p.label;
		if (href) (title as HTMLAnchorElement).href = href;
		box.append(title);
		for (const line of [
			p.value != null && unit ? `${unit}: ${format(p.value)}` : null,
			p.sub ?? null
		]) {
			if (!line) continue;
			const div = document.createElement('div');
			div.textContent = line;
			box.append(div);
		}
		return box;
	}

	let map = $state.raw<import('leaflet').Map>();
	let leaflet: typeof import('leaflet') | undefined;
	let drawn: {
		groups: { key: string; group: import('leaflet').LayerGroup }[];
		control: import('leaflet').Control.Layers;
	}[] = [];
	let bases: Record<string, import('leaflet').TileLayer> = {};

	onMount(() => {
		let cancelled = false;
		(async () => {
			const mod = await import('leaflet');
			const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
			if (cancelled) return;
			ready = true;
			await tick();
			if (!el || cancelled) return;
			leaflet = L;
			// Reduced motion (#32): jump instead of animating zooms and fades.
			const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
			const m = L.map(el, {
				scrollWheelZoom: false,
				zoomSnap: 0.5,
				zoomAnimation: !still,
				fadeAnimation: !still,
				markerZoomAnimation: !still
			});
			bases = Object.fromEntries(
				BASEMAPS.map((b) => [
					b.name,
					L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom })
				])
			);
			bases[BASEMAPS[0].name].addTo(m);
			const all = layers.flatMap((l) => l.points.map((p) => [p.lat, p.lon] as [number, number]));
			if (focus) m.setView([focus.lat, focus.lon], focus.zoom ?? 14);
			else if (all.length) m.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 14 });
			else m.setView([-17.53, -149.83], 12);
			map = m;
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});

	// Redraw the overlays whenever the layers change (e.g. a season slider), keeping the view.
	$effect(() => {
		const m = map;
		const L = leaflet;
		const current = layers;
		const currentLines = lineLayers;
		const currentDensity = density;
		if (!m || !L || !el) return;
		const hidden = new Set(
			drawn.flatMap((d) => d.groups.filter((g) => !m.hasLayer(g.group)).map((g) => g.key))
		);
		for (const d of drawn) {
			d.groups.forEach((g) => g.group.remove());
			d.control.remove();
		}
		const overlays: Record<string, import('leaflet').LayerGroup> = {};
		const lineMax = Math.max(
			1e-9,
			...currentLines.flatMap((g) => g.lines.map((l) => l.value ?? 1))
		);
		const densityGroups = currentDensity
			? [
					(() => {
						const group = L.layerGroup();
						for (const c of currentDensity.cells)
							L.rectangle(
								[
									[c.south, c.west],
									[c.north, c.east]
								],
								{ stroke: false, interactive: false, className: `ps-dens ps-dens-${c.bin}` }
							).addTo(group);
						const key = 'density';
						if (!hidden.has(key)) group.addTo(m);
						overlays[`<span class="ps-key ps-dens-key"></span>${currentDensity.name}`] = group;
						return { key, group };
					})()
				]
			: [];
		const lineGroups = currentLines.map((g, i) => {
			const group = L.layerGroup();
			for (const l of g.lines)
				L.polyline(
					[
						[l.from.lat, l.from.lon],
						[l.to.lat, l.to.lon]
					],
					{
						weight: 1.5 + 6 * Math.sqrt((l.value ?? 1) / lineMax),
						className: `ps-line ps-line-${i}`,
						lineCap: 'round'
					}
				)
					.bindTooltip(l.label)
					.bindPopup(() => popup(l, lineLabel))
					.addTo(group);
			const key = `line:${i}`;
			if (!hidden.has(key)) group.addTo(m);
			overlays[`<span class="ps-key ps-line-key ps-line-${i}"></span>${g.name}`] = group;
			return { key, group };
		});
		const groups = current.map((layer, i) => {
			const max = layer.max ?? Math.max(1e-9, ...layer.points.map((p) => p.value ?? 0));
			const group = L.layerGroup();
			for (const p of layer.points) {
				const empty = layer.sized && p.value == null;
				const r = empty
					? 5
					: layer.sized
						? 5 + 13 * Math.sqrt(Math.min(1, Math.max(0, p.value ?? 0) / max))
						: (layer.radius ?? 5);
				L.circleMarker([p.lat, p.lon], {
					radius: r,
					className: `ps-layer ps-layer-${i}${empty ? ' ps-empty' : ''}`
				})
					.bindTooltip(p.label)
					.bindPopup(() => popup(p))
					.addTo(group);
			}
			const key = `layer:${i}`;
			if (!hidden.has(key)) group.addTo(m);
			overlays[`<span class="ps-key ps-layer-${i}"></span>${layer.name}`] = group;
			return { key, group };
		});
		const control = L.control
			.layers(
				bases,
				current.length + currentLines.length + densityGroups.length > 1 ? overlays : {},
				{
					collapsed: el.clientWidth < 560
				}
			)
			.addTo(m);
		drawn = [{ groups: [...densityGroups, ...lineGroups, ...groups], control }];
	});

	const style = $derived(
		[
			...layers.map((l, i) => `--ps-layer-${i}: ${l.color}`),
			...lineLayers.map((l, i) => `--ps-line-${i}: ${l.color}`)
		].join('; ')
	);
</script>

{#if ready}
	<div
		class="map"
		bind:this={el}
		role="region"
		aria-label={label}
		style={`${style}; height: ${height}px`}
	></div>
	<p class="hint">Drag to pan, use + / − to zoom. Select a circle for details.</p>
{:else}
	<MooreaMap
		points={fallback ?? layers[0]?.points ?? []}
		lines={lineLayers.flatMap((g) => g.lines.map((l) => ({ ...l, color: g.color })))}
		{lineLabel}
		{valueLabel}
		{format}
		csv={false}
	/>
{/if}

<style>
	.map {
		width: 100%;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--hairline);
		background: var(--surface-2);
		font: inherit;
		z-index: 0;
	}
	.hint {
		margin: 6px 0 0;
		font-size: 0.78rem;
		color: var(--muted);
	}
	@media (max-width: 640px) {
		.map {
			height: 340px !important;
		}
	}
	.map :global(.leaflet-interactive.ps-layer) {
		stroke: #fff;
		stroke-width: 1.5px;
		fill-opacity: 0.85;
	}
	.map :global(.leaflet-control-layers) {
		font: inherit;
		font-size: 0.8rem;
		color: #13213a;
	}
	.map :global(.leaflet-interactive.ps-layer.ps-empty) {
		fill: transparent;
		stroke: var(--muted);
		stroke-dasharray: 2 2;
	}
	.map :global(.ps-key) {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin: 0 6px 0 2px;
		vertical-align: -1px;
	}
	.map :global(.leaflet-popup-content) {
		font: inherit;
		font-size: 0.85rem;
		color: #13213a;
		display: grid;
		gap: 2px;
	}
	.map :global(.leaflet-popup-content a) {
		font-weight: 650;
		color: #1d5fb8;
	}
	.map :global(.ps-dens) {
		fill-opacity: 0.6;
	}
	.map :global(.ps-dens-1) {
		fill: var(--seq-2);
	}
	.map :global(.ps-dens-2) {
		fill: var(--seq-3);
	}
	.map :global(.ps-dens-3) {
		fill: var(--seq-4);
	}
	.map :global(.ps-dens-4) {
		fill: var(--seq-5);
	}
	.map :global(.ps-dens-5) {
		fill: var(--seq-6);
	}
	.map :global(.ps-dens-key) {
		border-radius: 2px;
		background: linear-gradient(90deg, var(--seq-2), var(--seq-6));
	}
	.map :global(.leaflet-interactive.ps-line) {
		stroke-opacity: 0.75;
	}
	.map :global(.ps-line-key) {
		border-radius: 2px;
		height: 4px;
		vertical-align: 2px;
	}
	.map :global(.ps-line-0) {
		stroke: var(--ps-line-0);
		background: var(--ps-line-0);
	}
	.map :global(.ps-line-1) {
		stroke: var(--ps-line-1);
		background: var(--ps-line-1);
	}
	.map :global(.ps-layer-0) {
		fill: var(--ps-layer-0);
		background: var(--ps-layer-0);
	}
	.map :global(.ps-layer-1) {
		fill: var(--ps-layer-1);
		background: var(--ps-layer-1);
	}
	.map :global(.ps-layer-2) {
		fill: var(--ps-layer-2);
		background: var(--ps-layer-2);
	}
</style>
