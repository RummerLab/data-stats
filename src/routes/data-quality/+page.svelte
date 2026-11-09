<script lang="ts">
	import MeasurementCoverage from '#lib/components/MeasurementCoverage.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import { date, num } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let category = $state('all');
	const shown = $derived(
		category === 'all' ? data.issues : data.issues.filter((i) => i.category === category)
	);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">About</p>
		<h1>Data quality</h1>
		<p class="lede">
			The spreadsheets are the source of truth and this site never changes them. While importing, it
			notes anything odd: unit conversions, impossible measurements, dates outside their season,
			tags that disagree, capture numbers the tags don't back up, sites it doesn't recognise. This
			list is for the lab to review and fix in the source sheets.
		</p>
	</header>

	<section class="section grid-2">
		<div class="card">
			<h2 class="h">Imported files</h2>
			<p class="muted small">Last import {date(data.importedAt)}.</p>
			<DataTable
				columns={[
					{ key: 'file', label: 'Workbook or folder' },
					{ key: 'kind', label: 'Read as' },
					{ key: 'sheets', label: 'Sheets / CSVs', num: true }
				]}
				rows={data.files}
				label="Imported files"
			/>
			<p class="small">
				{Object.entries(data.counts)
					.map(([k, v]) => `${k}: ${num(v)}`)
					.join(' · ')}
			</p>
			<p class="small muted">
				Environmental data to: weather {date(data.external.weather)}, ocean {date(
					data.external.ocean
				)}, chlorophyll {date(data.external.chlorophyll)}, tide {date(data.external.tide)}, climate {data
					.external.climate ?? '–'}.
			</p>
		</div>
		<div class="card">
			<h2 class="h">Notes by type</h2>
			<DataTable
				columns={[
					{ key: 'severity', label: 'Severity' },
					{ key: 'category', label: 'Category' },
					{ key: 'n', label: 'Notes', num: true }
				]}
				rows={data.summary}
				label="Notes by type"
			/>
		</div>
	</section>

	<MeasurementCoverage data={data.coverage} />

	<section class="section card">
		<label class="filter"
			>Category
			<select bind:value={category}>
				<option value="all">All ({data.issues.length})</option>
				{#each [...new Set(data.issues.map((i) => i.category))] as c (c)}<option value={c}
						>{c}</option
					>{/each}
			</select>
		</label>
		<DataTable
			max={1000}
			columns={[
				{ key: 'severity', label: 'Severity' },
				{ key: 'category', label: 'Category' },
				{ key: 'message', label: 'Note' },
				{ key: 'where', label: 'Where' },
				{ key: 'value', label: 'Value' }
			]}
			rows={shown}
			label="Data notes"
		/>
	</section>
</div>

<style>
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
	.filter {
		display: inline-grid;
		gap: 4px;
		font-size: 0.85rem;
		margin-bottom: 12px;
	}
</style>
