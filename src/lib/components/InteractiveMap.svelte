<script lang="ts" module>
	import type { MapPoint } from './MooreaMap.svelte';

	export interface MapLayer {
		name: string;
		/** CSS colour, e.g. var(--series-1); applied through CSS so it follows the theme. */
		color: string;
		points: MapPoint[];
		/** Size circles by `value` (area-proportional) or use a fixed radius. */
		sized?: boolean;
		/** Fixed radius in px when not sized (default 5). */
		radius?: number;
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
		label,
		valueLabel = '',
		format = (v: number) => String(Math.round(v)),
		focus,
		height = 440,
		fallback
	}: {
		layers: MapLayer[];
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

	let el = $state<HTMLDivElement>();
	let ready = $state(false);

	function popup(p: MapPoint) {
		const box = document.createElement('div');
		const title = document.createElement(p.href ? 'a' : 'strong');
		title.textContent = p.label;
		if (p.href) (title as HTMLAnchorElement).href = p.href;
		box.append(title);
		for (const line of [
			p.value != null && valueLabel ? `${valueLabel}: ${format(p.value)}` : null,
			p.sub ?? null
		]) {
			if (!line) continue;
			const div = document.createElement('div');
			div.textContent = line;
			box.append(div);
		}
		return box;
	}

	onMount(() => {
		let map: import('leaflet').Map | undefined;
		let cancelled = false;
		(async () => {
			const mod = await import('leaflet');
			const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
			if (cancelled) return;
			ready = true;
			await tick();
			if (!el || cancelled) return;
			// Reduced motion (#32): jump instead of animating zooms and fades.
			const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
			map = L.map(el, {
				scrollWheelZoom: false,
				zoomSnap: 0.5,
				zoomAnimation: !still,
				fadeAnimation: !still,
				markerZoomAnimation: !still
			});
			const bases = Object.fromEntries(
				BASEMAPS.map((b) => [
					b.name,
					L.tileLayer(b.url, { attribution: b.attribution, maxZoom: b.maxZoom })
				])
			);
			bases[BASEMAPS[0].name].addTo(map);
			const overlays: Record<string, import('leaflet').LayerGroup> = {};
			const all: [number, number][] = [];
			layers.forEach((layer, i) => {
				const max = Math.max(1e-9, ...layer.points.map((p) => p.value ?? 0));
				const group = L.layerGroup();
				for (const p of layer.points) {
					const r = layer.sized
						? 5 + 13 * Math.sqrt(Math.max(0, p.value ?? 0) / max)
						: (layer.radius ?? 5);
					const tooltip = document.createElement('span');
					tooltip.textContent = p.label;
					L.circleMarker([p.lat, p.lon], { radius: r, className: `ps-layer ps-layer-${i}` })
						.bindTooltip(tooltip)
						.bindPopup(() => popup(p))
						.addTo(group);
					all.push([p.lat, p.lon]);
				}
				group.addTo(map!);
				overlays[`<span class="ps-key ps-layer-${i}"></span>${layer.name}`] = group;
			});
			L.control
				.layers(bases, layers.length > 1 ? overlays : {}, { collapsed: el.clientWidth < 560 })
				.addTo(map);
			if (focus) map.setView([focus.lat, focus.lon], focus.zoom ?? 14);
			else if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 14 });
			else map.setView([-17.53, -149.83], 12);
		})();
		return () => {
			cancelled = true;
			map?.remove();
		};
	});

	const style = $derived(layers.map((l, i) => `--ps-layer-${i}: ${l.color}`).join('; '));
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
	<MooreaMap points={fallback ?? layers[0]?.points ?? []} {valueLabel} {format} csv={false} />
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
