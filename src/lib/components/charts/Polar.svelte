<script lang="ts">
	import { compact } from '#lib/format';
	import Tip, { type TipState } from './Tip.svelte';

	let {
		sectors,
		format = compact,
		height = 300,
		color = 'var(--series-1)',
		startAngle = 0
	}: {
		sectors: { label: string; value: number | null; sub?: string; color?: string }[];
		format?: (v: number) => string;
		height?: number;
		color?: string;
		/** Degrees clockwise from 12 o'clock for the first sector's centre. */
		startAngle?: number;
	} = $props();

	let width = $state(400);
	const size = $derived(Math.min(width, height));
	const cx = $derived(width / 2);
	const cy = $derived(height / 2);
	const R = $derived(Math.max(20, size / 2 - 34));
	const max = $derived(Math.max(1e-9, ...sectors.map((s) => s.value ?? 0)));
	const n = $derived(Math.max(1, sectors.length));
	const ang = (i: number, off = 0) => ((startAngle + (360 / n) * (i + off) - 90) * Math.PI) / 180;
	// Area-true radius: r ∝ √value.
	const rad = (v: number) => R * Math.sqrt(Math.max(0, v) / max);
	function wedge(i: number, v: number) {
		const r = rad(v);
		const a0 = ang(i, -0.5) + 0.015;
		const a1 = ang(i, 0.5) - 0.015;
		return `M${cx},${cy}L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)}A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}Z`;
	}
	let tip = $state<TipState | null>(null);
	function show(e: PointerEvent, i: number) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		const s = sectors[i];
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: s.label,
			lines: [
				{ value: s.value == null ? '–' : format(s.value) },
				...(s.sub ? [{ value: s.sub }] : [])
			]
		};
	}
</script>

<div class="wrap" bind:clientWidth={width}>
	<svg
		class="chart-svg"
		viewBox={`0 0 ${width} ${height}`}
		{width}
		{height}
		role="img"
		aria-label="Polar chart"
		onpointerleave={() => (tip = null)}
	>
		{#each [0.25, 0.5, 0.75, 1] as f (f)}
			<circle {cx} {cy} r={R * Math.sqrt(f)} fill="none" stroke="var(--grid)" />
		{/each}
		<text x={cx + 4} y={cy - R - 4} font-size="10" fill="var(--muted)">{format(max)}</text>
		{#each sectors as s, i (s.label)}
			{@const a = ang(i)}
			<path
				d={wedge(i, s.value != null && s.value > 0 ? s.value : max * 0.02)}
				fill={s.value != null && s.value > 0 ? (s.color ?? color) : 'transparent'}
				fill-opacity="0.85"
				stroke="var(--surface)"
				stroke-width="1"
				role="presentation"
				onpointermove={(e) => show(e, i)}
			/>
			<text
				x={cx + (R + 18) * Math.cos(a)}
				y={cy + (R + 18) * Math.sin(a)}
				dy="0.32em"
				text-anchor="middle"
				font-size="10.5"
				fill="var(--ink-2)">{s.label}</text
			>
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
