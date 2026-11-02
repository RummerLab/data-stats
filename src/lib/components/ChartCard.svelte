<script lang="ts">
	import type { Snippet } from 'svelte';
	import DataTable, { type Column } from './DataTable.svelte';

	let {
		title,
		subtitle,
		note,
		source,
		id,
		table,
		children
	}: {
		title: string;
		subtitle?: string;
		note?: string;
		source?: string;
		id?: string;
		table?: { columns: Column[]; rows: Record<string, unknown>[] };
		children: Snippet;
	} = $props();
</script>

<figure class="card chart-card" {id}>
	<figcaption>
		<h3>{title}</h3>
		{#if subtitle}<p class="sub">{subtitle}</p>{/if}
	</figcaption>
	<div class="body">{@render children()}</div>
	{#if note}<p class="note">{note}</p>{/if}
	{#if table && table.rows.length}
		<details class="tbl">
			<summary>Show data ({table.rows.length} rows)</summary>
			<DataTable columns={table.columns} rows={table.rows} max={500} />
		</details>
	{/if}
	{#if source}<p class="source">Source: {source}</p>{/if}
</figure>

<style>
	.chart-card {
		margin: 0;
		display: flex;
		flex-direction: column;
	}
	h3 {
		font-size: 1rem;
		font-weight: 650;
		margin: 0;
	}
	.sub {
		margin: 2px 0 10px;
		color: var(--ink-2);
		font-size: 0.88rem;
		line-height: 1.45;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.note {
		font-size: 0.84rem;
		color: var(--ink-2);
		margin: 10px 0 0;
		line-height: 1.5;
	}
	.source {
		font-size: 0.74rem;
		color: var(--muted);
		margin: 8px 0 0;
	}
	.tbl {
		margin-top: 10px;
		font-size: 0.85rem;
	}
	.tbl summary {
		cursor: pointer;
		color: var(--accent-ink);
		font-size: 0.8rem;
	}
</style>
