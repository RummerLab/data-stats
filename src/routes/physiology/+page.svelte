<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { date, num, pValue, season } from '#lib/format';
	import { SERIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const dayLabel = (day: number) => {
		const d = new Date(Date.UTC(2001, 7, 1) + day * 86_400_000);
		return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
	};
	const maxMass = $derived(Math.max(1.5, ...data.massPairs.flatMap((p) => [p.x, p.y])));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Physiology &amp; lab</h1>
		<p class="lede">
			Physioshark is a conservation-physiology project: alongside field surveys, pups are
			blood-sampled and some are kept for a few weeks at CRIOBE for experiments on temperature,
			oxygen and energy use before release. These charts summarise what the logs record about that
			work.
		</p>
	</header>

	<section class="section">
		<h2>Blood chemistry (2020–21)</h2>
		<p>
			{num(data.nBlood)} blood samples analysed for haematocrit, haemoglobin, cholesterol, free fatty
			acids and triglycerides.
		</p>
		<div class="grid-2">
			<ChartCard
				title="Haematocrit by nursery"
				papers={['schwieterman2019blood']}
				subtitle="% packed red cells: oxygen-carrying capacity"
			>
				<BoxPlot
					boxes={data.hct.map((b) => ({ ...b, color: 'var(--series-8)' }))}
					yLabel="Haematocrit (%)"
				/>
			</ChartCard>
			<ChartCard title="Triglycerides by nursery" subtitle="An energy-reserve marker">
				<BoxPlot
					boxes={data.tg.map((b) => ({ ...b, color: 'var(--series-4)' }))}
					yLabel="Triglycerides"
					yFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
			<ChartCard title="Cholesterol by nursery">
				<BoxPlot
					boxes={data.chol.map((b) => ({ ...b, color: 'var(--series-7)' }))}
					yLabel="Cholesterol"
					yFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
			<ChartCard
				title="Haematocrit and body condition"
				subtitle="Field samples matched to their capture record (season, species, shark number)"
				note={data.hctFit
					? `R² ${num(data.hctFit.r2, 2)}, ${pValue(data.hctFit.p)}, n = ${data.hctFit.n}.`
					: 'Too few matched samples.'}
			>
				<Scatter
					points={data.hctK}
					xLabel="Fulton's K"
					yLabel="Haematocrit (%)"
					xFormat={(v) => num(v, 2)}
					r={4}
				/>
			</ChartCard>
		</div>
	</section>

	<section class="section">
		<h2>Sharks in the lab</h2>
		<p>
			{num(data.nLab)} lab records across seasons; average stay {num(data.medianDays, 1)} days.{data.died
				? ` ${data.died} logged as died in captivity.`
				: ''}
		</p>
		<div class="grid-2">
			<ChartCard title="Days in captivity" papers={['bouyoucos2018deadtired']}>
				<Histogram
					edges={data.daysEdges}
					series={[{ name: 'Sharks', color: 'var(--series-1)', counts: data.daysHist }]}
					xLabel="Days"
				/>
			</ChartCard>
			<ChartCard
				title="Mass on arrival and release"
				subtitle="Above the dashed line = heavier at release"
			>
				<Scatter
					points={data.massPairs}
					fits={[
						{
							name: 'No change',
							color: 'var(--ink-2)',
							dashed: true,
							points: [
								{ x: 0.5, y: 0.5 },
								{ x: maxMass, y: maxMass }
							]
						}
					]}
					xLabel="Arrival mass (kg)"
					yLabel="Release mass (kg)"
					xFormat={(v) => num(v, 1)}
					yFormat={(v) => num(v, 1)}
					r={4}
				/>
			</ChartCard>
			<ChartCard
				title="Appetite after arrival (2020–21)"
				subtitle="Mean % of offered food eaten, by days since a shark's first logged feed"
			>
				<LineChart
					series={[
						{
							name: '% eaten',
							color: 'var(--series-3)',
							dots: true,
							points: data.feeding.map((f) => ({ x: f.x, y: f.y }))
						}
					]}
					xLabel="Days since first feed"
					yFormat={(v) => `${num(v)}%`}
					yDomain={[0, 100]}
				/>
			</ChartCard>
			<ChartCard
				title="Tank temperature"
				papers={['bouyoucos2020thermal']}
				subtitle="Daily mean across tanks, by season"
			>
				<LineChart
					series={data.wqSeries.map((s, i) => ({
						name: season(s.season),
						color: SERIES[i % 8],
						points: s.points
					}))}
					xFormat={dayLabel}
					yFormat={(v) => `${num(v, 1)}°`}
				/>
			</ChartCard>
		</div>
	</section>

	<section class="section">
		<h2>Diet</h2>
		<div class="grid-2">
			{#if data.preyTop.length}
				<ChartCard
					title="Prey species logged (2013–14)"
					papers={['debaere2024lunar']}
					subtitle="Fish found in nets or recovered by gastric lavage"
				>
					<BarChart
						horizontal
						categories={data.preyTop.map((p) => p.k)}
						series={[
							{ name: 'Records', color: 'var(--series-6)', values: data.preyTop.map((p) => p.n) }
						]}
						labels
					/>
				</ChartCard>
			{/if}
			<div class="card">
				<h3>Prey records</h3>
				<DataTable
					columns={[
						{ key: 'dateL', label: 'Date' },
						{ key: 'location', label: 'Where' },
						{ key: 'name', label: 'Prey' },
						{ key: 'size', label: 'Size' },
						{ key: 'notes', label: 'Notes' }
					]}
					rows={data.prey.map((p) => ({ ...p, dateL: date(p.date) }))}
				/>
			</div>
		</div>
	</section>

	{#if data.mouth.length}
		<section class="section card">
			<h3>Mouth gape (2019–20)</h3>
			<DataTable
				columns={[
					{ key: 'shark', label: 'Shark' },
					{ key: 'site', label: 'Nursery' },
					{ key: 'sex', label: 'Sex' },
					{ key: 'mol', label: 'Mouth length', num: true },
					{ key: 'mow', label: 'Mouth width', num: true }
				]}
				rows={data.mouth}
			/>
		</section>
	{/if}
</div>

<style>
	h3 {
		font-size: 1rem;
		margin: 0 0 8px;
	}
</style>
