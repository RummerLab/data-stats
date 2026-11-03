<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { clock, num } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const dayLabel = (day: number) => {
		const d = new Date(Date.UTC(2001, 7, 1) + day * 86_400_000);
		return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
	};
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Time of day</h1>
		<p class="lede">
			Gillnets go in at dusk, when newborn sharks move into the shallows. Every capture time is
			compared with that evening's sunset (calculated for Mo'orea, UTC−10).
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Captures relative to sunset"
			subtitle={`Median: blacktip ${num(data.medCm)} min, sicklefin lemon ${num(data.medNa)} min after sunset`}
			stats={data.stats.sunset}
		>
			<Histogram
				edges={data.edges}
				series={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, counts: data.afterCm },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, counts: data.afterNa }
				]}
				xLabel="Minutes after sunset"
				markers={[{ x: 0, label: 'sunset' }]}
			/>
		</ChartCard>
		<ChartCard
			title="Captures by clock time"
			papers={['mcinturf2025aggregation']}
			subtitle="15-minute bins"
		>
			<Histogram
				edges={data.clockEdges}
				series={[{ name: 'Captures', color: 'var(--series-1)', counts: data.clock }]}
				xFormat={(v) => clock(v)}
				xLabel="Local time"
			/>
		</ChartCard>
		<ChartCard
			title="Catch rate through the set"
			subtitle="Sharks per net-hour in each 20-minute slice after the net goes in (only sets still fishing in that slice)"
			stats={data.stats.hazard}
		>
			<BarChart
				categories={data.hazard.map((h) => `${h.t0}–${h.t0 + 20}`)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-3)',
						values: data.hazard.map((h) => h.rate)
					}
				]}
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="How long until the first shark?"
			subtitle={`Minutes from net-in to the first capture, sets that caught at least one shark (median ${num(data.firstMedian)} min)`}
		>
			<Histogram
				edges={data.firstEdges}
				series={[{ name: 'Sets', color: 'var(--series-7)', counts: data.firstHist }]}
				xLabel="Minutes after net-in"
			/>
		</ChartCard>
		<ChartCard
			title="Sunset and net-in times through the season"
			subtitle="Dots: when each net went in. Lines: sunset, civil and nautical dusk."
			stats={data.stats.starts}
		>
			<LineChart
				series={[
					{
						name: 'Sunset',
						color: 'var(--series-2)',
						points: data.sunset.map((s) => ({ x: s.x, y: s.sunset }))
					},
					{
						name: 'Civil dusk',
						color: 'var(--series-7)',
						points: data.sunset.map((s) => ({ x: s.x, y: s.dusk }))
					},
					{
						name: 'Nautical dusk',
						color: 'var(--series-1)',
						dashed: true,
						points: data.sunset.map((s) => ({ x: s.x, y: s.nautical }))
					}
				]}
				xFormat={dayLabel}
				yFormat={(v) => clock(v)}
			/>
			<Scatter
				points={data.starts}
				xFormat={dayLabel}
				yFormat={(v) => clock(v)}
				xLabel="Date in season"
				yLabel="Net in"
				r={2.5}
				opacity={0.5}
				height={220}
			/>
		</ChartCard>
		<ChartCard
			title="Work-up time per shark"
			subtitle="Minutes from landing (or capture) to release, by season"
			stats={data.stats.workup}
		>
			<BoxPlot
				boxes={data.workup.map((b) => ({ ...b, color: 'var(--series-5)' }))}
				yLabel="Minutes"
			/>
		</ChartCard>
	</section>
</div>
