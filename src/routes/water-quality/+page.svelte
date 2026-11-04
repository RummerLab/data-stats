<script lang="ts">
	import ThermalCalendar from '#lib/components/ThermalCalendar.svelte';
	import ChartCard from '#lib/components/ChartCard.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Legend from '#lib/components/charts/Legend.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import Timeline from '#lib/components/charts/Timeline.svelte';
	import { date, monthYear, num } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ins = $derived(data.insitu);
	const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Fieldwork</p>
		<h1>Water quality</h1>
		<p class="lede">
			{num(data.nReadings)} spot readings of temperature, pH, dissolved oxygen and salinity taken at the
			nets (set logs and field water-quality sheets). Nursery water is shallow and swings far more than
			the open ocean.{#if ins}
				Temperature loggers left in the nurseries add {num(ins.summary.readings)} readings from {monthYear(
					ins.summary.first
				)} to {monthYear(ins.summary.last)}.{/if}
		</p>
	</header>

	{#if ins}
		<section class="section">
			<h2 class="h">In-situ temperature loggers</h2>
			<p class="muted small">
				{[
					ins.summary.hoboYears && `HOBO pendants (${ins.summary.hoboYears})`,
					ins.summary.envYears && `EnvLoggers (${ins.summary.envYears})`
				]
					.filter(Boolean)
					.join(' and ')} sat on the sand in the nurseries, logging around the clock. These are the temperatures
				pups live in, day and night, rather than a satellite estimate for the open ocean. Shallow loggers
				can be exposed at low tide, so the highest readings may include some sun on the logger.
			</p>
			<div class="grid-4">
				<StatTile
					label="Logger readings"
					value={num(ins.summary.readings)}
					sub={`${ins.summary.loggers} loggers, ${ins.summary.files} downloads`}
				/>
				<StatTile
					label="Nursery-days logged"
					value={num(ins.summary.siteDays)}
					sub={`${ins.summary.nurseries} nurseries`}
				/>
				<StatTile
					label="Hottest hour logged"
					value={`${num(ins.summary.hottest.temp, 1)} °C`}
					sub={`${ins.summary.hottest.site}, ${date(ins.summary.hottest.date)}`}
				/>
				<StatTile
					label="Coolest hour logged"
					value={`${num(ins.summary.coolest.temp, 1)} °C`}
					sub={`${ins.summary.coolest.site}, ${date(ins.summary.coolest.date)}`}
				/>
			</div>
		</section>

		<section class="section grid-2">
			<ChartCard
				title="Nursery water vs offshore sea temperature"
				papers={['trujillo2025shallows']}
				subtitle="Monthly means: all logged nurseries, and satellite SST (OISST) on the same days"
				note={ins.diff != null
					? `Over ${num(ins.nPairs)} days with both, nursery water averaged ${num(Math.abs(ins.diff), 2)} °C ${ins.diff >= 0 ? 'warmer' : 'cooler'} than the satellite reading offshore.`
					: ''}
			>
				<LineChart
					xType="date"
					yLabel="°C"
					yFormat={(v) => num(v, 1)}
					series={[
						{ name: 'Nursery loggers', color: 'var(--series-1)', points: ins.monthly.logger },
						{ name: 'Offshore SST', color: 'var(--series-2)', points: ins.monthly.sst }
					]}
				/>
			</ChartCard>
			<ChartCard
				title="The daily cycle"
				papers={['trujillo2025shallows', 'bouyoucos2022nursery']}
				subtitle="Mean temperature by hour, all nurseries, warm (Nov–Apr) and cool (May–Oct) months"
				note={ins.dielAmp.warm && ins.dielAmp.cool
					? `In the warm months nursery water swings ${num(ins.dielAmp.warm.range, 1)} °C, coolest around ${hour(ins.dielAmp.warm.coolest)} and warmest around ${hour(ins.dielAmp.warm.warmest)}; in the cool months the swing is ${num(ins.dielAmp.cool.range, 1)} °C.`
					: ''}
			>
				<LineChart
					xLabel="Hour"
					yLabel="°C"
					xFormat={hour}
					yFormat={(v) => num(v, 1)}
					series={[
						{ name: 'Warm months', color: 'var(--series-2)', points: ins.diel.warm },
						{ name: 'Cool months', color: 'var(--series-1)', points: ins.diel.cool }
					]}
				/>
			</ChartCard>
			<ChartCard
				title="Daily maximum by nursery"
				papers={['bouyoucos2020thermal', 'eustache2024density']}
				subtitle="Hottest hour of each logged day, warmest nurseries first. Nurseries with at least a year of logging in both seasons."
			>
				<BoxPlot
					boxes={ins.dailyMax.map((b) => ({
						name: b.name,
						stats: b.stats,
						color: 'var(--series-2)'
					}))}
					yLabel="°C"
					yFormat={(v) => num(v, 1)}
				/>
			</ChartCard>
			{#if ins.cloud.bins.length >= 3}
				{@const oc = ins.cloud.overcastVsClear}
				<ChartCard
					title="Clouds and the nursery's afternoon"
					papers={['trujillo2025shallows']}
					subtitle="Nursery daily high and day–night swing by that day's cloud cover (ERA5), relative to the average for the same month: the cloudy wet season is also the warm season"
					note={oc
						? `Within the same month, overcast days (≥ 70% cloud) peaked ${num(Math.abs(oc.max ?? 0), 2)} °C ${(oc.max ?? 0) <= 0 ? 'cooler' : 'warmer'} than clear days (< 40%), and the day–night swing was ${num(Math.abs(oc.swing ?? 0), 2)} °C ${(oc.swing ?? 0) <= 0 ? 'smaller' : 'larger'}. Spearman ρ between cloud and the daily high: ${num(ins.cloud.rhoMax, 2)} over ${num(ins.cloud.days)} days.`
						: ''}
				>
					<LineChart
						xLabel="Cloud cover"
						yLabel="°C vs month average"
						xFormat={(v) => ins.cloud.bins.find((b) => b.x === v)?.label ?? `${v}%`}
						yFormat={(v) => num(v, 2)}
						refs={[{ y: 0, label: 'month average' }]}
						series={[
							{
								name: 'Daily high',
								color: 'var(--series-2)',
								dots: true,
								points: ins.cloud.bins.map((b) => ({ x: b.x, y: b.max }))
							},
							{
								name: 'Day–night swing',
								color: 'var(--series-1)',
								dots: true,
								points: ins.cloud.bins.map((b) => ({ x: b.x, y: b.swing }))
							}
						]}
					/>
				</ChartCard>
			{/if}
			<ChartCard
				title="Logger coverage"
				subtitle="Each bar is one logger download, from first to last kept reading"
			>
				<Legend
					items={[
						{ label: 'HOBO pendant', color: 'var(--series-3)' },
						{ label: 'EnvLogger', color: 'var(--series-5)' }
					]}
				/>
				<Timeline rows={ins.coverage} />
			</ChartCard>
		</section>
	{/if}

	<ThermalCalendar calendar={data.thermalCalendar} />

	<section class="section grid-2">
		<ChartCard title="Water temperature at the net" stats={data.stats.temp}>
			<BoxPlot
				boxes={data.temp.map((b) => ({ ...b, color: 'var(--series-2)' }))}
				yLabel="°C"
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		<ChartCard
			title="Spot readings at the net vs satellite sea temperature"
			subtitle="Each dot is a set with an in-water reading, taken in the evening"
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
		<ChartCard title="pH" papers={['bouyoucos2024abiotic']} stats={data.stats.ph}>
			<BoxPlot
				boxes={data.ph.map((b) => ({ ...b, color: 'var(--series-7)' }))}
				yLabel="pH"
				yFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="Salinity"
			papers={['bouyoucos2024abiotic']}
			subtitle="ppt; freshwater runoff lowers it near streams"
			stats={data.stats.sal}
		>
			<BoxPlot
				boxes={data.sal.map((b) => ({ ...b, color: 'var(--series-1)' }))}
				yLabel="ppt"
				yFormat={(v) => num(v, 1)}
			/>
		</ChartCard>
		{#if data.doMg.length}
			<ChartCard
				title="Dissolved oxygen"
				papers={['bouyoucos2021oxygen', 'bouyoucos2024abiotic']}
				subtitle="mg/L"
				stats={data.stats.doMg}
			>
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
				subtitle="HOBO loggers by nursery as recorded in the season workbooks, from deployment to last check or retrieval"
			>
				<Timeline rows={data.hobo} />
			</ChartCard>
		</section>
	{/if}
</div>
