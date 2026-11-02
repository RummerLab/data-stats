<script lang="ts" module>
	export interface Box {
		name: string;
		color?: string;
		stats: {
			n: number;
			lo: number;
			q1: number;
			median: number;
			q3: number;
			hi: number;
			mean: number;
		} | null;
	}
</script>

<script lang="ts">
	import { compact } from '#lib/format';
	import Tip, { type TipState } from './Tip.svelte';
	import { linear, nice, ticks } from './scale';

	let {
		boxes,
		height = 260,
		yLabel = '',
		yFormat = compact
	}: { boxes: Box[]; height?: number; yLabel?: string; yFormat?: (v: number) => string } = $props();

	let width = $state(640);
	const longest = $derived(Math.max(0, ...boxes.map((b) => b.name.length)));
	const band = $derived((width - 64) / Math.max(1, boxes.length));
	const rotate = $derived(band < longest * 6.5 + 6);
	const m = $derived({ top: 10, right: 12, bottom: rotate ? 14 + longest * 5 : 30, left: 52 });
	const shown = $derived(boxes.filter((b) => b.stats));
	const ext = $derived<[number, number]>(
		shown.length
			? nice(
					Math.min(...shown.map((b) => b.stats!.lo)),
					Math.max(...shown.map((b) => b.stats!.hi)),
					5
				)
			: [0, 1]
	);
	const sy = $derived(linear(ext, [height - m.bottom, m.top]));
	const bw = $derived(Math.min(28, band * 0.6));
	let tip = $state<TipState | null>(null);
	function show(e: PointerEvent, b: Box) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		const s = b.stats!;
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: `${b.name} (n = ${s.n})`,
			lines: [
				{ label: 'Upper whisker', value: yFormat(s.hi) },
				{ label: 'Q3', value: yFormat(s.q3) },
				{ label: 'Median', value: yFormat(s.median) },
				{ label: 'Q1', value: yFormat(s.q1) },
				{ label: 'Lower whisker', value: yFormat(s.lo) },
				{ label: 'Mean', value: yFormat(s.mean) }
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
		aria-label={`${yLabel} by group (box plots)`}
		onpointerleave={() => (tip = null)}
	>
		{#each ticks(ext[0], ext[1], 5) as t (t)}
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
		{#each boxes as b, i (b.name)}
			{@const cx = m.left + band * i + band / 2}
			{#if b.stats}
				{@const s = b.stats}
				{@const c = b.color ?? 'var(--series-1)'}
				<g role="presentation" onpointermove={(e) => show(e, b)}>
					<rect
						x={cx - band / 2}
						width={band}
						y={m.top}
						height={height - m.top - m.bottom}
						fill="transparent"
					/>
					<line x1={cx} x2={cx} y1={sy(s.lo)} y2={sy(s.q1)} stroke={c} stroke-width="1.5" />
					<line x1={cx} x2={cx} y1={sy(s.q3)} y2={sy(s.hi)} stroke={c} stroke-width="1.5" />
					<line
						x1={cx - bw / 4}
						x2={cx + bw / 4}
						y1={sy(s.lo)}
						y2={sy(s.lo)}
						stroke={c}
						stroke-width="1.5"
					/>
					<line
						x1={cx - bw / 4}
						x2={cx + bw / 4}
						y1={sy(s.hi)}
						y2={sy(s.hi)}
						stroke={c}
						stroke-width="1.5"
					/>
					<rect
						x={cx - bw / 2}
						width={bw}
						y={sy(s.q3)}
						height={Math.max(1, sy(s.q1) - sy(s.q3))}
						fill={c}
						fill-opacity="0.18"
						stroke={c}
						stroke-width="1.5"
						rx="3"
					/>
					<line
						x1={cx - bw / 2}
						x2={cx + bw / 2}
						y1={sy(s.median)}
						y2={sy(s.median)}
						stroke={c}
						stroke-width="2.5"
					/>
					<circle
						{cx}
						cy={sy(s.mean)}
						r="2.5"
						fill="var(--surface)"
						stroke={c}
						stroke-width="1.5"
					/>
				</g>
			{/if}
			{#if rotate}
				<text
					transform={`translate(${cx} ${height - m.bottom + 10}) rotate(-40)`}
					text-anchor="end"
					font-size="10.5"
					fill="var(--muted)">{b.name}</text
				>
			{:else}
				<text
					x={cx}
					y={height - m.bottom + 16}
					text-anchor="middle"
					font-size="11"
					fill="var(--muted)">{b.name}</text
				>
			{/if}
		{/each}
		<line
			x1={m.left}
			x2={width - m.right}
			y1={height - m.bottom}
			y2={height - m.bottom}
			stroke="var(--axis)"
		/>
		{#if yLabel}
			<text
				transform={`translate(12 ${(height - m.bottom + m.top) / 2}) rotate(-90)`}
				text-anchor="middle"
				font-size="11"
				fill="var(--ink-2)">{yLabel}</text
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
