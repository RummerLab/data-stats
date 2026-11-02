<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { date, MONTH_NAMES, num, pValue, season } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const fitNote = (f: { r2: number | null; p: number; n: number } | null) =>
		f ? `R² ${num(f.r2, 2)}, ${pValue(f.p)}, ${f.n} seasons.` : '';
	const rows = $derived(data.seasonRows);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Ocean &amp; heat stress</h1>
		<p class="lede">
			Sea temperature shapes everything a newborn shark does, from how fast it burns energy to how
			quickly it grows. These series come from satellites and reanalysis just offshore of Mo'orea;
			shaded bands mark the September–February fieldwork seasons.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Sea-surface temperature"
			subtitle="Weekly mean, NOAA OISST v2.1 (0.25° cell south-west of Mo'orea)"
			source="NOAA OISST v2.1 via ERDDAP"
		>
			<LineChart
				xType="date"
				bands={data.bands}
				series={[{ name: 'SST', color: 'var(--series-2)', points: data.sst }]}
				yFormat={(v) => `${num(v, 1)}°`}
			/>
		</ChartCard>
		<ChartCard
			title="Marine heat stress"
			subtitle="Degree heating weeks (DHW): accumulated heat above the bleaching threshold. 4 = significant bleaching likely, 8 = severe."
			note={data.peak
				? `Peak ${num(data.peak.dhw, 1)} °C-weeks on ${date(data.peak.date)}; ${num(data.dhwDays)} days at or above 4.`
				: ''}
			source="NOAA Coral Reef Watch 5 km via PacIOOS ERDDAP"
		>
			<LineChart
				xType="date"
				bands={data.bands}
				series={[{ name: 'DHW', color: 'var(--series-8)', area: true, points: data.dhw }]}
				refs={[
					{ y: 4, label: 'Alert 1' },
					{ y: 8, label: 'Alert 2' }
				]}
				yZero
				yFormat={(v) => num(v, 0)}
			/>
		</ChartCard>
		<ChartCard
			title="SST anomaly"
			subtitle="Weekly mean difference from Coral Reef Watch climatology"
		>
			<LineChart
				xType="date"
				bands={data.bands}
				series={[{ name: 'Anomaly', color: 'var(--series-7)', points: data.anom }]}
				refs={[{ y: 0, label: 'normal' }]}
				yFormat={(v) => `${num(v, 1)}°`}
			/>
		</ChartCard>
		<ChartCard
			title="Seasonal cycle"
			subtitle="Mean SST by calendar month, all years: pupping happens as the water warms"
		>
			<BarChart
				categories={MONTH_NAMES}
				series={[{ name: 'SST', color: 'var(--series-2)', values: data.clim }]}
				valueFormat={(v) => `${num(v, 1)}°`}
			/>
		</ChartCard>
	</section>

	<section class="section" id="enso">
		<h2>El Niño and the Southern Oscillation</h2>
		<p>
			The Southern Oscillation Index is the pressure difference between Tahiti and Darwin, so
			Mo'orea sits at one end of the see-saw that defines El Niño. ONI above +0.5 is El Niño, below
			−0.5 La Niña.
		</p>
		<div class="grid-2">
			<ChartCard
				title="Oceanic Niño Index"
				subtitle="Monthly (3-month running mean)"
				source="NOAA CPC"
			>
				<LineChart
					xType="date"
					bands={data.bands}
					series={[{ name: 'ONI', color: 'var(--series-8)', points: data.oni }]}
					refs={[
						{ y: 0.5, label: 'El Niño' },
						{ y: -0.5, label: 'La Niña' }
					]}
					yFormat={(v) => num(v, 1)}
				/>
			</ChartCard>
			<ChartCard
				title="Southern Oscillation Index"
				subtitle="Standardised Tahiti − Darwin pressure (negative = El Niño-like)"
				source="NOAA CPC"
			>
				<LineChart
					xType="date"
					bands={data.bands}
					series={[{ name: 'SOI', color: 'var(--series-1)', points: data.soi }]}
					refs={[{ y: 0, label: '' }]}
					yFormat={(v) => num(v, 1)}
				/>
			</ChartCard>
		</div>
	</section>

	<section class="section">
		<h2>Does the ocean show up in the sharks?</h2>
		<p>
			One point per season. With only thirteen seasons, these are hints rather than conclusions.
		</p>
		<div class="grid-3">
			<ChartCard title="Sea temperature vs catch rate" note={fitNote(data.fitSstCpue)}>
				<Scatter
					points={rows
						.filter((r) => r.sst != null && r.cpue != null)
						.map((r) => ({ x: r.sst!, y: r.cpue!, label: season(r.season) }))}
					xLabel="Mean SST (°C)"
					yLabel="Sharks / net-hour"
					xFormat={(v) => num(v, 1)}
					yFormat={(v) => num(v, 2)}
					r={6}
					opacity={0.85}
					height={240}
				/>
			</ChartCard>
			<ChartCard title="El Niño vs catch rate" note={fitNote(data.fitOniCpue)}>
				<Scatter
					points={rows
						.filter((r) => r.oni != null && r.cpue != null)
						.map((r) => ({ x: r.oni!, y: r.cpue!, label: season(r.season) }))}
					xLabel="Mean ONI"
					yLabel="Sharks / net-hour"
					xFormat={(v) => num(v, 1)}
					yFormat={(v) => num(v, 2)}
					r={6}
					opacity={0.85}
					height={240}
				/>
			</ChartCard>
			<ChartCard
				title="Heat stress before pupping vs newborn condition"
				subtitle="Max DHW in Jan–Jun (while mothers are pregnant) vs mean K of newborn blacktips"
				note={fitNote(data.fitDhwK)}
			>
				<Scatter
					points={rows
						.filter((r) => r.k != null && r.n >= 10)
						.map((r) => ({
							x: r.maxDhwBefore ?? 0,
							y: r.k!,
							label: `${season(r.season)} (n = ${r.n})`
						}))}
					xLabel="Max DHW (°C-weeks)"
					yLabel="Fulton's K"
					yFormat={(v) => num(v, 2)}
					r={6}
					opacity={0.85}
					height={240}
				/>
			</ChartCard>
		</div>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Waves"
			subtitle="Weekly mean of daily maximum significant wave height offshore (ERA5-ocean). The fringing reef shelters the nurseries."
			source="Open-Meteo Marine API (ERA5-ocean, CC BY 4.0)"
		>
			<LineChart
				xType="date"
				series={[
					{ name: 'Waves', color: 'var(--series-1)', points: data.waves },
					{ name: 'Swell', color: 'var(--series-3)', points: data.swell }
				]}
				yFormat={(v) => `${num(v, 1)} m`}
			/>
		</ChartCard>
	</section>
	{#if data.lastDate}<p class="muted small">Ocean data to {date(data.lastDate)}.</p>{/if}
</div>
