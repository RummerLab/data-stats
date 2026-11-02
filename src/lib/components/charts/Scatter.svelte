<script lang="ts" module>
	export interface ScatterPoint {
		x: number;
		y: number;
		g?: string;
		label?: string;
		href?: string;
	}
	export interface FitLine {
		name: string;
		color: string;
		points: { x: number; y: number }[];
		dashed?: boolean;
	}
</script>

<script lang="ts">
	import { compact } from '#lib/format';
	import Legend from './Legend.svelte';
	import Tip, { type TipState } from './Tip.svelte';
	import { dateTicks, fromDay, linear, logTicks, nice, ticks } from './scale';

	let {
		points,
		groups = [],
		fits = [],
		height = 300,
		xLabel = '',
		yLabel = '',
		xFormat = compact,
		yFormat = compact,
		xLog = false,
		yLog = false,
		xDate = false,
		r = 3.5,
		jitter = 0,
		opacity = 0.7
	}: {
		points: ScatterPoint[];
		groups?: { name: string; color: string }[];
		fits?: FitLine[];
		height?: number;
		xLabel?: string;
		yLabel?: string;
		xFormat?: (v: number) => string;
		yFormat?: (v: number) => string;
		xLog?: boolean;
		yLog?: boolean;
		xDate?: boolean;
		r?: number;
		/** Horizontal jitter in x units (for integer-valued x). */
		jitter?: number;
		opacity?: number;
	} = $props();

	let width = $state(640);
	const m = $derived({ top: 10, right: 16, bottom: xLabel ? 44 : 28, left: 54 });
	const colorOf = $derived(new Map(groups.map((g) => [g.name, g.color])));
	const pts = $derived(points.filter((p) => (!xLog || p.x > 0) && (!yLog || p.y > 0)));
	const ext = (vals: number[], log: boolean): [number, number] => {
		if (!vals.length) return [0, 1];
		const lo = Math.min(...vals);
		const hi = Math.max(...vals);
		if (log) return [lo * 0.9, hi * 1.1];
		return nice(lo, hi, 5);
	};
	const fitPts = $derived(fits.flatMap((f) => f.points));
	const xExt = $derived(ext([...pts.map((p) => p.x), ...fitPts.map((p) => p.x)], xLog));
	const yExt = $derived(ext([...pts.map((p) => p.y), ...fitPts.map((p) => p.y)], yLog));
	const sx = $derived(linear(xExt, [m.left, Math.max(m.left + 10, width - m.right)], xLog));
	const sy = $derived(linear(yExt, [height - m.bottom, m.top], yLog));
	const xt = $derived(
		xDate
			? dateTicks(xExt[0], xExt[1], Math.max(3, Math.floor(width / 90)))
			: (xLog
					? logTicks(xExt[0], xExt[1])
					: ticks(xExt[0], xExt[1], Math.max(3, Math.floor(width / 90)))
				).map((v) => ({ v, label: xFormat(v) }))
	);
	const yt = $derived(yLog ? logTicks(yExt[0], yExt[1]) : ticks(yExt[0], yExt[1], 5));
	// Deterministic jitter so SSR and hydration agree.
	const jit = (i: number) =>
		jitter ? (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 2 * jitter : 0;

	let tip = $state<TipState | null>(null);
	function show(e: PointerEvent, p: ScatterPoint) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: p.label,
			lines: [
				{ label: xLabel || 'x', value: xDate ? fromDay(p.x) : xFormat(p.x) },
				{ label: yLabel || 'y', value: yFormat(p.y), color: p.g ? colorOf.get(p.g) : undefined }
			]
		};
	}
</script>

<Legend
	items={[
		...groups.map((g) => ({ label: g.name, color: g.color, kind: 'dot' as const })),
		...fits.map((f) => ({
			label: f.name,
			color: f.color,
			kind: f.dashed ? ('dash' as const) : ('line' as const)
		}))
	]}
/>
<div class="wrap" bind:clientWidth={width}>
	<svg
		class="chart-svg"
		viewBox={`0 0 ${width} ${height}`}
		{width}
		{height}
		role={points.some((p) => p.href) ? 'group' : 'img'}
		aria-label={`${yLabel} against ${xLabel}`}
		onpointerleave={() => (tip = null)}
	>
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
		{#each xt as t (t.v)}
			{#if t.v >= xExt[0] && t.v <= xExt[1]}
				<line x1={sx(t.v)} x2={sx(t.v)} y1={m.top} y2={height - m.bottom} stroke="var(--grid)" />
				<text
					x={sx(t.v)}
					y={height - m.bottom + 16}
					text-anchor="middle"
					font-size="11"
					fill="var(--muted)">{t.label}</text
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
		{#each pts as p, i (i)}
			<svelte:element
				this={p.href ? 'a' : 'g'}
				href={p.href}
				role={p.href ? undefined : 'presentation'}
			>
				<circle
					cx={sx(p.x + jit(i))}
					cy={sy(p.y)}
					{r}
					fill={p.g ? (colorOf.get(p.g) ?? 'var(--series-1)') : 'var(--series-1)'}
					fill-opacity={opacity}
					stroke="var(--surface)"
					stroke-width="1"
					role="presentation"
					onpointerenter={(e) => show(e, p)}
				/>
			</svelte:element>
		{/each}
		{#each fits as f (f.name)}
			<polyline
				points={f.points.map((q) => `${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ')}
				fill="none"
				stroke="var(--surface)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<polyline
				points={f.points.map((q) => `${sx(q.x).toFixed(1)},${sy(q.y).toFixed(1)}`).join(' ')}
				fill="none"
				stroke={f.color}
				stroke-width="2"
				stroke-linecap="round"
				stroke-dasharray={f.dashed ? '5 4' : undefined}
			/>
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
