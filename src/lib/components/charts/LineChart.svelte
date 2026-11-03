<script lang="ts" module>
	export interface LineSeries {
		name: string;
		color: string;
		points: { x: number; y: number | null }[];
		dashed?: boolean;
		area?: boolean;
		dots?: boolean;
	}
</script>

<script lang="ts">
	import { isoDay, registerCsv } from './csv';
	import { compact } from '#lib/format';
	import Legend from './Legend.svelte';
	import Tip, { type TipState } from './Tip.svelte';
	import { dateTicks, fromDay, linear, linePath, nice, ticks } from './scale';

	let {
		series,
		xType = 'number',
		height = 260,
		yLabel = '',
		xLabel = '',
		yZero = false,
		yFormat = compact,
		xFormat,
		bands = [],
		refs = [],
		markers = [],
		yDomain
	}: {
		series: LineSeries[];
		xType?: 'number' | 'date';
		height?: number;
		yLabel?: string;
		xLabel?: string;
		yZero?: boolean;
		yFormat?: (v: number) => string;
		xFormat?: (v: number) => string;
		bands?: { x0: number; x1: number; label?: string }[];
		refs?: { y: number; label: string }[];
		/** Labelled vertical lines at single x values (events). */
		markers?: { x: number; label: string }[];
		yDomain?: [number, number];
	} = $props();

	registerCsv(() => ({
		columns: [
			'series',
			xLabel || (xType === 'date' ? 'date' : 'x'),
			...(xFormat && xType !== 'date' ? ['x_label'] : []),
			yLabel || 'y'
		],
		rows: series.flatMap((s) =>
			s.points.map((p) => [
				s.name,
				xType === 'date' ? isoDay(p.x) : p.x,
				...(xFormat && xType !== 'date' ? [xFormat(p.x)] : []),
				p.y
			])
		)
	}));

	let width = $state(640);
	const m = $derived({
		top: markers.length ? 20 : 12,
		right: 16,
		bottom: xLabel ? 44 : 30,
		left: 52
	});
	const fx = $derived(
		xFormat ?? (xType === 'date' ? (v: number) => fromDay(Math.round(v)) : compact)
	);

	const all = $derived(series.flatMap((s) => s.points));
	const xs = $derived(all.map((p) => p.x));
	const ys = $derived([
		...all.map((p) => p.y).filter((y): y is number => y != null),
		...refs.map((r) => r.y)
	]);
	const xExt = $derived<[number, number]>(xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1]);
	const yExt = $derived<[number, number]>(
		yDomain ?? (ys.length ? nice(Math.min(...ys), Math.max(...ys), 5, yZero) : [0, 1])
	);
	const sx = $derived(linear(xExt, [m.left, Math.max(m.left + 10, width - m.right)]));
	const sy = $derived(linear(yExt, [height - m.bottom, m.top]));
	const yt = $derived(ticks(yExt[0], yExt[1], 5));
	const xt = $derived(
		xType === 'date'
			? dateTicks(xExt[0], xExt[1], Math.max(3, Math.floor(width / 90)))
			: ticks(xExt[0], xExt[1], Math.max(3, Math.floor(width / 90))).map((v) => ({
					v,
					label: fx(v)
				}))
	);

	let tip = $state<TipState | null>(null);
	let hoverX = $state<number | null>(null);

	function nearest(pts: { x: number; y: number | null }[], x: number) {
		let lo = 0;
		let hi = pts.length - 1;
		if (hi < 0) return null;
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (pts[mid].x < x) lo = mid;
			else hi = mid;
		}
		return Math.abs(pts[lo].x - x) <= Math.abs(pts[hi].x - x) ? pts[lo] : pts[hi];
	}

	function move(e: PointerEvent) {
		const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
		const px = e.clientX - rect.left;
		if (px < m.left || px > width - m.right) return leave();
		const x = sx.invert(px);
		const hits = series
			.map((s) => ({ s, p: nearest(s.points, x) }))
			.filter((h) => h.p && h.p.y != null) as { s: LineSeries; p: { x: number; y: number } }[];
		if (!hits.length) return leave();
		const px0 = hits[0].p.x;
		hoverX = px0;
		tip = {
			x: sx(px0),
			y: e.clientY - rect.top,
			title: fx(px0),
			lines: hits.map((h) => ({
				label: series.length > 1 ? h.s.name : undefined,
				value: yFormat(h.p.y),
				color: h.s.color
			}))
		};
	}
	function leave() {
		tip = null;
		hoverX = null;
	}
</script>

<Legend
	items={series.map((s) => ({ label: s.name, color: s.color, kind: s.dashed ? 'dash' : 'line' }))}
