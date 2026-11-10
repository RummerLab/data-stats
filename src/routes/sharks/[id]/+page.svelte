<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import MooreaMap from '#lib/components/MooreaMap.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { toDay } from '#lib/components/charts/scale';
	import { clock, date, num } from '#lib/format';
	import { speciesColor, speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ind = $derived(data.ind);
	const growth = $derived(data.captures.filter((c) => c.date && c.tl != null));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow"><a href="/sharks">Sharks</a></p>
		<h1>{speciesName(ind.species)} <span class="id">{ind.id}</span></h1>
		<p class="lede">
			{ind.sex === 'F' ? 'Female' : ind.sex === 'M' ? 'Male' : 'Sex unknown'} · {num(ind.nCaptures)} capture{ind.nCaptures ===
			1
				? ''
				: 's'} · first seen {date(ind.firstDate)}{ind.nCaptures > 1
				? `, last seen ${date(ind.lastDate)}`
				: ''}
			{#if ind.tags.length > 1}· tags {ind.tags.join(', ')}{/if}
		</p>
		{#if ind.conflict}
			<p class="callout small">
				The captures linked to this tag disagree on <b>{ind.conflict}</b>; see
				<a href="/data-quality">data quality</a>.
			</p>
		{/if}
	</header>

	<section class="section grid-2">
		{#if growth.length > 1}
			<ChartCard title="Growth" subtitle="Total length at each capture">
				<LineChart
					xType="date"
					series={[
						{
							name: 'Total length (mm)',
							color: speciesColor(ind.species),
							dots: true,
							points: growth.map((c) => ({ x: toDay(c.date!), y: c.tl }))
						}
					]}
					yFormat={(v) => `${num(v)} mm`}
				/>
			</ChartCard>
		{/if}
		{#if data.map.length}
			<ChartCard
				title="Where it was caught"
				subtitle={data.moves.length
					? 'Circle size = number of captures. Lines join consecutive captures at different nurseries (not the route swum).'
					: 'Circle size = number of captures'}
			>
				<MooreaMap
					points={data.map}
					lines={data.moves.map((m) => ({ ...m, color: speciesColor(ind.species) }))}
					maxR={12}
					valueLabel="Captures"
				/>
			</ChartCard>
		{/if}
	</section>

	<section class="section card">
		<h2 class="h">Capture history</h2>
		<DataTable
			columns={[
				{ key: 'dateL', label: 'Date' },
				{ key: 'site', label: 'Nursery' },
				{ key: 'timeL', label: 'Time' },
				{ key: 'tl', label: 'TL (mm)', num: true },
				{ key: 'fl', label: 'FL (mm)', num: true },
				{ key: 'mass', label: 'Mass (kg)', num: true },
				{ key: 'k', label: 'K', num: true, dp: 3 },
				{ key: 'umbilical', label: 'Umbilical' },
				{ key: 'sst', label: 'SST °C', num: true },
				{ key: 'notes', label: 'Notes' },
				{ key: 'source', label: 'Source' }
			]}
			rows={data.captures.map((c) => ({ ...c, dateL: date(c.date), timeL: clock(c.time) }))}
		/>
	</section>

	{#if data.lab.length}
		<section class="section card">
			<h2 class="h">Lab stays (CRIOBE)</h2>
			<DataTable
				columns={[
					{ key: 'arrivalL', label: 'Arrived' },
					{ key: 'releaseL', label: 'Released' },
					{ key: 'days', label: 'Days', num: true },
					{ key: 'arrTl', label: 'TL in', num: true },
					{ key: 'relTl', label: 'TL out', num: true },
					{ key: 'arrMass', label: 'Mass in', num: true },
					{ key: 'relMass', label: 'Mass out', num: true },
					{ key: 'notes', label: 'Notes' }
				]}
				rows={data.lab.map((l) => ({ ...l, arrivalL: date(l.arrival), releaseL: date(l.release) }))}
			/>
		</section>
	{/if}
</div>

<style>
	.id {
		font-weight: 400;
		color: var(--ink-2);
		font-size: 0.6em;
		font-variant-numeric: tabular-nums;
	}
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
