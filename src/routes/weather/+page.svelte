<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Polar from '#lib/components/charts/Polar.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
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
		<ChartCard
			title="Monthly rainfall, 2013 to now"
			subtitle={data.stormMarkers.length
				? "Dashed lines: tropical cyclones passing within 500 km of Mo'orea"
				: undefined}
		>
			<LineChart
				xType="date"
				markers={data.stormMarkers}
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
	{#if data.events}
		{@const ev = data.events}
		{@const rows = [
			...ev.afterRain,
			...(ev.afterStorm.ratio != null
				? [{ label: 'Within 2 weeks after a cyclone', ...ev.afterStorm }]
				: [])
		]}
		{@const shown = rows.filter((r) => r.ratio != null)}
		{@const clear = shown.filter((r) => r.lo! > 1 || r.hi! < 1)}
		<section class="section">
			<h2>Storms and downpours</h2>
			<p>
				A heavy-rain day here is one of the wettest 1% of days in the ERA5 record ({num(
					ev.threshold
				)} mm or more in the grid cell; {num(ev.heavyDays)} days since {ev.years[0]}). Cyclone
				tracks come from NOAA IBTrACS. Catches after each kind of event are compared with the usual
				rate for the same season and month, because both storms and downpours cluster in the wet
				season, when catches change anyway.
			</p>
			<div class="grid-2">
				<ChartCard
					title="Catch rate after storms and downpours"
					subtitle="Sharks per net-hour relative to other sets in the same season and month (1 = the usual rate). Whiskers: 95% bootstrap intervals."
					note={shown.length
						? clear.length
							? `The interval clears 1 for: ${clear.map((r) => r.label.toLowerCase()).join(', ')}.`
							: 'Every interval includes 1: no sign that a downpour or a passing cyclone changes catches in the weeks after.'
						: ''}
					table={{
						columns: [
							{ key: 'label', label: 'When' },
							{ key: 'n', label: 'Sets', num: true },
							{ key: 'r', label: 'vs usual' }
						],
						rows: rows.map((r) => ({
							...r,
							r: r.ratio != null ? `×${num(r.ratio, 2)} (${num(r.lo, 2)}–${num(r.hi, 2)})` : '–'
						}))
					}}
				>
					<BarChart
						horizontal
						categories={shown.map((r) => `${r.label} (${r.n})`)}
						series={[
							{
								name: 'Catch rate vs usual',
								color: 'var(--series-1)',
								values: shown.map((r) => r.ratio)
							}
						]}
						errors={shown.map((r) => [r.lo!, r.hi!] as [number, number])}
						valueFormat={(v) => `×${num(v, 2)}`}
						labels
					/>
				</ChartCard>
				<ChartCard
					title="When the downpours come"
					subtitle={`Heavy-rain days by month since ${ev.years[0]}${ev.wettest ? `; the wettest was ${date(ev.wettest.date)} (${num(ev.wettest.mm)} mm)` : ''}`}
				>
					<BarChart
						categories={MONTH_NAMES}
						series={[{ name: 'Heavy-rain days', color: 'var(--series-1)', values: ev.byMonth }]}
						labels
					/>
				</ChartCard>
				<div class="card">
					<h3 class="h3">Cyclones within 500 km since {ev.years[0]}</h3>
					{#if ev.storms.length}
						<DataTable
							columns={[
								{ key: 'name', label: 'Storm' },
								{ key: 'dateL', label: 'Closest' },
								{ key: 'distKm', label: 'km away', num: true },
								{ key: 'windKt', label: 'Max wind (kt)', num: true },
								{ key: 'setsAfter', label: 'Sets in next 2 weeks', num: true }
							]}
							rows={ev.storms.map((s) => ({ ...s, dateL: date(s.date) }))}
						/>
						<p class="muted small">
							Date and distance of the storm centre's closest approach. Wind is the strongest
							reported while within 500 km; 1 kt ≈ 1.85 km/h.
						</p>
					{:else}
						<p class="muted">No cyclone track passed within 500 km in this period.</p>
					{/if}
				</div>
			</div>
		</section>
	{/if}

	{#if data.lastDate}<p class="muted small">
			Weather data to {date(data.lastDate)}. Source: Open-Meteo Historical Weather API (ERA5, CC BY
			4.0). Cyclones: NOAA IBTrACS v04r01.
		</p>{/if}
</div>

<style>
	.h3 {
		font-size: 1rem;
		margin: 0 0 8px;
	}
</style>
