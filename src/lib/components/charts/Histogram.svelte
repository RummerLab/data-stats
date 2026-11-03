<script lang="ts">
	import { registerCsv } from './csv';
	import { compact } from '#lib/format';
	import Legend from './Legend.svelte';
	import Tip, { type TipState } from './Tip.svelte';
	import { KEYS_HINT, markAt, markKeys, pointerIn } from './marks';
	import { linear, nice, ticks } from './scale';

	let {
		edges,
		series,
		height = 240,
		xLabel = '',
		yLabel = 'Count',
		xFormat = compact,
		markers = [],
		mode = 'stack'
	}: {
		/** Bin edges (n + 1 values). */
		edges: number[];
		series: { name: string; color: string; counts: number[] }[];
		height?: number;
		xLabel?: string;
		yLabel?: string;
		xFormat?: (v: number) => string;
		markers?: { x: number; label: string }[];
		/** 'stack' adds series up; 'overlay' draws each from zero (translucent fill + outline). */
		mode?: 'stack' | 'overlay';
	} = $props();

	registerCsv(() => ({
		columns: ['bin_start', 'bin_end', ...series.map((s) => s.name)],
		rows: edges.slice(0, -1).map((e, i) => [e, edges[i + 1], ...series.map((s) => s.counts[i])])
	}));

	let width = $state(640);
	const m = $derived({
		top: markers.length ? 18 : 10,
		right: 14,
		bottom: xLabel ? 44 : 28,
		left: 46
	});
	const totals = $derived(
		edges.slice(0, -1).map((_, i) => series.reduce((a, s) => a + (s.counts[i] ?? 0), 0))
	);
	const peak = $derived(
		mode === 'overlay' ? Math.max(1, ...series.flatMap((s) => s.counts)) : Math.max(1, ...totals)
	);
	const yExt = $derived(nice(0, peak, 5, true));
	const sx = $derived(
		linear(
			[edges[0] ?? 0, edges[edges.length - 1] ?? 1],
			[m.left, Math.max(m.left + 10, width - m.right)]
		)
	);
	const sy = $derived(linear(yExt, [height - m.bottom, m.top]));
	const xt = $derived(
		ticks(edges[0] ?? 0, edges[edges.length - 1] ?? 1, Math.max(3, Math.floor(width / 80)))
	);
	/** Stepped outline along the top of one series' bars (overlay mode). */
	function outline(counts: number[]): string {
		let d = '';
		edges.slice(0, -1).forEach((e0, i) => {
			const y = sy(counts[i] ?? 0);
			d += `${i ? 'L' : 'M'}${sx(e0)},${y}L${sx(edges[i + 1])},${y}`;
		});
		return d;
	}
	let tip = $state<TipState | null>(null);
	function show(at: { x: number; y: number }, i: number) {
		tip = {
			...at,
			title: `${xFormat(edges[i])} – ${xFormat(edges[i + 1])}`,
			lines: series.map((s) => ({
				label: series.length > 1 ? s.name : undefined,
				value: String(s.counts[i] ?? 0),
				color: s.color
			}))
		};
	}
	let svg = $state<SVGSVGElement>();
	const keys = markKeys({
		count: () => edges.length - 1,
		show: (i) => markAt(svg, i, (p) => show(p, i)),
		hide: () => (tip = null)
	});
</script>

<Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
<div class="wrap" bind:clientWidth={width}>
	<svg
		bind:this={svg}
		class="chart-svg"
		viewBox={`0 0 ${width} ${height}`}
		{width}
		{height}
		{...keys}
		aria-label={`Distribution of ${xLabel}. ${KEYS_HINT}`}
		onpointerleave={() => (tip = null)}
	>
		{#each ticks(yExt[0], yExt[1], 4) as t (t)}
			<line x1={m.left} x2={width - m.right} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" />
			<text
				x={m.left - 8}
				y={sy(t)}
				dy="0.32em"
				text-anchor="end"
				font-size="11"
				fill="var(--muted)">{compact(t)}</text
			>
		{/each}
		{#each edges.slice(0, -1) as e0, i (i)}
			{@const x0 = sx(e0) + 1}
			{@const x1 = sx(edges[i + 1]) - 1}
			{#each mode === 'overlay' ? [] : series as s, k (s.name)}
				{@const below = series.slice(0, k).reduce((a, q) => a + (q.counts[i] ?? 0), 0)}
				{@const v = s.counts[i] ?? 0}
				{#if v > 0}
					<rect
						x={x0}
						width={Math.max(0.5, x1 - x0)}
						y={sy(below + v)}
						height={Math.max(0, sy(below) - sy(below + v) - (k ? 1 : 0))}
						fill={s.color}
						rx={k === series.length - 1 ? 2 : 0}
					/>
				{/if}
			{/each}
			<rect
				x={sx(e0)}
				width={Math.max(0, sx(edges[i + 1]) - sx(e0))}
				y={m.top}
				height={height - m.top - m.bottom}
				fill="transparent"
				role="presentation"
				data-mark={i}
				onpointermove={(e) => show(pointerIn(e), i)}
			/>
		{/each}
		{#if mode === 'overlay'}
			{#each series as s (s.name)}
				<g pointer-events="none">
					{#each edges.slice(0, -1) as e0, i (i)}
						{@const v = s.counts[i] ?? 0}
						{#if v > 0}
							<rect
								x={sx(e0)}
								width={Math.max(0, sx(edges[i + 1]) - sx(e0))}
								y={sy(v)}
								height={Math.max(0, sy(0) - sy(v))}
								fill={s.color}
								fill-opacity="0.22"
							/>
						{/if}
					{/each}
					<path d={outline(s.counts)} fill="none" stroke={s.color} stroke-width="2" />
				</g>
			{/each}
		{/if}
		<line
			x1={m.left}
			x2={width - m.right}
			y1={height - m.bottom}
			y2={height - m.bottom}
			stroke="var(--axis)"
		/>
		{#each xt as t (t)}
			<text
				x={sx(t)}
				y={height - m.bottom + 16}
				text-anchor="middle"
				font-size="11"
				fill="var(--muted)">{xFormat(t)}</text
			>
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
			<text x={sx(mk.x)} y={m.top - 5} text-anchor="middle" font-size="10.5" fill="var(--ink-2)"
				>{mk.label}</text
			>
		{/each}
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
	}
	svg {
		display: block;
		overflow: visible;
	}
</style>
