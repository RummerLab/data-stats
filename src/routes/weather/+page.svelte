<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Polar from '#lib/components/charts/Polar.svelte';
	import { date, MONTH_NAMES, num } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const dirs = [
		'N',
		'NNE',
		'NE',
		'ENE',
		'E',
		'ESE',
		'SE',
		'SSE',
		'S',
		'SSW',
		'SW',
		'WSW',
		'W',
		'WNW',
		'NW',
		'NNW'
	];
	const binned = $derived([
		{ title: 'Rain in the previous 24 hours', bins: data.rain },
		{ title: 'Wind speed during the set', bins: data.wind },
		{ title: 'Cloud cover during the set', bins: data.cloud },
		{ title: 'Air pressure', bins: data.pressure }
	]);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Weather</h1>
		<p class="lede">
			Hourly ERA5 reanalysis for Mo'orea (via Open-Meteo), joined to each set's net-in to net-out
			window. Fieldwork happens in the warm, wet season, when trade winds ease and storms build.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard title="Climate by month" subtitle="Mean daily maximum and minimum air temperature">
			<LineChart
				series={[
					{
						name: 'Max',
						color: 'var(--series-2)',
						dots: true,
						points: data.byMonth.map((m) => ({ x: m.m, y: m.tmax }))
					},
					{
						name: 'Min',
						color: 'var(--series-1)',
						dots: true,
						points: data.byMonth.map((m) => ({ x: m.m, y: m.tmin }))
					}
				]}
				xFormat={(v) => MONTH_NAMES[Math.round(v) - 1] ?? ''}
				yFormat={(v) => `${num(v, 1)}°`}
			/>
		</ChartCard>
		<ChartCard
			title="Rainfall by month"
			subtitle="Mean monthly total (ERA5 grid cell; real island rainfall is higher on the mountains)"
		>
			<BarChart
				categories={MONTH_NAMES}
				series={[
					{ name: 'Rain', color: 'var(--series-1)', values: data.byMonth.map((m) => m.rain) }
				]}
				valueFormat={(v) => `${num(v)} mm`}
			/>
		</ChartCard>
		<ChartCard title="Monthly rainfall, 2013 to now">
			<LineChart
				xType="date"
				series={[{ name: 'Rain', color: 'var(--series-1)', area: true, points: data.rainMonthly }]}
				yZero
				yFormat={(v) => `${num(v)} mm`}
			/>
		</ChartCard>
		<ChartCard
			title="Wind direction during sets"
			subtitle="Number of sets by mean wind direction (where the wind blows from): easterly and north-easterly trade winds dominate"
		>
			<Polar
				sectors={dirs.map((label, i) => ({ label, value: data.rose[i] }))}
				format={(v) => `${num(v)} sets`}
			/>
		</ChartCard>
	</section>

	<section class="section">
		<h2>Weather and catch rate</h2>
		<p>
			Sharks per net-hour by weather band (whiskers: 95% confidence intervals; bins with few sets
			are wide).
		</p>
		<div class="grid-2">
			{#each binned as b (b.title)}
				<ChartCard title={b.title}>
					<BarChart
						categories={b.bins.map((x) => x.label)}
						series={[
							{
								name: 'Sharks / net-hour',
								color: 'var(--series-1)',
								values: b.bins.map((x) => x.mean)
							}
						]}
						errors={b.bins.map((x) => (x.lo != null && x.hi != null ? [x.lo, x.hi] : null))}
						valueFormat={(v) => num(v, 2)}
					/>
				</ChartCard>
			{/each}
			{#if data.crewCloud.n >= 30}
				<ChartCard
					title="The crew's cloud score vs the reanalysis"
					subtitle={`Mean ERA5 cloud cover during the ${data.crewCloud.n} sets the crew scored from 1 to 4 (2020–22 set logs). Whiskers: 95% confidence intervals.`}
					note={data.crewCloud.increasing
						? `ERA5 cloud cover rises with every step of the crew's score (Spearman ρ = ${num(data.crewCloud.rho, 2)}), so the reanalysis is a fair stand-in on nights nobody scored.`
						: `Spearman ρ = ${num(data.crewCloud.rho, 2)} between the crew's score and ERA5 cloud cover.`}
				>
					<BarChart
						categories={data.crewCloud.rows.map((r) => `Score ${r.score} (${r.n})`)}
						series={[
							{
								name: 'ERA5 cloud cover (%)',
								color: 'var(--series-6)',
								values: data.crewCloud.rows.map((r) => r.mean)
							}
						]}
						errors={data.crewCloud.rows.map((r) =>
							r.lo != null && r.hi != null ? [r.lo, r.hi] : null
						)}
						yLabel="%"
						valueFormat={(v) => num(v, 0)}
					/>
				</ChartCard>
			{/if}
			<ChartCard
				title="What the crew wrote"
				subtitle="Catch rate on nights whose log mentions each kind of weather (2014–2019 logs)"
			>
				<BarChart
					horizontal
					categories={data.fieldWeather.map((f) => `${f.label} (${f.n})`)}
					series={[
						{
							name: 'Sharks / net-hour',
							color: 'var(--series-5)',
							values: data.fieldWeather.map((f) => f.cpue)
						}
					]}
					valueFormat={(v) => num(v, 2)}
					labels
				/>
			</ChartCard>
		</div>
	</section>
	{#if data.lastDate}<p class="muted small">
			Weather data to {date(data.lastDate)}. Source: Open-Meteo Historical Weather API (ERA5, CC BY
			4.0).
		</p>{/if}
</div>
