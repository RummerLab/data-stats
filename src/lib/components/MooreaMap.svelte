<script lang="ts" module>
	export interface MapPoint {
		id: string;
		label: string;
		lat: number;
		lon: number;
		value?: number | null;
		color?: string;
		href?: string;
		sub?: string;
	}

	/** A straight line between two places, e.g. a shark's move between nurseries. */
	export interface MapLine {
		id: string;
		label: string;
		from: { lat: number; lon: number };
		to: { lat: number; lon: number };
		/** Sets the line width (relative to the largest). */
		value?: number;
		color?: string;
		sub?: string;
	}
</script>

<script lang="ts">
	import outline from '#lib/moorea-outline.json';
	import Tip, { type TipState } from './charts/Tip.svelte';
	import { registerCsv } from './charts/csv';
	import { KEYS_HINT, markAt, markKeys, pointerIn } from './charts/marks';
	import { directedPoints, lineWidth, reversed, shiftFor } from './lineGeometry';

	let {
		points,
		lines = [],
		lineLabel = '',
		valueLabel = '',
		format = (v: number) => String(Math.round(v)),
		showLabels = true,
		maxR = 20,
		csv = true
	}: {
		points: MapPoint[];
		/** Drawn under the circles; width by value. */
		lines?: MapLine[];
		lineLabel?: string;
		valueLabel?: string;
		format?: (v: number) => string;
		showLabels?: boolean;
		maxR?: number;
		/** Offer the points as CSV to the enclosing ChartCard. */
		csv?: boolean;
	} = $props();

	registerCsv(() => ({
		columns: ['name', 'lat', 'lon', valueLabel || 'value'],
		rows: csv ? points.map((p) => [p.label, p.lat, p.lon, p.value]) : []
	}));
	registerCsv(() => ({
		columns: ['line', 'from lat', 'from lon', 'to lat', 'to lon', lineLabel || 'value'],
		rows: csv
			? lines.map((l) => [l.label, l.from.lat, l.from.lon, l.to.lat, l.to.lon, l.value])
			: []
	}));

	let width = $state(640);
	const lat0 = -17.53;
	const k = Math.cos((lat0 * Math.PI) / 180);
	const ring = outline.ring as [number, number][];
	// Generous east–west margin so labels on the outer coast stay inside the frame.
	const lonMin = Math.min(...ring.map((p) => p[0])) - 0.07;
	const lonMax = Math.max(...ring.map((p) => p[0])) + 0.07;
	const latMin = Math.min(...ring.map((p) => p[1])) - 0.025;
	const latMax = Math.max(...ring.map((p) => p[1])) + 0.025;
	const aspect = ((latMax - latMin) / ((lonMax - lonMin) * k)) * 1;
	const h = $derived(Math.round(Math.min(560, width * aspect)));
	const scale = $derived(Math.min(width / ((lonMax - lonMin) * k), h / (latMax - latMin)));
	const ox = $derived((width - (lonMax - lonMin) * k * scale) / 2);
	const px = (lon: number) => ox + (lon - lonMin) * k * scale;
	const py = (lat: number) => (latMax - lat) * scale;
	const path = $derived(
		`M${ring.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join('L')}Z`
	);
	const max = $derived(Math.max(1e-9, ...points.map((p) => p.value ?? 0)));
	const r = (v: number | null | undefined) =>
		v == null ? 6 : 5 + (maxR - 5) * Math.sqrt(Math.max(0, v) / max);
	const sorted = $derived([...points].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)));

	/** Greedy label placement: try nudging up/down, then the other side, to avoid overlaps. */
	const labels = $derived.by(() => {
		const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
		return sorted.map((p) => {
			const x = px(p.lon);
			const y = py(p.lat);
			const rr = r(p.value);
			const w = p.label.length * 6.4 + 4;
			const outward = x > width / 2;
			for (const side of [outward, !outward])
				for (const dy of [0, 12, -12, 22, -22]) {
					const lx = x + (side ? 1 : -1) * (rr + 4);
					const box = {
						x0: side ? lx : lx - w,
						x1: side ? lx + w : lx,
						y0: y + dy - 7,
						y1: y + dy + 7
					};
					const clash = placed.some(
						(b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1
					);
					if (!clash && box.x0 >= 0 && box.x1 <= width) {
						placed.push(box);
						return { id: p.id, label: p.label, x: lx, y: y + dy, anchor: side ? 'start' : 'end' };
					}
				}
			return { id: p.id, label: p.label, x: x + rr + 4, y, anchor: 'start' };
		});
	});

	const lineMax = $derived(Math.max(1e-9, ...lines.map((l) => l.value ?? 1)));
	// Direction arrows (#182): one marker per line colour, in the middle of each line.
	const uid = $props.id();
	const colours = $derived([...new Set(lines.map((l) => l.color ?? 'var(--series-1)'))]);
	const drawn = $derived.by(() => {
		const back = reversed(lines);
		return lines.map((l, i) => {
			const w = lineWidth(l.value, lineMax);
			const pts = directedPoints(
				px(l.from.lon),
				py(l.from.lat),
				px(l.to.lon),
				py(l.to.lat),
				back[i] ? shiftFor(w) : 0
			);
			return {
				line: l,
				w,
				points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
				arrow: colours.indexOf(l.color ?? 'var(--series-1)')
			};
		});
	});

	let tip = $state<TipState | null>(null);
	function showLine(at: { x: number; y: number }, l: MapLine) {
		tip = {
			...at,
			title: l.label,
			lines: [
				...(l.value != null && lineLabel ? [{ label: lineLabel, value: format(l.value) }] : []),
				...(l.sub ? [{ value: l.sub }] : [])
			]
		};
	}
	function show(at: { x: number; y: number }, p: MapPoint) {
		tip = {
			...at,
			title: p.label,
			lines: [
				...(p.value != null ? [{ label: valueLabel, value: format(p.value) }] : []),
				...(p.sub ? [{ value: p.sub }] : [])
			]
		};
	}
	let svg = $state<SVGSVGElement>();
	const keys = markKeys({
		count: () => lines.length + sorted.length,
		show: (i) =>
			markAt(svg, i, (at) => {
				if (i < lines.length) showLine(at, lines[i]);
				else show(at, sorted[i - lines.length]);
			}),
		hide: () => (tip = null),
		href: (i) => sorted[i - lines.length]?.href
	});
</script>

<div class="wrap" bind:clientWidth={width}>
	<svg
		bind:this={svg}
		class="chart-svg"
		viewBox={`0 0 ${width} ${h}`}
		{width}
		height={h}
		{...keys}
		aria-label={`Map of Moorea${valueLabel ? ` showing ${valueLabel}` : ''}. ${KEYS_HINT}`}
		onpointerleave={() => (tip = null)}
	>
		<rect {width} height={h} fill="var(--accent-wash)" rx="10" />
		<path d={path} fill="var(--surface)" stroke="var(--axis)" stroke-width="1" />
		{#if lines.length}
			<defs>
				{#each colours as c, i (c)}
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
						<path d="M0,0 L10,5 L0,10 z" fill={c} stroke="var(--surface)" stroke-width="1" />
					</marker>
				{/each}
			</defs>
		{/if}
		{#each drawn as d, i (d.line.id)}
			<polyline
				points={d.points}
				fill="none"
				stroke={d.line.color ?? 'var(--series-1)'}
				stroke-width={d.w}
				stroke-linecap="round"
				stroke-opacity="0.75"
				marker-mid={`url(#${uid}-arrow-${d.arrow})`}
				role="presentation"
				data-mark={i}
				onpointermove={(e) => showLine(pointerIn(e), d.line)}
			/>
		{/each}
		{#each sorted as p, i (p.id)}
			{@const x = px(p.lon)}
			{@const y = py(p.lat)}
			<svelte:element
				this={p.href ? 'a' : 'g'}
				href={p.href}
				role={p.href ? undefined : 'presentation'}
				aria-label={p.href ? p.label : undefined}
			>
				<circle
					cx={x}
					cy={y}
					r={r(p.value)}
					fill={p.color ?? 'var(--series-1)'}
					fill-opacity="0.78"
					stroke="var(--surface)"
					stroke-width="2"
					role="presentation"
					data-mark={lines.length + i}
					onpointermove={(e) => show(pointerIn(e), p)}
				/>
			</svelte:element>
		{/each}
		{#if showLabels}
			{#each labels as p (p.id)}
				<text
					x={p.x}
					y={p.y}
					dy="0.32em"
					text-anchor={p.anchor === 'start' ? 'start' : 'end'}
					font-size="11"
					font-weight="600"
					fill="var(--ink)"
					stroke="var(--surface)"
					stroke-width="3"
					paint-order="stroke"
					pointer-events="none">{p.label}</text
				>
			{/each}
		{/if}
	</svg>
	<Tip {tip} {width} />
	<p class="attr">Coastline © OpenStreetMap contributors (ODbL)</p>
</div>

<style>
	.wrap {
		position: relative;
		width: 100%;
	}
	svg {
		display: block;
	}
	.attr {
		margin: 4px 0 0;
		font-size: 0.7rem;
		color: var(--muted);
		text-align: right;
	}
</style>
