<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { num, pValue } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const groups = [
		{ name: 'Cm', color: SPECIES.Cm.color },
		{ name: 'Na', color: SPECIES.Na.color }
	];
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Growth</h1>
		<p class="lede">
			Pups caught twice tell us how fast they grow. Growth here is the change in total length
			between consecutive captures of the same tagged shark, at least a week apart, within one
			season ({num(data.n)} pairs). Median: blacktip
			{num(data.medianCm, 2)} mm/day, sicklefin lemon {num(data.medianNa, 2)} mm/day.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Growth-rate distribution"
			subtitle="mm per day between captures; small negative values are measurement error"
		>
			<Histogram
				edges={data.edges}
				series={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, counts: data.histCm },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, counts: data.histNa }
				]}
				xLabel="Growth (mm/day)"
				xFormat={(v) => num(v, 1)}
				markers={[{ x: 0, label: 'no growth' }]}
			/>
		</ChartCard>
		<ChartCard
			title="Short intervals are noisier"
			subtitle="Growth rate against days between captures"
		>
			<Scatter
				points={data.scatter}
				{groups}
				xLabel="Days between captures"
				yLabel="mm/day"
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		<ChartCard
			title="Do pups grow faster in warmer water?"
			papers={['bouyoucos2022nursery']}
			subtitle="Blacktip growth against mean sea-surface temperature between the two captures"
			note={data.sstFit
				? `Slope ${num(data.sstFit.slope, 2)} mm/day per °C, R² ${num(data.sstFit.r2, 2)}, ${pValue(data.sstFit.p)}, n = ${data.sstFit.n}. Satellite SST is offshore; nursery water is warmer and more variable (in-situ loggers: #10).`
				: ''}
		>
			<Scatter
				points={data.sstScatter}
				fits={data.sstFit
					? [{ name: 'Linear fit', color: 'var(--ink)', points: data.sstFit.points }]
					: []}
				xLabel="Mean SST (°C)"
				yLabel="mm/day"
				xFormat={(v) => num(v, 1)}
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		<ChartCard
			title="Growth against starting size"
			subtitle="Growth rate against length at the first of the two captures"
		>
			<Scatter
				points={data.sizeScatter}
				{groups}
				xLabel="TL at first capture (mm)"
				yLabel="mm/day"
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		<ChartCard
			title="Growth by nursery"
			papers={['bouyoucos2022nursery']}
			subtitle="Nurseries with ≥ 5 recapture pairs"
		>
			<BoxPlot boxes={data.bySite} yLabel="mm/day" yFormat={(v) => num(v, 2)} />
		</ChartCard>
		<ChartCard
			title="Mass change"
			subtitle="Grams per day between captures. Newborns can lose mass while using up the liver energy reserves from their mother."
		>
			<Scatter points={data.mass} {groups} xLabel="Days between captures" yLabel="g/day" />
		</ChartCard>
		<ChartCard
			title="Lab vs field length growth"
			subtitle="Blacktips recaptured in the wild against sharks held at CRIOBE for experiments"
		>
			<BoxPlot boxes={data.labVsField} yLabel="mm/day" yFormat={(v) => num(v, 2)} />
		</ChartCard>
		<ChartCard title="Lab vs field mass change" subtitle="Grams per day">
			<BoxPlot boxes={data.labMass} yLabel="g/day" yFormat={(v) => num(v, 1)} />
		</ChartCard>
	</section>

	{#if data.acrossSeasons.length}
		<section class="section card">
			<h2 class="h">Sharks seen again in a later season</h2>
			<DataTable
				columns={[
					{ key: 'id', label: 'Shark', href: 'href' },
					{ key: 'species', label: 'Species' },
					{ key: 'tl0', label: 'TL first (mm)', num: true },
					{ key: 'days', label: 'Days apart', num: true },
					{ key: 'rate', label: 'mm/day', num: true, dp: 3 }
				]}
				rows={data.acrossSeasons.map((r) => ({
					...r,
					href: `/sharks/${encodeURIComponent(r.id)}`
				}))}
			/>
		</section>
	{/if}
</div>

<style>
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
