<script lang="ts">
	import { compact } from '#lib/format';
	import Tip, { type TipState } from './Tip.svelte';

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
		if (v == null || !Number.isFinite(v))
			return { color: 'var(--surface-2)', opacity: 0.6, dark: false };
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
	function show(e: PointerEvent, r: number, c: number) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		const v = values[r]?.[c];
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: `${yLabels[r]} · ${xLabels[c]}`,
			lines: [{ value: v == null ? 'no data' : format(v) }]
		};
	}
</script>

<div class="wrap" bind:clientWidth={width}>
	<svg
		class="chart-svg"
		viewBox={`0 0 ${width} ${h}`}
		{width}
		height={h}
		role="img"
		aria-label={`Heatmap of ${yTitle} by ${xTitle}`}
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
					role="presentation"
					onpointermove={(e) => show(e, r, c)}
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
