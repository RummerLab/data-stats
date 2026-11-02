<script lang="ts" module>
	export interface BarSeries {
		name: string;
		color: string;
		values: (number | null)[];
	}
</script>

<script lang="ts">
	import { compact } from '#lib/format';
	import Legend from './Legend.svelte';
	import Tip, { type TipState } from './Tip.svelte';
	import { barPath, hbarPath, linear, nice, ticks } from './scale';

	let {
		categories,
		series,
		stacked = false,
		horizontal = false,
		height,
		yLabel = '',
		valueFormat = compact,
		labels = false,
		hrefs,
		errors
	}: {
		categories: string[];
		series: BarSeries[];
		stacked?: boolean;
		horizontal?: boolean;
		height?: number;
		yLabel?: string;
		valueFormat?: (v: number) => string;
		/** Value at each bar tip (single series only). */
		labels?: boolean;
		hrefs?: (string | null)[];
		/** Optional [lo, hi] interval per category (single series). */
		errors?: ([number, number] | null)[];
	} = $props();

	let width = $state(640);
	const h = $derived(height ?? (horizontal ? Math.max(120, categories.length * 26 + 40) : 260));
	const longest = $derived(Math.max(0, ...categories.map((c) => c.length)));
	const m = $derived(
		horizontal
			? { top: 6, right: labels ? 56 : 16, bottom: 24, left: Math.min(200, 12 + longest * 6.6) }
			: {
					top: labels ? 20 : 12,
					right: 12,
					bottom: categories.length > 8 || longest > 6 ? 54 : 30,
					left: 48
				}
	);

	const totals = $derived(
		categories.map((_, i) =>
			stacked
				? series.reduce((a, s) => a + (s.values[i] ?? 0), 0)
				: Math.max(
						0,
						...series.map((s) => s.values[i] ?? 0),
						...(errors?.[i] ? [errors[i]![1]] : [])
					)
		)
	);
	const minV = $derived(Math.min(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
	const ext = $derived(nice(minV, Math.max(1e-9, ...totals), 5, true));
	const vScale = $derived(
		horizontal ? linear(ext, [m.left, width - m.right]) : linear(ext, [h - m.bottom, m.top])
	);
	const vt = $derived(ticks(ext[0], ext[1], horizontal ? Math.max(3, Math.floor(width / 110)) : 5));
	const band = $derived(
		horizontal
			? (h - m.top - m.bottom) / Math.max(1, categories.length)
			: (width - m.left - m.right) / Math.max(1, categories.length)
	);
	const groupW = $derived(
		Math.min(stacked || series.length === 1 ? 24 : 14 * series.length, band * 0.78)
	);
	const barW = $derived(
		stacked ? groupW : Math.max(1, (groupW - 2 * (series.length - 1)) / series.length)
	);
	const rotate = $derived(!horizontal && band < longest * 6.5 + 6);

	let tip = $state<TipState | null>(null);
	function show(e: PointerEvent, i: number) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: categories[i],
			lines: series
				.map((s) => ({
					label: series.length > 1 ? s.name : undefined,
					value: s.values[i] == null ? '–' : valueFormat(s.values[i]!),
					color: s.color
				}))
				.concat(
					errors?.[i]
						? [
								{
									label: '95% interval',
									value: `${valueFormat(errors[i]![0])}–${valueFormat(errors[i]![1])}`,
									color: undefined as unknown as string
								}
							]
						: []
				)
		};
	}
</script>

