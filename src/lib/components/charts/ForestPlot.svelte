<script lang="ts" module>
	export interface ForestValue {
		est: number;
		lo: number;
		hi: number;
	}
	export interface ForestSeries {
		name: string;
		color: string;
		values: (ForestValue | null)[];
	}
</script>

<script lang="ts">
	/**
	 * Estimates with 95% intervals on a log scale around a reference line (rate ratios, #54).
	 * One row per term; several series sit side by side within a row.
	 */
	import { registerCsv } from './csv';
	import { num } from '#lib/format';
	import Legend from './Legend.svelte';
	import Tip, { type TipState } from './Tip.svelte';
	import { linear } from './scale';

	let {
		rows,
		series,
		ref = 1,
		xLabel = '',
		format = (v: number) => num(v, 2)
	}: {
		rows: string[];
		series: ForestSeries[];
		ref?: number;
		xLabel?: string;
		format?: (v: number) => string;
	} = $props();

	registerCsv(() => ({
		columns: [
			'term',
			...series.flatMap((s) =>
				series.length > 1
					? [s.name, `${s.name} ci_low`, `${s.name} ci_high`]
					: ['estimate', 'ci_low', 'ci_high']
			)
		],
		rows: rows.map((r, i) => [
			r,
			...series.flatMap((s) => [s.values[i]?.est, s.values[i]?.lo, s.values[i]?.hi])
		])
	}));

	let width = $state(640);
	const CHAR_W = 6.2;
	const longest = $derived(Math.max(0, ...rows.map((c) => c.length)));
	const m = $derived({
		top: 6,
		right: 16,
		bottom: xLabel ? 42 : 26,
		left: Math.min(Math.max(110, width * 0.45), 12 + longest * CHAR_W)
	});
	// Labels that don't fit the margin wrap onto a second line (narrow screens).
	const fit = $derived(Math.max(8, Math.floor((m.left - 12) / CHAR_W)));
	const wrap = (s: string, n: number): string[] => {
		if (s.length <= n) return [s];
		const cut = s.lastIndexOf(' ', n);
		if (cut <= 0) return [`${s.slice(0, n - 1)}…`];
		const rest = s.slice(cut + 1);
		return [s.slice(0, cut), rest.length > n ? `${rest.slice(0, n - 1)}…` : rest];
	};
	const labels = $derived(rows.map((r) => wrap(r, fit)));
	const band = $derived(series.length > 1 || labels.some((l) => l.length > 1) ? 30 : 24);
	const h = $derived(m.top + m.bottom + rows.length * band);

	const all = $derived(series.flatMap((s) => s.values.filter((v): v is ForestValue => v != null)));
	const ext = $derived.by<[number, number]>(() => {
		const lo = Math.min(ref, ...all.map((v) => v.lo));
		const hi = Math.max(ref, ...all.map((v) => v.hi));
		const pad = (Math.log(hi) - Math.log(lo)) * 0.06 || 0.1;
		return [Math.exp(Math.log(lo) - pad), Math.exp(Math.log(hi) + pad)];
	});
	const sx = $derived(linear(ext, [m.left, Math.max(m.left + 10, width - m.right)], true));
	const CANDIDATES = [0.05, 0.1, 0.2, 0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4, 5, 10, 20];
	const xt = $derived.by(() => {
		const inside = CANDIDATES.filter((v) => v >= ext[0] && v <= ext[1]);
		const room = Math.max(3, Math.floor((width - m.left - m.right) / 48));
		if (inside.length <= room) return inside;
		const keep = [0.1, 0.2, 0.5, 1, 2, 5, 10].filter((v) => v >= ext[0] && v <= ext[1]);
		return keep.length >= 2 ? keep : inside.filter((_, i) => i % 2 === 0);
	});
	const off = (k: number) => (series.length > 1 ? (k - (series.length - 1) / 2) * 9 : 0);

	let tip = $state<TipState | null>(null);
	function show(e: PointerEvent, i: number) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: rows[i],
			lines: series.map((s) => {
				const v = s.values[i];
				return {
					label: series.length > 1 ? s.name : undefined,
					value: v ? `${format(v.est)} (${format(v.lo)}–${format(v.hi)})` : '–',
					color: s.color
				};
			})
		};
	}
</script>

<Legend items={series.map((s) => ({ label: s.name, color: s.color, kind: 'dot' as const }))} />
<div class="wrap" bind:clientWidth={width}>
	<svg
		class="chart-svg"
		viewBox={`0 0 ${width} ${h}`}
		{width}
		height={h}
		role="img"
		aria-label={`${xLabel || 'Estimates'} with 95% intervals`}
		onpointerleave={() => (tip = null)}
	>
		{#each xt as t (t)}
			<line x1={sx(t)} x2={sx(t)} y1={m.top} y2={h - m.bottom} stroke="var(--grid)" />
			<text x={sx(t)} y={h - m.bottom + 15} text-anchor="middle" font-size="11" fill="var(--muted)"
				>{format(t)}</text
			>
		{/each}
		<line
			x1={sx(ref)}
			x2={sx(ref)}
			y1={m.top}
			y2={h - m.bottom}
			stroke="var(--axis)"
			stroke-dasharray="4 3"
		/>
		{#each rows as row, i (i)}
			{@const cy = m.top + band * i + band / 2}
			<g>
				<rect
					x={m.left}
					y={m.top + band * i}
					width={Math.max(0, width - m.left - m.right)}
					height={band}
					fill="transparent"
					role="presentation"
					onpointermove={(e) => show(e, i)}
				/>
				{#each series as s, k (s.name)}
					{@const v = s.values[i]}
					{#if v}
						<line
							x1={sx(v.lo)}
							x2={sx(v.hi)}
							y1={cy + off(k)}
							y2={cy + off(k)}
							stroke={s.color}
							stroke-width="2"
							stroke-linecap="round"
							pointer-events="none"
						/>
						<circle cx={sx(v.est)} cy={cy + off(k)} r="4" fill={s.color} pointer-events="none" />
					{/if}
				{/each}
				<text x={m.left - 8} y={cy} text-anchor="end" font-size="11.5" fill="var(--ink-2)">
					{#each labels[i] as line, j (j)}
						<tspan x={m.left - 8} dy={j ? '1.15em' : labels[i].length > 1 ? '-0.25em' : '0.32em'}
							>{line}</tspan
						>
					{/each}
					<title>{row}</title>
				</text>
			</g>
		{/each}
		{#if xLabel}
			<text
				x={(m.left + width - m.right) / 2}
				y={h - 6}
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
