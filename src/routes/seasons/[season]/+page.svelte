<script lang="ts">
	import { SST_SOURCE } from '#lib/sst';
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import FindingCard from '#lib/components/FindingCard.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { toDay } from '#lib/components/charts/scale';
	import { clock, date, num, season } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const weekLabel = (w: number) => {
		const d = new Date(Date.UTC(2001, 7, 1) + w * 7 * 86_400_000);
		return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
	};
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow"><a href="/seasons">Seasons</a></p>
		<h1>Season {season(data.season)}</h1>
		<p class="lede">
			{#if data.prev}<a href={`/seasons/${data.prev}`}>← {season(data.prev)}</a>{/if}
			{#if data.prev && data.next}·{/if}
			{#if data.next}<a href={`/seasons/${data.next}`}>{season(data.next)} →</a>{/if}
		</p>
	</header>

	<div class="grid-4">
		<StatTile
			label="Captures"
			value={num(data.kpi.captures)}
			sub={`${num(data.kpi.individuals)} individuals`}
		/>
		<StatTile
			label="Sets"
			value={num(data.kpi.sets)}
			sub={`${num(data.kpi.cpue, 2)} sharks per net-hour`}
		/>
		<StatTile
			label="Newborns"
			value={num(data.kpi.newborns)}
			sub="open or healing umbilical scar"
		/>
		<StatTile label="Recaptures" value={num(data.kpi.recaps)} sub="within this season" />
	</div>

	{#if data.rewind.length}
		<section class="section">
			<h2>Season rewind</h2>
			<div class="grid-3">
				{#each data.rewind as f (f.id)}
					<FindingCard finding={f} />
				{/each}
			</div>
		</section>
	{/if}

	<section class="section grid-2">
		<ChartCard title="Captures by nursery" subtitle="Stacked by species">
			<BarChart
				horizontal
				stacked
				categories={data.bySite.map((s) => s.name)}
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.bySite.map((s) => s.cm)
					},
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, values: data.bySite.map((s) => s.na) }
				]}
				hrefs={data.bySite.map((s) => `/nurseries/${s.id}`)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Captures week by week"
			subtitle="Weeks of the season (labelled by their first day)"
		>
			<BarChart
				stacked
				categories={data.weekly.map((w) => weekLabel(w.week))}
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.weekly.map((w) => w.cm)
					},
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, values: data.weekly.map((w) => w.na) }
				]}
			/>
		</ChartCard>
		<ChartCard title="Size distribution" subtitle="Total length at first capture this season">
			<Histogram
				edges={data.edges}
				series={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, counts: data.histCm },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, counts: data.histNa }
				]}
				xLabel="Total length (mm)"
			/>
		</ChartCard>
		<ChartCard
			title="Ocean during the season"
			subtitle="Daily satellite sea-surface temperature"
			source={SST_SOURCE}
		>
			<LineChart
				xType="date"
				series={[
					{
						name: 'SST (°C)',
						color: 'var(--series-2)',
						points: data.env.map((e) => ({ x: toDay(e.date), y: e.sst }))
					}
				]}
				yFormat={(v) => `${num(v, 1)}°`}
			/>
		</ChartCard>
	</section>

	{#if data.crew.length}
		<section class="section">
			<h2>Crew</h2>
			<p>Number of sets each person is logged on this season.</p>
			<div class="chips">
				{#each data.crew as c (c.person)}<span class="tag">{c.person} <b>{c.n}</b></span>{/each}
			</div>
		</section>
	{/if}

	<section class="section card">
		<h2 class="h">Set log</h2>
		<DataTable
			columns={[
				{ key: 'dateLabel', label: 'Date' },
				{ key: 'site', label: 'Site' },
				{ key: 'startLabel', label: 'Net in' },
				{ key: 'hours', label: 'Hours', num: true },
				{ key: 'cm', label: 'Cm', num: true },
				{ key: 'na', label: 'Na', num: true },
				{ key: 'cpue', label: 'Sharks/h', num: true },
				{ key: 'crew', label: 'Crew' },
				{ key: 'notes', label: 'Notes' }
			]}
			rows={data.sets.map((s) => ({ ...s, dateLabel: date(s.date), startLabel: clock(s.start) }))}
		/>
	</section>

	{#if data.notes.length}
		<section class="section">
			<h2>Field notes</h2>
			<ul class="notes">
				{#each data.notes as n, i (i)}
					<li><span class="muted small">{date(n.date)} · {n.site} · {n.kind}</span> {n.text}</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
	.notes {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.notes li {
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 8px;
		padding: 8px 12px;
	}
</style>
