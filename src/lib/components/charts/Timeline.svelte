<script lang="ts">
	import { isoDay, registerCsv } from './csv';
	import Tip, { type TipState } from './Tip.svelte';
	import { dateTicks, linear } from './scale';

	let {
		rows
	}: {
		rows: { label: string; items: { start: number; end: number; color?: string; tip: string }[] }[];
	} = $props();

	registerCsv(() => ({
		columns: ['row', 'start', 'end', 'detail'],
		rows: rows.flatMap((r) =>
			r.items.map((it) => [r.label, isoDay(it.start), isoDay(it.end), it.tip])
		)
	}));

	let width = $state(640);
	const longest = $derived(Math.max(0, ...rows.map((r) => r.label.length)));
	const m = $derived({ top: 6, right: 14, bottom: 26, left: Math.min(180, 14 + longest * 6.6) });
	const rowH = 22;
	const h = $derived(m.top + m.bottom + rows.length * rowH);
	const all = $derived(rows.flatMap((r) => r.items));
	const lo = $derived(all.length ? Math.min(...all.map((i) => i.start)) : 0);
	const hi = $derived(all.length ? Math.max(...all.map((i) => i.end)) : 1);
	const sx = $derived(linear([lo, hi], [m.left, Math.max(m.left + 10, width - m.right)]));
	let tip = $state<TipState | null>(null);
	function show(e: PointerEvent, label: string, text: string) {
		const wrap = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
		tip = {
			x: e.clientX - wrap.left,
			y: e.clientY - wrap.top,
			title: label,
			lines: [{ value: text }]
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
		aria-label="Timeline"
		onpointerleave={() => (tip = null)}
	>
		{#each dateTicks(lo, hi, Math.max(3, Math.floor(width / 90))) as t (t.v)}
			<line x1={sx(t.v)} x2={sx(t.v)} y1={m.top} y2={h - m.bottom} stroke="var(--grid)" />
			<text
				x={sx(t.v)}
				y={h - m.bottom + 16}
				text-anchor="middle"
				font-size="11"
				fill="var(--muted)">{t.label}</text
			>
		{/each}
		{#each rows as r, i (r.label + i)}
			<text
				x={m.left - 8}
				y={m.top + i * rowH + rowH / 2}
				dy="0.32em"
				text-anchor="end"
				font-size="11"
				fill="var(--ink-2)">{r.label}</text
			>
			{#each r.items as it, k (k)}
				<rect
					x={sx(it.start)}
					y={m.top + i * rowH + 4}
					width={Math.max(3, sx(it.end) - sx(it.start))}
					height={rowH - 8}
					rx="4"
					fill={it.color ?? 'var(--series-1)'}
					role="presentation"
					onpointermove={(e) => show(e, r.label, it.tip)}
				/>
			{/each}
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
