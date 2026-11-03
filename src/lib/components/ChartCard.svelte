<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import DataTable, { type Column } from './DataTable.svelte';
	import { collectCsv, slug, toCsv, type CsvTable } from './charts/csv';
	import { paper, paperHref, type PaperId } from '#lib/publications';

	let {
		title,
		subtitle,
		note,
		source,
		id,
		table,
		papers = [],
		children
	}: {
		title: string;
		subtitle?: string;
		note?: string;
		source?: string;
		id?: string;
		table?: { columns: Column[]; rows: Record<string, unknown>[] };
		/** Studies that analysed the same question with this dataset (`#lib/publications`). */
		papers?: PaperId[];
		children: Snippet;
	} = $props();

	// Charts inside the card register their data; the button needs JS, so it appears on mount.
	const sources = collectCsv();
	let canDownload = $state(false);
	onMount(() => (canDownload = sources.length > 0 || !!table?.rows.length));

	function download() {
		const tables: CsvTable[] = table?.rows.length
			? [
					{
						columns: table.columns.map((c) => c.label),
						rows: table.rows.map((r) =>
							table.columns.map((c) => r[c.key] as CsvTable['rows'][0][0])
						)
					}
				]
			: sources.map((s) => s());
		const url = URL.createObjectURL(new Blob([toCsv(tables)], { type: 'text/csv;charset=utf-8' }));
		const a = Object.assign(document.createElement('a'), {
			href: url,
			download: `physioshark-${slug(title)}.csv`
		});
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
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
	{#if canDownload}
		<button type="button" class="csv" onclick={download}>
			Download CSV<span class="sr"> for {title}</span>
		</button>
	{/if}
	{#if papers.length}
		<p class="papers">
			{papers.length > 1 ? 'Papers' : 'Paper'}:
			{#each papers.map(paper) as p, i (p.id)}{#if i > 0};{/if}
				<a href={paperHref(p)} title={p.title}>{p.authors} ({p.year})</a>,
				<i>{p.journal}</i>{#if p.pdf}<span class="pdf">&nbsp;(PDF)</span>{/if}{/each}
		</p>
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
	.papers {
		font-size: 0.78rem;
		color: var(--ink-2);
		margin: 8px 0 0;
		line-height: 1.5;
	}
	.pdf {
		color: var(--muted);
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
	.csv {
		align-self: flex-start;
		margin-top: 8px;
		padding: 0;
		background: none;
		border: 0;
		color: var(--accent-ink);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.tbl summary {
		cursor: pointer;
		color: var(--accent-ink);
		font-size: 0.8rem;
	}
</style>