<Legend items={series.map((s) => ({ label: s.name, color: s.color }))} />
<div class="wrap" bind:clientWidth={width}>
	<svg
		class="chart-svg"
		viewBox={`0 0 ${width} ${h}`}
		{width}
		height={h}
		role={hrefs?.some(Boolean) ? 'group' : 'img'}
		aria-label={`${yLabel || 'Values'} by category`}
		onpointerleave={() => (tip = null)}
	>
		{#each vt as t (t)}
			{#if horizontal}
				<line x1={vScale(t)} x2={vScale(t)} y1={m.top} y2={h - m.bottom} stroke="var(--grid)" />
				<text
					x={vScale(t)}
					y={h - m.bottom + 15}
					text-anchor="middle"
					font-size="11"
					fill="var(--muted)">{valueFormat(t)}</text
				>
			{:else}
				<line x1={m.left} x2={width - m.right} y1={vScale(t)} y2={vScale(t)} stroke="var(--grid)" />
				<text
					x={m.left - 8}
					y={vScale(t)}
					dy="0.32em"
					text-anchor="end"
					font-size="11"
					fill="var(--muted)">{valueFormat(t)}</text
				>
			{/if}
		{/each}
		{#each categories as cat, i (i)}
			{@const c0 = (horizontal ? m.top : m.left) + band * i + (band - groupW) / 2}
			<g>
				<svelte:element
					this={hrefs?.[i] ? 'a' : 'g'}
					href={hrefs?.[i] ?? undefined}
					aria-label={hrefs?.[i] ? cat : undefined}
					role={hrefs?.[i] ? undefined : 'presentation'}
				>
					<rect
						x={horizontal ? m.left : m.left + band * i}
						y={horizontal ? m.top + band * i : m.top}
						width={horizontal ? width - m.left - m.right : band}
						height={horizontal ? band : h - m.top - m.bottom}
						fill="transparent"
						role="presentation"
						onpointermove={(e) => show(e, i)}
					/>
					{#if stacked}
						{@const segs = series.reduce<{ s: BarSeries; a: number; b: number }[]>((acc, s) => {
							const prev = acc.length ? acc[acc.length - 1].b : 0;
							const v = s.values[i] ?? 0;
							if (v > 0) acc.push({ s, a: prev, b: prev + v });
							return acc;
						}, [])}
						{#each segs as seg, k (seg.s.name)}
							{@const last = k === segs.length - 1}
							{#if horizontal}
								{@const x0 = vScale(seg.a) + (k ? 1 : 0)}
								{@const x1 = vScale(seg.b) - (last ? 0 : 1)}
								<path
									d={last
										? hbarPath(x0, x1, c0, groupW)
										: `M${x0},${c0}H${x1}V${c0 + groupW}H${x0}Z`}
									fill={seg.s.color}
									pointer-events="none"
								/>
							{:else}
								{@const y0 = vScale(seg.a) - (k ? 1 : 0)}
								{@const y1 = vScale(seg.b) + (last ? 0 : 1)}
								<path
									d={last
										? barPath(c0, groupW, y0, y1)
										: `M${c0},${y0}V${y1}H${c0 + groupW}V${y0}Z`}
									fill={seg.s.color}
									pointer-events="none"
								/>
							{/if}
						{/each}
					{:else}
						{#each series as s, k (s.name)}
							{@const v = s.values[i]}
							{#if v != null && v !== 0}
								{#if horizontal}
									<path
										d={hbarPath(vScale(0), vScale(v), c0 + k * (barW + 2), barW)}
										fill={s.color}
										pointer-events="none"
									/>
								{:else}
									<path
										d={barPath(c0 + k * (barW + 2), barW, vScale(0), vScale(v))}
										fill={s.color}
										pointer-events="none"
									/>
								{/if}
							{/if}
						{/each}
					{/if}
					{#if errors?.[i]}
						{@const e = errors[i]!}
						{#if horizontal}
							<line
								x1={vScale(e[0])}
								x2={vScale(e[1])}
								y1={c0 + groupW / 2}
								y2={c0 + groupW / 2}
								stroke="var(--ink)"
								stroke-width="1.5"
								pointer-events="none"
							/>
						{:else}
							<line
								x1={c0 + groupW / 2}
								x2={c0 + groupW / 2}
								y1={vScale(e[0])}
								y2={vScale(e[1])}
								stroke="var(--ink)"
								stroke-width="1.5"
								pointer-events="none"
							/>
						{/if}
					{/if}
					{#if labels && totals[i] > 0}
						{#if horizontal}
							<text
								x={vScale(totals[i]) + 6}
								y={c0 + groupW / 2}
								dy="0.32em"
								font-size="11"
								fill="var(--ink-2)"
								>{valueFormat(stacked ? totals[i] : (series[0].values[i] ?? 0))}</text
							>
						{:else}
							<text
								x={c0 + groupW / 2}
								y={vScale(totals[i]) - 5}
								text-anchor="middle"
								font-size="10.5"
								fill="var(--ink-2)"
								>{valueFormat(stacked ? totals[i] : (series[0].values[i] ?? 0))}</text
							>
						{/if}
					{/if}
				</svelte:element>
				{#if horizontal}
					<text
						x={m.left - 8}
						y={m.top + band * i + band / 2}
						dy="0.32em"
						text-anchor="end"
						font-size="11.5"
						fill="var(--ink-2)">{cat}</text
					>
				{:else if rotate}
					<text
						transform={`translate(${m.left + band * i + band / 2} ${h - m.bottom + 10}) rotate(-40)`}
						text-anchor="end"
						font-size="10.5"
						fill="var(--muted)">{cat}</text
					>
				{:else}
					<text
						x={m.left + band * i + band / 2}
						y={h - m.bottom + 16}
						text-anchor="middle"
						font-size="11"
						fill="var(--muted)">{cat}</text
					>
				{/if}
			</g>
		{/each}
		{#if horizontal}
			<line x1={vScale(0)} x2={vScale(0)} y1={m.top} y2={h - m.bottom} stroke="var(--axis)" />
		{:else}
			<line x1={m.left} x2={width - m.right} y1={vScale(0)} y2={vScale(0)} stroke="var(--axis)" />
			{#if yLabel}
				<text
					transform={`translate(12 ${(h - m.bottom + m.top) / 2}) rotate(-90)`}
					text-anchor="middle"
					font-size="11"
					fill="var(--ink-2)">{yLabel}</text
				>
			{/if}
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
	:global(svg a:focus-visible) rect {
		stroke: var(--accent);
		stroke-width: 2;
	}
</style>
