<script lang="ts" module>
	/** Floating tooltip positioned inside the chart's relative wrapper. */
	export interface TipState {
		x: number;
		y: number;
		title?: string;
		lines: { label?: string; value: string; color?: string }[];
	}
</script>

<script lang="ts">
	let { tip, width }: { tip: TipState | null; width: number } = $props();
	const flip = $derived(tip ? tip.x > width * 0.6 : false);
</script>

{#if tip}
	<div
		class="tip"
		role="status"
		style:left="{tip.x}px"
		style:top="{tip.y}px"
		style:transform={flip ? 'translate(calc(-100% - 12px), -50%)' : 'translate(12px, -50%)'}
	>
		{#if tip.title}<div class="t">{tip.title}</div>{/if}
		{#each tip.lines as l, i (i)}
			<div class="l">
				{#if l.color}<span class="swatch" style:background={l.color}></span>{/if}
				{#if l.label}<span class="k">{l.label}</span>{/if}
				<span class="v">{l.value}</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.tip {
		position: absolute;
		pointer-events: none;
		z-index: 5;
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--hairline);
		box-shadow: 0 6px 24px rgb(0 0 0 / 0.14);
		border-radius: 8px;
		padding: 8px 10px;
		font-size: 0.8rem;
		line-height: 1.4;
		min-width: 120px;
		max-width: 280px;
	}
	.t {
		font-weight: 650;
		margin-bottom: 4px;
	}
	.l {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.k {
		color: var(--ink-2);
		flex: 1;
	}
	.v {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
</style>
