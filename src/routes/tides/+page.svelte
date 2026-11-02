<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { MONTH_NAMES, num, pct } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
	const share = (xs: number[]) => {
		const t = xs.reduce((a, b) => a + b, 0) || 1;
		return xs.map((x) => x / t);
	};
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Tides</h1>
		<p class="lede">
			Mo'orea has some of the strangest tides on Earth. The moon's tide nearly cancels out here, so
			the sun's tide wins: high water comes at about noon and midnight every day, and low water
			around 6 am and 6 pm, all year round. The average daily range is only about {num(data.range)} mm.
			Data: hourly sea level from the UHSLC tide gauge in Papeete harbour, Tahiti.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Tide height by hour and month"
			subtitle="Mean height relative to the long-term average (mm). The same stripes every month: a sun-locked tide."
		>
			<Heatmap
				xLabels={hours}
				yLabels={MONTH_NAMES}
				values={data.heat}
				mode="div"
				format={(v) => `${num(v)} mm`}
			/>
		</ChartCard>
		<ChartCard
			title="When high and low tides happen"
			subtitle="Clock time of every high and low tide since 2013"
		>
			<Histogram
				mode="overlay"
				edges={data.highsEdges}
				series={[
					{ name: 'High tides', color: 'var(--series-1)', counts: data.highsHist },
					{ name: 'Low tides', color: 'var(--series-3)', counts: data.lowsHist }
				]}
				xLabel="Hour of day"
				xFormat={(v) => `${num(v)}h`}
			/>
		</ChartCard>
		<ChartCard
			title="A typical fortnight"
			subtitle={`Papeete sea level, 1–14 November ${data.exYear}, relative to average`}
		>
			<LineChart
				series={[{ name: 'Sea level', color: 'var(--series-1)', points: data.example }]}
				xFormat={(v) => `${new Date(v * 86_400_000).getUTCDate()} Nov`}
				yFormat={(v) => `${num(v)} mm`}
			/>
		</ChartCard>
		<ChartCard
			title="Average day"
			subtitle="Mean tide height by hour, all days: evening fieldwork starts near low water"
		>
			<LineChart
				series={[
					{
						name: 'Mean height',
						color: 'var(--series-1)',
						dots: true,
						points: data.daily.map((y, x) => ({ x, y }))
					}
				]}
				xFormat={(v) => `${num(v)}h`}
				yFormat={(v) => `${num(v)} mm`}
			/>
		</ChartCard>
	</section>

	<section class="section">
		<h2>Tides and catches</h2>
		<p>
			Because the tide is sun-locked and nets go in near sunset, almost every set fishes across the
			evening low tide (around 6 pm): roughly half of each set is on the falling tide and half on
			the rising one.
		</p>
		<div class="grid-2">
			<ChartCard
				title="Tide state when sharks were caught"
				subtitle="Share of captures on a rising, slack or falling tide, against how often each state occurs in the evening (17–21 h)"
			>
				<BarChart
					categories={['Rising', 'Slack', 'Falling']}
					series={[
						{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, values: share(data.trendCm) },
						{ name: SPECIES.Na.common, color: SPECIES.Na.color, values: share(data.trendNa) },
						{ name: 'Evening availability', color: 'var(--axis)', values: data.avail }
					]}
					valueFormat={(v) => pct(v)}
				/>
			</ChartCard>
			<ChartCard title="Tide height at capture" subtitle="Relative to the long-term average">
				<Histogram
					edges={data.capEdges}
					series={[{ name: 'Captures', color: 'var(--series-1)', counts: data.capTide }]}
					xLabel="Tide height (mm)"
				/>
			</ChartCard>
			<ChartCard
				title="Catch rate by tide height mid-set"
				subtitle="Whiskers: 95% confidence intervals"
			>
				<BarChart
					categories={data.cpueHeight.map((b) => b.label)}
					series={[
						{
							name: 'Sharks / net-hour',
							color: 'var(--series-1)',
							values: data.cpueHeight.map((b) => b.mean)
						}
					]}
					errors={data.cpueHeight.map((b) => (b.lo != null && b.hi != null ? [b.lo, b.hi] : null))}
					valueFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
			<ChartCard title="Catch rate by tide direction mid-set">
				<BarChart
					categories={data.cpueTrend.map((t) => `${t.k} (${t.n})`)}
					series={[
						{
							name: 'Sharks / net-hour',
							color: 'var(--series-1)',
							values: data.cpueTrend.map((t) => t.cpue)
						}
					]}
					valueFormat={(v) => num(v, 2)}
					labels
				/>
			</ChartCard>
			{#if data.fieldTide.length}
				<ChartCard
					title="Tide stage written in the field logs"
					subtitle="Catch rate by the crew's own tide note (sets in brackets)"
				>
					<BarChart
						categories={data.fieldTide.map((t) => `${t.k} (${t.n})`)}
						series={[
							{
								name: 'Sharks / net-hour',
								color: 'var(--series-5)',
								values: data.fieldTide.map((t) => t.cpue)
							}
						]}
						valueFormat={(v) => num(v, 2)}
						labels
					/>
				</ChartCard>
			{/if}
		</div>
	</section>
</div>
