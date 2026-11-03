<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import { num, pct, season } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Fieldwork</p>
		<h1>Sampling effort</h1>
		<p class="lede">
			Catch per unit effort is only meaningful if effort is known. Most sets are a gillnet across a
			shallow nursery from late afternoon until about two to three hours after sunset, repeated at
			each nursery every couple of weeks through the season. {data.gear
				.map((g) => `${g.g}: ${num(g.n)} sets`)
				.join(' · ')}.
		</p>
	</header>

	<section class="section">
		<ChartCard title="Sets per nursery and season" subtitle="Gillnet sets (numbers in cells)">
			<Heatmap
				xLabels={data.seasons.map(season)}
				yLabels={data.nurseryNames}
				values={data.setGrid}
				cellLabels
			/>
		</ChartCard>
	</section>

	<section class="section">
		<ChartCard title="Sampling calendar" subtitle="Sets per week of each season">
			<Heatmap
				xLabels={data.weekLabels}
				yLabels={data.seasons.map(season)}
				values={data.calendar}
			/>
		</ChartCard>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Net-hours per season"
			subtitle="Total time nets were fishing (sets with recorded times)"
		>
			<BarChart
				categories={data.seasons.map(season)}
				series={[{ name: 'Net-hours', color: 'var(--series-1)', values: data.hours }]}
				labels
			/>
		</ChartCard>
		<ChartCard title="How long a set lasts" subtitle="Minutes from net in to net out">
			<Histogram
				edges={data.durEdges}
				series={[{ name: 'Sets', color: 'var(--series-1)', counts: data.durHist }]}
				xLabel="Minutes"
			/>
		</ChartCard>
		<ChartCard
			title="Zero-catch nights by nursery"
			papers={['mcinturf2025aggregation']}
			subtitle="Share of timed sets with no sharks"
		>
			<BarChart
				horizontal
				categories={data.zeroBySite.map((z) => z.name)}
				series={[
					{
						name: 'Zero-catch share',
						color: 'var(--series-7)',
						values: data.zeroBySite.map((z) => z.zero)
					}
				]}
				valueFormat={(v) => pct(v)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Does repeat netting change the catch?"
			subtitle="Catch rate by visit number to the same nursery within a season"
		>
			<BarChart
				categories={data.visits.map((v) => v.v)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-3)',
						values: data.visits.map((v) => v.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
	</section>
</div>
