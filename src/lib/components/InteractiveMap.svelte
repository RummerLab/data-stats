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
		/** A dot that glides from `from` to `to` along the water route whenever `key` changes (a Play button). */
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
			fraction?: number;
			playing?: boolean;
			showAll?: boolean;
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
			// The close button is also an <a href>, so look inside the body only. Without a link or
			// button there, focus the content so the details are still read out (adult captures).
			const content = popupEl.querySelector<HTMLElement>('.leaflet-popup-content');
			let target = content?.querySelector<HTMLElement>('a[href], button') ?? null;
			if (!target && content) {
				content.tabIndex = -1;
				target = content;
			}
			if (target) focusSoon(target, document.activeElement);
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

	// Leaflet hides the popup body while it lays the popup out, so focusing it straight from
	// popupopen can land while it is still visibility: hidden and be ignored. Retry for a few
	// frames, but stop as soon as focus has moved somewhere else (the user tabbed or clicked).
	function focusSoon(target: HTMLElement, from: Element | null) {
		const attempt = (tries: number) => {
			if (!target.isConnected) return;
			target.focus();
			if (document.activeElement === target) return;
			const active = document.activeElement;
			if (active && active !== from && active !== document.body) return;
			if (tries > 1) requestAnimationFrame(() => attempt(tries - 1));
		};
		attempt(30);
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
	let lastLayerKey = '';
	$effect(() => {
		const m = map;
		const L = leaflet;
		const current = layers;
		const currentLines = lineLayers;
		const currentDensity = density;
		void zoom;
		if (!m || !L || !el) return;

		const layerKey = `${current.map((l) => `${l.name}:${l.points.length}`).join('|')}_${currentLines.map((g) => `${g.name}:${g.lines.map((l) => (l as { id?: string }).id ?? l.label).join(',')}`).join('|')}_${currentDensity?.name ?? ''}_${zoom}`;
		if (drawn.length && layerKey === lastLayerKey) return;
		lastLayerKey = layerKey;

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
				L.polyline(latLngs, {
					weight: Math.max(1.5, weight - 1),
					className: `ps-line-track ps-line-track-${i}`,
					smoothFactor: 0,
					interactive: false
				}).addTo(group);
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

	// Glide a dot and animate the move line along the water route (#183).
	let dot: import('leaflet').CircleMarker | undefined;
	let lastLineEl: SVGPathElement | undefined;
	let lastArrowEl: SVGPathElement | undefined;
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
		if (!t) {
			dot?.remove();
			dot = undefined;
			if (lastLineEl) {
				lastLineEl.style.strokeDasharray = '';
				lastLineEl.style.strokeDashoffset = '';
			}
			for (const entry of currentLineEntries) {
				const aEl = entry.arrow.getElement() as SVGPathElement | null;
				if (aEl) aEl.style.opacity = '';
			}
			lastLineEl = undefined;
			lastArrowEl = undefined;
			return;
		}

		// When showing all moves overview, display all lines solid with their arrows, without a traveller dot (#183).
		if (t.showAll) {
			dot?.remove();
			dot = undefined;
			if (el) {
				const lines = el.querySelectorAll<SVGPathElement>('.ps-line');
				lines.forEach((l) => {
					l.style.strokeDasharray = '';
					l.style.strokeDashoffset = '';
				});
				const arrows = el.querySelectorAll<SVGPathElement>('.ps-arrow');
				arrows.forEach((a) => {
					a.style.opacity = '1';
				});
			}
			for (const entry of currentLineEntries) {
				const lEl = entry.line.getElement() as SVGPathElement | null;
				if (lEl) {
					lEl.style.strokeDasharray = '';
					lEl.style.strokeDashoffset = '';
				}
				const aEl = entry.arrow.getElement() as SVGPathElement | null;
				if (aEl) aEl.style.opacity = '1';
			}
			lastLineEl = undefined;
			lastArrowEl = undefined;
			return;
		}
		const still = Boolean(t.still);
		const path: [number, number][] =
			t.path && t.path.length >= 2
				? t.path
				: [
						[t.from.lat, t.from.lon],
						[t.to.lat, t.to.lon]
					];
		const at = (f: number): [number, number] => pointAlongPath(path, f);

		if (!dot) {
			dot = L.circleMarker(at(still ? 1 : 0), {
				radius: 7,
				className: 'ps-traveller',
				interactive: false
			}).addTo(m);
		}
		dot.setStyle({ fillColor: t.color, color: '#ffffff' });

		// Locate the move line matching this traveller step to progressively draw its stroke.
		const target = currentLineEntries.find(
			(e) =>
				(t.lineId && (e.l as { id?: string }).id === t.lineId) ||
				(Math.abs(e.l.from.lat - t.from.lat) < 1e-4 &&
					Math.abs(e.l.from.lon - t.from.lon) < 1e-4 &&
					Math.abs(e.l.to.lat - t.to.lat) < 1e-4 &&
					Math.abs(e.l.to.lon - t.to.lon) < 1e-4)
		);
		let lineEl = (target?.line.getElement() ??
			(el?.querySelector('.ps-line') as SVGPathElement | null)) as SVGPathElement | undefined;
		let arrowEl = (target?.arrow.getElement() ??
			(el?.querySelector('path[marker-mid]') as SVGPathElement | null)) as
			SVGPathElement | undefined;
		if (lastLineEl && lastLineEl !== lineEl) {
			lastLineEl.style.strokeDasharray = '';
			lastLineEl.style.strokeDashoffset = '';
		}
		if (lastArrowEl && lastArrowEl !== arrowEl) {
			lastArrowEl.style.opacity = '0';
		}
		lastLineEl = lineEl;
		lastArrowEl = arrowEl;
		let totalLen = lineEl?.getTotalLength ? lineEl.getTotalLength() : 0;

		// When fraction is explicitly passed (continuous scrubbing or smooth external RAF loop):
		if (t.fraction != null) {
			const f = still ? 1 : Math.max(0, Math.min(1, t.fraction));
			if (lineEl && totalLen > 0) {
				if (f >= 1) {
					lineEl.style.strokeDasharray = '';
					lineEl.style.strokeDashoffset = '';
				} else {
					lineEl.style.strokeDasharray = `${totalLen} ${totalLen}`;
					lineEl.style.strokeDashoffset = `${totalLen * (1 - f)}`;
				}
			}

			// Keep arrow visible on dotted line before playback/scrubbing starts; hide once playing or moving (#183).
			const showArrow = !t.playing && f < 0.01;
			for (const entry of currentLineEntries) {
				const aEl = entry.arrow.getElement() as SVGPathElement | null;
				if (aEl) {
					aEl.style.opacity = showArrow && entry === target ? '1' : '0';
				}
			}

			if (lineEl && totalLen > 0 && lineEl.getPointAtLength) {
				const pt = lineEl.getPointAtLength(totalLen * f);
				dot.setLatLng(m.layerPointToLatLng([pt.x, pt.y]));
			} else {
				dot.setLatLng(at(f));
			}
			return;
		}

		// Fallback self-driven RAF animation when fraction is omitted:
		if (still) return;

		for (const entry of currentLineEntries) {
			const aEl = entry.arrow.getElement() as SVGPathElement | null;
			if (aEl) aEl.style.opacity = '0';
		}

		if (lineEl && totalLen > 0) {
			lineEl.style.strokeDasharray = `${totalLen} ${totalLen}`;
			lineEl.style.strokeDashoffset = `${totalLen}`;
		}

		const start = performance.now();
		let frame = 0;
		const duration = moveDuration(t.km);
		const marker = dot;
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

			if (lineEl && totalLen > 0) {
				lineEl.style.strokeDashoffset = `${totalLen * (1 - eased)}`;
				if (lineEl.getPointAtLength) {
					const pt = lineEl.getPointAtLength(totalLen * eased);
					marker.setLatLng(m.layerPointToLatLng([pt.x, pt.y]));
				} else {
					marker.setLatLng(at(eased));
				}
			} else {
				marker.setLatLng(at(eased));
			}

			if (f < 1) {
				frame = requestAnimationFrame(step);
			} else {
				if (lineEl) {
					lineEl.style.strokeDasharray = '';
					lineEl.style.strokeDashoffset = '';
				}
				if (arrowEl) arrowEl.style.opacity = '0';
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
				arrowEl.style.opacity = '0';
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
		stroke: #ffffff;
		stroke-width: 2.5px;
		fill-opacity: 1;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
	}
	.map :global(.leaflet-interactive.ps-line) {
		stroke-opacity: 0.75;
	}
	.map :global(.ps-line-track) {
		stroke: var(--ps-line-0, #2563eb);
		stroke-opacity: 0.6;
		stroke-dasharray: 4 4;
		pointer-events: none;
	}
	.map :global(.ps-line-track-0) {
		stroke: var(--ps-line-0, #2563eb);
	}
	.map :global(.ps-line-track-1) {
		stroke: var(--ps-line-1, #ea580c);
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
