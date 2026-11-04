<script lang="ts">
	import { registerCsv } from './csv';
	import { compact } from '#lib/format';
	import Tip, { type TipState } from './Tip.svelte';
	import { KEYS_HINT, markAt, markKeys, pointerIn } from './marks';

	let {
		xLabels,
		yLabels,
		values,
		mode = 'seq',
		format = compact,
		cellLabels = false,
		xTitle = '',
		yTitle = '',
		domain
	}: {
		xLabels: string[];
		yLabels: string[];
		/** values[row][col] */
		values: (number | null)[][];
		mode?: 'seq' | 'div';
		format?: (v: number) => string;
		cellLabels?: boolean;
		xTitle?: string;
		yTitle?: string;
		domain?: [number, number];
	} = $props();

	registerCsv(() => ({
		columns: [yTitle || 'row', ...xLabels],
		rows: yLabels.map((y, i) => [y, ...xLabels.map((_, j) => values[i]?.[j])])
	}));

	let width = $state(640);
	const longestY = $derived(Math.max(0, ...yLabels.map((l) => l.length)));
	const longestX = $derived(Math.max(0, ...xLabels.map((l) => l.length)));
	const m = $derived({
		top: 8,
		right: 8,
		bottom: longestX > 4 ? 14 + longestX * 5.2 : 28,
		left: Math.min(170, 14 + longestY * 6.6)
	});
	const cellH = 26;
	const h = $derived(m.top + m.bottom + cellH * yLabels.length);
	const cellW = $derived((width - m.left - m.right) / Math.max(1, xLabels.length));
	const flat = $derived(values.flat().filter((v): v is number => v != null && Number.isFinite(v)));
	const lo = $derived(domain?.[0] ?? (flat.length ? Math.min(...flat) : 0));
	const hi = $derived(domain?.[1] ?? (flat.length ? Math.max(...flat) : 1));
	const absMax = $derived(Math.max(Math.abs(lo), Math.abs(hi)) || 1);

	function fill(v: number | null): { color: string; opacity: number; dark: boolean } {
		// No data: an empty dashed cell, never a colour from the scale (the lightest steps are
		// close to --surface-2, in dark mode especially).
		if (v == null || !Number.isFinite(v)) return { color: 'none', opacity: 1, dark: false };
		if (mode === 'div') {
			const t = Math.max(-1, Math.min(1, v / absMax));
			if (Math.abs(t) < 0.06) return { color: 'var(--div-mid)', opacity: 1, dark: false };
			return {
				color: t < 0 ? 'var(--div-neg)' : 'var(--div-pos)',
				opacity: 0.18 + 0.82 * Math.abs(t),
				dark: Math.abs(t) > 0.6
			};
		}
		const t = hi === lo ? 1 : (v - lo) / (hi - lo);
		const k = Math.min(7, 1 + Math.floor(t * 6.999));
		return { color: `var(--seq-${k})`, opacity: 1, dark: k >= 5 };
	}

	let tip = $state<TipState | null>(null);
	function show(at: { x: number; y: number }, r: number, c: number) {
		const v = values[r]?.[c];
		tip = {
			...at,
			title: `${yLabels[r]} · ${xLabels[c]}`,
			lines: [{ value: v == null ? 'no data' : format(v) }]
		};
	}
	let svg = $state<SVGSVGElement>();
	const keys = markKeys({
		count: () => yLabels.length * xLabels.length,
		cols: () => xLabels.length,
		show: (k) => {
			const [r, c] = [Math.floor(k / xLabels.length), k % xLabels.length];
			markAt(svg, k, (p) => show(p, r, c));
		},
		hide: () => (tip = null)
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
		aria-label={`Heatmap of ${yTitle} by ${xTitle}. ${KEYS_HINT}`}
		onpointerleave={() => (tip = null)}
	>
		{#each yLabels as yl, r (r)}
			<text
				x={m.left - 8}
				y={m.top + r * cellH + cellH / 2}
				dy="0.32em"
				text-anchor="end"
				font-size="11"
				fill="var(--ink-2)">{yl}</text
			>
			{#each xLabels as _, c (c)}
				{@const v = values[r]?.[c] ?? null}
				{@const f = fill(v)}
				<rect
					x={m.left + c * cellW + 1}
					y={m.top + r * cellH + 1}
					width={Math.max(0, cellW - 2)}
					height={cellH - 2}
					rx="3"
					fill={f.color}
					fill-opacity={f.opacity}
					stroke={f.color === 'none' ? 'var(--axis)' : undefined}
					stroke-dasharray={f.color === 'none' ? '3 2' : undefined}
					pointer-events={f.color === 'none' ? 'all' : undefined}
					role="presentation"
					data-mark={r * xLabels.length + c}
					onpointermove={(e) => show(pointerIn(e), r, c)}
				/>
				{#if cellLabels && v != null && cellW > 28}
					<text
						x={m.left + c * cellW + cellW / 2}
						y={m.top + r * cellH + cellH / 2}
						dy="0.32em"
						text-anchor="middle"
						font-size="10"
						fill={f.dark ? '#ffffff' : 'var(--ink)'}
						pointer-events="none">{format(v)}</text
					>
				{/if}
			{/each}
		{/each}
		{#each xLabels as xl, c (c)}
			{#if longestX > 4}
				<text
					transform={`translate(${m.left + c * cellW + cellW / 2} ${m.top + yLabels.length * cellH + 10}) rotate(-45)`}
					text-anchor="end"
					font-size="10.5"
					fill="var(--muted)">{xl}</text
				>
			{:else if cellW > 16 || c % 2 === 0}
				<text
					x={m.left + c * cellW + cellW / 2}
					y={m.top + yLabels.length * cellH + 16}
					text-anchor="middle"
					font-size="10.5"
					fill="var(--muted)">{xl}</text
				>
			{/if}
		{/each}
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
