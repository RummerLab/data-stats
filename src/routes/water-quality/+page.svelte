<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import Timeline from '#lib/components/charts/Timeline.svelte';
	import { num } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Fieldwork</p>
		<h1>Water quality</h1>
		<p class="lede">
			{num(data.nReadings)} spot readings of temperature, pH, dissolved oxygen and salinity taken at the
			nets (set logs and field water-quality sheets). Nursery water is shallow and swings far more than
			the open ocean.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard title="Water temperature at the net">
			<BoxPlot
				boxes={data.temp.map((b) => ({ ...b, color: 'var(--series-2)' }))}
				yLabel="°C"
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		<ChartCard
			title="Nursery water vs satellite sea temperature"
			subtitle="Each dot is a set with an in-water reading"
			note={data.fit
				? `Nursery water averaged ${num(data.fit.diff, 2)} °C ${data.fit.diff! >= 0 ? 'warmer' : 'cooler'} than offshore OISST (R² ${num(data.fit.r2, 2)}, n = ${data.fit.n}).${data.fit.diff! > 0.3 ? ' Satellite SST understates the temperatures pups live in.' : ''}`
				: ''}
		>
			<Scatter
				points={data.tempVsSst}
				fits={data.tempVsSst.length
					? [
							{
								name: 'Same temperature',
								color: 'var(--ink-2)',
								dashed: true,
								points: [26, 32].map((v) => ({ x: v, y: v }))
							}
						]
					: []}
				xLabel="Satellite SST (°C)"
				yLabel="Water at net (°C)"
				xFormat={(v) => num(v, 1)}
				yFormat={(v) => num(v, 1)}
				r={4}
			/>
		</ChartCard>
		<ChartCard title="pH">
			<BoxPlot
				boxes={data.ph.map((b) => ({ ...b, color: 'var(--series-7)' }))}
				yLabel="pH"
				yFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard title="Salinity" subtitle="ppt; freshwater runoff lowers it near streams">
			<BoxPlot
				boxes={data.sal.map((b) => ({ ...b, color: 'var(--series-1)' }))}
				yLabel="ppt"
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		{#if data.doMg.length}
			<ChartCard title="Dissolved oxygen" subtitle="mg/L">
				<BoxPlot
					boxes={data.doMg.map((b) => ({ ...b, color: 'var(--series-3)' }))}
					yLabel="mg/L"
					yFormat={(v) => num(v, 1)}
				/>
			</ChartCard>
		{/if}
	</section>

	{#if data.hobo.length}
		<section class="section">
			<ChartCard
				title="Temperature logger deployments"
				subtitle="HOBO loggers by nursery, from deployment to last check or retrieval. Raw logger series are not in the workbooks yet (issue #10)."
			>
				<Timeline rows={data.hobo} />
			</ChartCard>
		</section>
	{/if}
</div>
