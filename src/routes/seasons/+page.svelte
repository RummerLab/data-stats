<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { num, pct, season } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const labels = $derived(data.rows.map((r) => season(r.season)));
	const at = (i: number) => labels[Math.round(i)] ?? '';
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Explore</p>
		<h1>Seasons</h1>
		<p class="lede">
			Fieldwork runs from September to February, when mother sharks pup in Mo'orea's shallow
			nurseries. Each season is a report card: effort, catches, newborns, condition and the ocean it
			happened in.
		</p>
	</header>

	<section class="section card">
		<DataTable
			columns={[
				{ key: 'season', label: 'Season', href: 'href' },
				{ key: 'sets', label: 'Sets', num: true },
				{ key: 'hours', label: 'Net-hours', num: true },
				{ key: 'captures', label: 'Captures', num: true },
				{ key: 'cm', label: 'Blacktip', num: true },
				{ key: 'na', label: 'Lemon', num: true },
				{ key: 'cpue', label: 'Sharks/h', num: true },
				{ key: 'neonatePctLabel', label: 'Newborn share', num: true },
				{ key: 'tlCm', label: 'Mean TL Cm (mm)', num: true },
				{ key: 'sst', label: 'SST °C', num: true },
				{ key: 'oni', label: 'ONI', num: true },
				{ key: 'crew', label: 'Crew', num: true }
			]}
			rows={data.rows.map((r) => ({ ...r, neonatePctLabel: pct(r.neonatePct) }))}
		/>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Effort per season"
			subtitle="Gillnet sets (bars). Net-hours are in the table above."
		>
			<BarChart
				categories={labels}
				series={[{ name: 'Sets', color: 'var(--series-1)', values: data.rows.map((r) => r.sets) }]}
				labels
				hrefs={data.rows.map((r) => r.href)}
			/>
		</ChartCard>
		<ChartCard
			title="Zero-catch nights"
			subtitle="Share of timed gillnet sets that caught no sharks"
		>
			<BarChart
				categories={labels}
				series={[
					{
						name: 'Zero-catch share',
						color: 'var(--series-7)',
						values: data.rows.map((r) => r.zero)
					}
				]}
				valueFormat={(v) => pct(v)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Newborn share"
			subtitle="Share of each season's sharks (first capture) that were newborns (neonate or open/healing umbilical scar)"
		>
			<LineChart
				series={[
					{
						name: 'Newborn share',
						color: 'var(--series-3)',
						dots: true,
						points: data.rows.map((r, i) => ({ x: i, y: r.neonatePct }))
					}
				]}
				xFormat={at}
				yFormat={(v) => pct(v)}
				yZero
			/>
		</ChartCard>
		<ChartCard
			title="Blacktip size at first capture"
			subtitle="Mean total length of blacktips the first time each was caught that season"
		>
			<LineChart
				series={[
					{
						name: 'Mean TL (mm)',
						color: 'var(--series-1)',
						dots: true,
						points: data.rows.map((r, i) => ({ x: i, y: r.tlCm }))
					}
				]}
				xFormat={at}
				yFormat={(v) => num(v)}
				yLabel="Mean TL (mm)"
			/>
		</ChartCard>
		<ChartCard
			title="Sea temperature during fieldwork"
			subtitle="Mean OISST sea-surface temperature on sampling nights"
		>
			<LineChart
				series={[
					{
						name: 'SST',
						color: 'var(--series-2)',
						dots: true,
						points: data.rows.map((r, i) => ({ x: i, y: r.sst }))
					}
				]}
				xFormat={at}
				yFormat={(v) => `${num(v, 1)} °C`}
			/>
		</ChartCard>
		<ChartCard
			title="Crew size per season"
			subtitle="Distinct people named in each season's set logs"
		>
			<BarChart
				categories={labels}
				series={[
					{ name: 'People', color: 'var(--series-5)', values: data.rows.map((r) => r.crew) }
				]}
				labels
			/>
		</ChartCard>
	</section>
</div>