/>
<div class="wrap" bind:clientWidth={width}>
	<svg
		class="chart-svg"
		viewBox={`0 0 ${width} ${height}`}
		{width}
		{height}
		role="img"
		aria-label={`${yLabel || 'Value'} over ${xLabel || (xType === 'date' ? 'time' : 'x')}: ${series.map((s) => s.name).join(', ')}`}
		onpointermove={move}
		onpointerleave={leave}
	>
		{#each bands as b, i (i)}
			<rect
				x={sx(b.x0)}
				y={m.top}
				width={Math.max(0, sx(b.x1) - sx(b.x0))}
				height={height - m.top - m.bottom}
				fill="var(--surface-2)"
			/>
		{/each}
		{#each markers as mk (mk.label)}
			<line
				x1={sx(mk.x)}
				x2={sx(mk.x)}
				y1={m.top}
				y2={height - m.bottom}
				stroke="var(--ink)"
				stroke-dasharray="3 3"
			/>
			<text x={sx(mk.x)} y={m.top - 6} text-anchor="middle" font-size="10.5" fill="var(--ink-2)"
				>{mk.label}</text
			>
		{/each}
		{#each yt as t (t)}
			<line x1={m.left} x2={width - m.right} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" />
			<text
				x={m.left - 8}
				y={sy(t)}
				dy="0.32em"
				text-anchor="end"
				font-size="11"
				fill="var(--muted)">{yFormat(t)}</text
			>
		{/each}
		<line
			x1={m.left}
			x2={width - m.right}
			y1={height - m.bottom}
			y2={height - m.bottom}
			stroke="var(--axis)"
		/>
		{#each xt as t (t.v)}
			{#if t.v >= xExt[0] && t.v <= xExt[1]}
				<text
					x={sx(t.v)}
					y={height - m.bottom + 16}
					text-anchor="middle"
					font-size="11"
					fill="var(--muted)">{t.label}</text
				>
			{/if}
		{/each}
		{#each refs as r (r.label)}
			<line
				x1={m.left}
				x2={width - m.right}
				y1={sy(r.y)}
				y2={sy(r.y)}
				stroke="var(--ink-2)"
				stroke-dasharray="3 3"
			/>
			<text
				x={width - m.right}
				y={sy(r.y) - 4}
				text-anchor="end"
				font-size="10.5"
				fill="var(--ink-2)">{r.label}</text
			>
		{/each}
		{#each series as s (s.name)}
			{#if s.area}
				<path
					d={`${linePath(s.points, sx, sy)}V${sy(Math.max(yExt[0], 0))}H${sx(s.points.find((p) => p.y != null)?.x ?? 0)}Z`}
					fill={s.color}
					fill-opacity="0.1"
				/>
			{/if}
			<path
				d={linePath(s.points, sx, sy)}
				fill="none"
				stroke={s.color}
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
				stroke-dasharray={s.dashed ? '5 4' : undefined}
			/>
			{#if s.dots}
				{#each s.points as p, i (i)}
					{#if p.y != null}<circle
							cx={sx(p.x)}
							cy={sy(p.y)}
							r="4"
							fill={s.color}
							stroke="var(--surface)"
							stroke-width="2"
						/>{/if}
				{/each}
			{/if}
		{/each}
		{#if hoverX != null}
			<line
				x1={sx(hoverX)}
				x2={sx(hoverX)}
				y1={m.top}
				y2={height - m.bottom}
				stroke="var(--axis)"
			/>
			{#each series as s (s.name)}
				{@const p = nearest(s.points, hoverX)}
				{#if p && p.y != null}
					<circle
						cx={sx(p.x)}
						cy={sy(p.y)}
						r="4.5"
						fill={s.color}
						stroke="var(--surface)"
						stroke-width="2"
					/>
				{/if}
			{/each}
		{/if}
		{#if yLabel}
			<text
				transform={`translate(12 ${(height - m.bottom + m.top) / 2}) rotate(-90)`}
				text-anchor="middle"
				font-size="11"
				fill="var(--ink-2)">{yLabel}</text
			>
		{/if}
		{#if xLabel}
			<text
				x={(m.left + width - m.right) / 2}
				y={height - 6}
				text-anchor="middle"
				font-size="11"
				fill="var(--ink-2)">{xLabel}</text
			>
		{/if}
	</svg>
	<Tip {tip} {width} />
</div>

<style>
	.wrap {
		position: relative;
		width: 100%;
		touch-action: pan-y;
	}
	svg {
		display: block;
		overflow: visible;
	}
</style>
