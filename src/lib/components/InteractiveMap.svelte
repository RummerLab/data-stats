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
		/** Radius in px of the largest sized circle (default 18). */
		maxRadius?: number;
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
	import {
		ARROW_AT,
		lineWidth,
		moveDuration,
		offsetPolyline,
		pointAlongPath,
		polylineArrow,
		reversed,
		shiftFor
	} from './lineGeometry';

	let {
		layers,
		lineLayers = [],
		lineLabel = '',
		density,
		lineMax: fixedLineMax,
		traveller,
		label,
		valueLabel = '',
		format = (v: number) => String(Math.round(v)),
		focus,
		height = 440,
		bounds,
		fallback
	}: {
		layers: MapLayer[];
		/** Lines drawn under the circles, width by value, one toggle per layer. */
		lineLayers?: MapLineLayer[];
		lineLabel?: string;
		/** Drawn under everything else, with its own toggle. */
		density?: MapDensity;
		/** Value that gets the widest line; fix it so widths don't jump as lines are added. */
		lineMax?: number;
		/** A bird's-eye view shark that glides from `from` to `to` along the water route whenever `key` changes (a Play button). */
		traveller?: {
			key: string | number;
			from: { lat: number; lon: number };
			to: { lat: number; lon: number };
			path?: [number, number][];
			km?: number | null;
			color: string;
			species?: string;
			lineId?: string;
			still?: boolean;
		};
		/** Accessible name of the map region. */
		label: string;
		valueLabel?: string;
		format?: (v: number) => string;
		/** Open zoomed on this point instead of fitting all points. */
		focus?: { lat: number; lon: number; zoom?: number };
		height?: number;
		/** Extra coordinates to include in initial fitBounds (e.g. future moves on a stepped shark map). */
		bounds?: [number, number][];
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

	function tooltip(label: string) {
		const span = document.createElement('span');
		span.textContent = label;
		return span;
	}

	// Leaflet paths have pointer handlers but are not keyboard controls by default.
	function keyboardInteractive<T extends import('leaflet').Path>(layer: T, label: string): T {
		const init = () => {
			const el = layer.getElement() as SVGElement | undefined;
			if (!el) return;
			el.setAttribute('tabindex', '0');
			el.setAttribute('role', 'button');
			el.setAttribute('aria-label', label);
			el.onfocus = () => layer.openTooltip();
			el.onblur = () => layer.closeTooltip();
			el.onkeydown = (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					e.stopPropagation();
					if (e.key === 'Enter') layer.openPopup();
				} else if (e.key === 'Escape') {
					layer.closePopup();
					layer.closeTooltip();
				}
			};
			el.onkeyup = (e) => {
				if (e.key === ' ') {
					e.preventDefault();
					e.stopPropagation();
					layer.openPopup();
				}
			};
		};
		layer.on('add', init);
		if (layer.getElement()) init();
		layer.on('popupopen', (e) => {
			const popupEl = (e as unknown as { popup?: import('leaflet').Popup })?.popup?.getElement();
			if (!popupEl) return;
			popupEl.querySelector<HTMLElement>('a[href], button')?.focus();
			const dismiss = (ev: Event) => {
				ev.preventDefault();
				ev.stopPropagation();
				layer.closePopup();
				(layer.getElement() as HTMLElement | undefined)?.focus();
			};
			const closeBtn = popupEl.querySelector<HTMLElement>('.leaflet-popup-close-button');
			if (closeBtn) {
				closeBtn.onclick = dismiss;
				closeBtn.onkeydown = (ev: KeyboardEvent) => {
					if (ev.key === 'Enter' || ev.key === ' ') dismiss(ev);
				};
			}
			popupEl.onkeydown = (ev: KeyboardEvent) => {
				if (ev.key === 'Escape') dismiss(ev);
			};
		});
		return layer;
	}

	function pointLabel(p: MapPoint, unit = valueLabel) {
		const parts = [p.label];
		if (p.value != null && unit) parts.push(`${unit}: ${format(p.value)}`);
		if (p.sub) parts.push(p.sub);
		return parts.join(' · ');
	}

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
	let zoom = $state(0);
	const uid = $props.id();
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
			const all: [number, number][] = [
				...layers.flatMap((l) => l.points.map((p) => [p.lat, p.lon] as [number, number])),
				...lineLayers.flatMap((g) =>
					g.lines.flatMap((l) =>
						l.path && l.path.length > 0
							? l.path
							: ([
									[l.from.lat, l.from.lon],
									[l.to.lat, l.to.lon]
								] as [number, number][])
					)
				),
				...(bounds ?? [])
			];
			if (focus) m.setView([focus.lat, focus.lon], focus.zoom ?? 14);
			else if (all.length) m.fitBounds(L.latLngBounds(all), { padding: [36, 36], maxZoom: 14 });
			else m.setView([-17.53, -149.83], 12);
			// Line offsets are in screen pixels, so redraw them at each zoom (#182).
			m.on('zoomend', () => (zoom = m.getZoom()));
			zoom = m.getZoom();
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
		void zoom;
		if (!m || !L || !el) return;
		const hidden = new Set(
			drawn.flatMap((d) => d.groups.filter((g) => !m.hasLayer(g.group)).map((g) => g.key))
		);
		for (const d of drawn) {
			d.groups.forEach((g) => g.group.remove());
			d.control.remove();
		}
		const overlays: Record<string, import('leaflet').LayerGroup> = {};
		const lineMax =
			fixedLineMax ??
			Math.max(1e-9, ...currentLines.flatMap((g) => g.lines.map((l) => l.value ?? 1)));
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
		// Direction (#182): an arrow mid-line; a move drawn both ways splits into two parallel lines.
		const back = reversed(currentLines.flatMap((g) => g.lines));
		let n = 0;
		const lineEntries: {
			l: MapLine;
			line: import('leaflet').Polyline;
			arrow: import('leaflet').Polyline;
		}[] = [];
		const lineGroups = currentLines.map((g, i) => {
			const group = L.layerGroup();
			for (const l of g.lines) {
				const weight = lineWidth(l.value, lineMax);
				const rawPts: [number, number][] = l.path
					? l.path.map(([lat, lon]) => {
							const pt = m.latLngToLayerPoint([lat, lon]);
							return [pt.x, pt.y];
						})
					: [
							(() => {
								const pt = m.latLngToLayerPoint([l.from.lat, l.from.lon]);
								return [pt.x, pt.y];
							})(),
							(() => {
								const pt = m.latLngToLayerPoint([l.to.lat, l.to.lon]);
								return [pt.x, pt.y];
							})()
						];
				const shiftedPts = offsetPolyline(rawPts, back[n++] ? shiftFor(weight) : 0);
				const latLngs = shiftedPts.map(([x, y]) => m.layerPointToLatLng([x, y]));
				const line = L.polyline(latLngs, {
					weight,
					className: `ps-line ps-line-${i}`,
					lineCap: 'round',
					smoothFactor: 0
				});
				keyboardInteractive(line, l.label)
					.bindTooltip(tooltip(l.label))
					.bindPopup(() => popup(l, lineLabel))
					.addTo(group);
				const arrowLatLngs = polylineArrow(shiftedPts).map(([x, y]) =>
					m.layerPointToLatLng([x, y])
				);
				const arrow = L.polyline(arrowLatLngs, {
					stroke: false,
					interactive: false,
					className: `ps-arrow ps-arrow-${i}`,
					smoothFactor: 0,
					noClip: true
				});
				arrow.on('add', () =>
					arrow.getElement()?.setAttribute('marker-mid', `url(#${uid}-arrow-${i})`)
				);
				arrow.addTo(group);
				lineEntries.push({ l, line, arrow });
			}
			const key = `line:${i}`;
			if (!hidden.has(key)) group.addTo(m);
			overlays[`<span class="ps-key ps-line-key ps-line-${i}"></span>${g.name}`] = group;
			return { key, group };
		});
		currentLineEntries = lineEntries;
		const groups = current.map((layer, i) => {
			const max = layer.max ?? Math.max(1e-9, ...layer.points.map((p) => p.value ?? 0));
			const group = L.layerGroup();
			for (const p of layer.points) {
				const empty = layer.sized && p.value == null;
				const r = empty
					? 5
					: layer.sized
						? 5 +
							((layer.maxRadius ?? 18) - 5) *
								Math.sqrt(Math.min(1, Math.max(0, p.value ?? 0) / max))
						: (layer.radius ?? 5);
				const marker = L.circleMarker([p.lat, p.lon], {
					radius: r,
					className: `ps-layer ps-layer-${i}${empty ? ' ps-empty' : ''}`
				});
				keyboardInteractive(marker, pointLabel(p))
					.bindTooltip(tooltip(p.label))
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

	// Glide a bird's-eye view shark and animate the move line along the water route (#183).
	let dot: import('leaflet').Marker | undefined;
	let currentLineEntries: {
		l: MapLine;
		line: import('leaflet').Polyline;
		arrow: import('leaflet').Polyline;
	}[] = [];
	$effect(() => {
		const m = map;
		const L = leaflet;
		const t = traveller;
		if (!m || !L) return;
		dot?.remove();
		dot = undefined;
		if (!t) return;
		const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const still = reducedMotion || Boolean(t.still);
		const path: [number, number][] =
			t.path && t.path.length >= 2
				? t.path
				: [
						[t.from.lat, t.from.lon],
						[t.to.lat, t.to.lon]
					];
		const at = (f: number): [number, number] => pointAlongPath(path, f);

		// Compute initial heading angle (degrees clockwise from North).
		let initialHeading = 0;
		if (path.length >= 2) {
			const refIdx = still ? path.length - 1 : 0;
			const p1 = m.latLngToLayerPoint(still ? path[Math.max(0, refIdx - 1)] : path[0]);
			const p2 = m.latLngToLayerPoint(still ? path[refIdx] : path[Math.min(path.length - 1, 1)]);
			const dx = p2.x - p1.x;
			const dy = p2.y - p1.y;
			if (dx !== 0 || dy !== 0) {
				initialHeading = Math.atan2(dx, -dy) * (180 / Math.PI);
			}
		}

		const isBlacktip = t.species !== 'Na';
		const tipColor = isBlacktip ? '#0f172a' : '#92400e';
		const sharkHtml = `
			<div class="ps-shark-wrap" style="transform: rotate(${initialHeading}deg)">
				<svg class="ps-shark-svg" viewBox="0 0 32 46" width="32" height="46" fill="none" xmlns="http://www.w3.org/2000/svg">
					<g class="ps-shark-body">
						<path d="M16 2 C13 5 10 10 10 15 C6 17 1 20 2 23 C3 25 7 24 11 23 C11 26 12 28 13 30 C10 31 8 33 9 35 C11 35 13 34 14 33 C14 36 15 38 15 42 L17 42 C17 38 18 36 18 33 C19 34 21 35 23 35 C24 33 22 31 19 30 C20 28 21 26 21 23 C25 24 29 25 30 23 C31 20 26 17 22 15 C22 10 19 5 16 2 Z"
							fill="${t.color}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
						${
							isBlacktip
								? `
							<path d="M2 23 C1 20 4 18 5 19 C3 21 3 23 2 23 Z" fill="${tipColor}"/>
							<path d="M30 23 C31 20 28 18 27 19 C29 21 29 23 30 23 Z" fill="${tipColor}"/>
						`
								: ''
						}
						<path d="M16 13 L16 27" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
						<path d="M16 14 L16 26" stroke="${tipColor}" stroke-width="1.2" stroke-linecap="round"/>
						<circle cx="12" cy="7" r="1.1" fill="#ffffff"/>
						<circle cx="12" cy="7" r="0.7" fill="#0f172a"/>
						<circle cx="20" cy="7" r="1.1" fill="#ffffff"/>
						<circle cx="20" cy="7" r="0.7" fill="#0f172a"/>
					</g>
					<g class="ps-shark-tail" style="transform-origin: 16px 33px;">
						<path d="M16 33 C15.2 36 14.8 39 14 41 C13.5 43 14.5 45 16 45 C17.5 45 18.5 43 18 41 C17.2 39 16.8 36 16 33 Z"
							fill="${t.color}" stroke="#ffffff" stroke-width="1.2"/>
						${isBlacktip ? `<path d="M14 43 C15 45 17 45 18 43 L16 45 Z" fill="${tipColor}"/>` : ''}
					</g>
				</svg>
			</div>
		`;

		const marker = L.marker(at(still ? 1 : 0), {
			icon: L.divIcon({
				className: 'ps-traveller ps-shark-marker',
				html: sharkHtml,
				iconSize: [32, 46],
				iconAnchor: [16, 23]
			}),
			interactive: false
		}).addTo(m);
		dot = marker;
		if (still) return;

		// Locate the move line matching this traveller step to progressively draw its stroke.
		const target = currentLineEntries.find(
			(e) =>
				(t.lineId && (e.l as { id?: string }).id === t.lineId) ||
				(Math.abs(e.l.from.lat - t.from.lat) < 1e-4 &&
					Math.abs(e.l.from.lon - t.from.lon) < 1e-4 &&
					Math.abs(e.l.to.lat - t.to.lat) < 1e-4 &&
					Math.abs(e.l.to.lon - t.to.lon) < 1e-4)
		);
		let lineEl = target?.line.getElement() as SVGPathElement | undefined;
		let arrowEl = target?.arrow.getElement() as SVGPathElement | undefined;
		let totalLen = lineEl?.getTotalLength ? lineEl.getTotalLength() : 0;

		// Progressive stroke animation along the water route polyline.
		if (lineEl && totalLen > 0) {
			lineEl.style.strokeDasharray = `${totalLen} ${totalLen}`;
			lineEl.style.strokeDashoffset = `${totalLen}`;
			if (arrowEl) arrowEl.style.opacity = '0';
		}

		const start = performance.now();
		let frame = 0;
		const duration = moveDuration(t.km);
		const step = (now: number) => {
			const f = Math.min(1, (now - start) / duration);
			const eased = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;

			// Re-anchor if zoom redraw replaced elements during animation.
			if (target && (!lineEl || !lineEl.isConnected)) {
				lineEl = target.line.getElement() as SVGPathElement | undefined;
				arrowEl = target.arrow.getElement() as SVGPathElement | undefined;
				totalLen = lineEl?.getTotalLength ? lineEl.getTotalLength() : 0;
				if (lineEl && totalLen > 0) {
					lineEl.style.strokeDasharray = `${totalLen} ${totalLen}`;
				}
			}

			let heading = initialHeading;
			if (lineEl && totalLen > 0) {
				lineEl.style.strokeDashoffset = `${totalLen * (1 - eased)}`;
				if (arrowEl) arrowEl.style.opacity = f >= ARROW_AT ? '1' : '0';
				if (lineEl.getPointAtLength) {
					const curLen = totalLen * eased;
					const pt = lineEl.getPointAtLength(curLen);
					marker.setLatLng(m.layerPointToLatLng([pt.x, pt.y]));

					const ahead = lineEl.getPointAtLength(Math.min(totalLen, curLen + 3));
					const behind = lineEl.getPointAtLength(Math.max(0, curLen - 3));
					const dx = ahead.x - behind.x;
					const dy = ahead.y - behind.y;
					if (dx !== 0 || dy !== 0) {
						heading = Math.atan2(dx, -dy) * (180 / Math.PI);
					}
				} else {
					marker.setLatLng(at(eased));
				}
			} else {
				marker.setLatLng(at(eased));
			}

			const wrapEl = (marker.getElement() as HTMLElement | undefined)?.querySelector(
				'.ps-shark-wrap'
			) as HTMLElement | null;
			const tailEl = (marker.getElement() as HTMLElement | undefined)?.querySelector(
				'.ps-shark-tail'
			) as HTMLElement | null;
			if (wrapEl) {
				const bodyWiggle = f < 1 ? Math.sin((now - start) * 0.018) * 4 : 0;
				wrapEl.style.transform = `rotate(${heading + bodyWiggle}deg)`;
			}
			if (tailEl) {
				const tailWiggle = f < 1 ? Math.sin((now - start) * 0.018 - 1.2) * 12 : 0;
				tailEl.style.transform = `rotate(${tailWiggle}deg)`;
			}

			if (f < 1) {
				frame = requestAnimationFrame(step);
			} else {
				if (lineEl) {
					lineEl.style.strokeDasharray = '';
					lineEl.style.strokeDashoffset = '';
				}
				if (arrowEl) arrowEl.style.opacity = '';
			}
		};
		frame = requestAnimationFrame(step);
		return () => {
			cancelAnimationFrame(frame);
			if (lineEl) {
				lineEl.style.strokeDasharray = '';
				lineEl.style.strokeDashoffset = '';
			}
			if (arrowEl) {
				arrowEl.style.opacity = '';
			}
		};
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
	{#if lineLayers.length}
		<svg class="defs" aria-hidden="true">
			<defs>
				{#each lineLayers as g, i (i)}
					<marker
						id={`${uid}-arrow-${i}`}
						viewBox="0 0 10 10"
						refX="5"
						refY="5"
						markerWidth="16"
						markerHeight="16"
						markerUnits="userSpaceOnUse"
						orient="auto"
					>
						<path d="M0,0 L10,5 L0,10 z" fill={g.color} stroke="#fff" stroke-width="1" />
					</marker>
				{/each}
			</defs>
		</svg>
	{/if}
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
	.defs {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
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
	.map :global(.ps-traveller) {
		stroke: #fff;
		stroke-width: 2px;
		fill-opacity: 1;
	}
	.map :global(.ps-shark-marker) {
		background: transparent !important;
		border: none !important;
	}
	.map :global(.ps-shark-wrap) {
		width: 32px;
		height: 46px;
		transform-origin: 16px 23px;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.7));
		pointer-events: none;
		will-change: transform;
	}
	.map :global(.ps-shark-tail) {
		transform-origin: 16px 33px;
		will-change: transform;
	}
	.map :global(.leaflet-interactive.ps-line) {
		stroke-opacity: 0.75;
	}
	.map :global(.ps-line:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 4px;
	}
	.map :global(.ps-layer:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
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
