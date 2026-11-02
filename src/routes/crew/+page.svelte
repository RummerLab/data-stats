<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Timeline from '#lib/components/charts/Timeline.svelte';
	import { date, num } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Fieldwork</p>
		<h1>Crew</h1>
		<p class="lede">
			{num(data.total)} people are named in the set logs: researchers, students, CRIOBE staff, volunteers
			and at least one couchsurfer. {num(data.oneTimers)} came out once. Names are as written in the logs,
			with obvious spelling variants merged (see issue #14 to correct a merge).
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Most nights on the net"
			subtitle="Number of sets each person is logged on (top 30)"
		>
			<BarChart
				horizontal
				categories={data.top.map((p) => p.person)}
				series={[{ name: 'Sets', color: 'var(--series-1)', values: data.top.map((p) => p.sets) }]}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Luckiest crew members"
			subtitle={`Sharks per net-hour on sets each person joined (≥ 25 sets). Overall average: ${num(data.overall, 2)}.`}
			note="Mostly reflects which nurseries and seasons someone worked, not personal luck."
		>
			<BarChart
				horizontal
				categories={data.lucky.map((p) => p.person)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-3)',
						values: data.lucky.map((p) => p.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Who was out when"
			subtitle="Field periods of the 25 most frequent crew members"
		>
			<Timeline rows={data.timeline} />
		</ChartCard>
		<ChartCard title="Crew size" subtitle="People named per set">
			<BarChart
				categories={data.sizes.map((s) => s.k)}
				series={[{ name: 'Sets', color: 'var(--series-5)', values: data.sizes.map((s) => s.n) }]}
				labels
			/>
			<h3 class="h">Most frequent pairings</h3>
			<DataTable
				columns={[
					{ key: 'pair', label: 'Pair' },
					{ key: 'n', label: 'Sets together', num: true }
				]}
				rows={data.pairs}
			/>
		</ChartCard>
	</section>

	<section class="section card">
		<h2 class="h2">Everyone</h2>
		<DataTable
			max={400}
			columns={[
				{ key: 'person', label: 'Name' },
				{ key: 'sets', label: 'Sets', num: true },
				{ key: 'hours', label: 'Net-hours', num: true },
				{ key: 'sharks', label: 'Sharks caught', num: true },
				{ key: 'seasons', label: 'Seasons', num: true },
				{ key: 'sites', label: 'Nurseries', num: true },
				{ key: 'firstL', label: 'First' },
				{ key: 'lastL', label: 'Last' }
			]}
			rows={data.all.map((p) => ({ ...p, firstL: date(p.first), lastL: date(p.last) }))}
		/>
	</section>
</div>

<style>
	.h {
		font-size: 0.95rem;
		margin: 16px 0 6px;
	}
	.h2 {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
