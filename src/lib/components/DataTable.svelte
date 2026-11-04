<script lang="ts" module>
	export interface Column {
		key: string;
		label: string;
		num?: boolean;
		dp?: number;
		href?: string; // key holding a link for this cell
	}
</script>

<script lang="ts">
	import { num } from '#lib/format';
	let {
		columns,
		rows,
		max = 200,
		label = 'Data table'
	}: {
		columns: Column[];
		rows: Record<string, unknown>[];
		max?: number;
		/** Names the scroll region for screen readers. */
		label?: string;
	} = $props();

	// A table wider than its box scrolls sideways, so keyboard users need to focus it (#150). The
	// server can't measure, so it renders every table focusable; after mount only tables that
	// overflow keep the tab stop.
	let box = $state<HTMLDivElement>();
	let overflows = $state(true);
	$effect(() => {
		const el = box;
		if (!el) return;
		const check = () => (overflows = el.scrollWidth > el.clientWidth + 1);
		check();
		const ro = new ResizeObserver(check);
		ro.observe(el);
		if (el.firstElementChild) ro.observe(el.firstElementChild);
		return () => ro.disconnect();
	});
	const shown = $derived(rows.slice(0, max));
	const fmt = (v: unknown, c: Column) =>
		v == null || v === ''
			? '–'
			: typeof v === 'number'
				? num(v, c.dp ?? (Number.isInteger(v) ? 0 : 2))
				: String(v);
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll wide tables.) -->
<div
	bind:this={box}
	class="table-scroll"
	role={overflows ? 'region' : undefined}
	aria-label={overflows ? label : undefined}
	tabindex={overflows ? 0 : undefined}
>
	<table class="data">
		<thead>
			<tr>
				{#each columns as c (c.key)}<th class:num={c.num} scope="col">{c.label}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each shown as r, i (i)}
				<tr>
					{#each columns as c (c.key)}
						<td class:num={c.num}>
							{#if c.href && r[c.href]}<a href={String(r[c.href])}>{fmt(r[c.key], c)}</a
								>{:else}{fmt(r[c.key], c)}{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	{#if rows.length > max}<p class="muted small">Showing {max} of {rows.length} rows.</p>{/if}
</div>
