<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InteractiveMap from '#lib/components/InteractiveMap.svelte';
	import MooreaMap from '#lib/components/MooreaMap.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { date, num, season } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.site);
	const labels = $derived(data.perSeason.map((r) => season(r.season)));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow"><a href="/nurseries">Nurseries</a></p>
		<h1>{s.name}</h1>
		<p class="lede">
			{s.island}{s.code ? ` · code ${s.code}` : ''}{s.lat != null
				? ` · ${num(Math.abs(s.lat), 4)}° S, ${num(Math.abs(s.lon!), 4)}° W (${s.coordSource})`
				: ''}{s.retired ? ` · ${s.retired}` : ''}
		</p>
	</header>

	<div class="grid-4">
		<StatTile
			label="Captures"
			value={num(data.kpi.captures)}
			sub={`${num(data.kpi.individuals)} individuals over ${data.kpi.seasons} seasons`}
		/>
		<StatTile label="Sets" value={num(data.kpi.sets)} />
		<StatTile label="Sharks per net-hour" value={num(data.kpi.cpue, 2)} />
		<StatTile
			label="Newborns"
			value={num(data.kpi.newborns)}
			sub={`${num(data.sex.F)} F / ${num(data.sex.M)} M sharks`}
		/>
	</div>

	<section class="section grid-2">
		<ChartCard title="Location">
			{#if s.lat != null && s.lon != null}
				<InteractiveMap
					label={`Map of ${s.name}`}
					height={360}
					focus={{ lat: s.lat, lon: s.lon, zoom: 15 }}
					fallback={data.map}
					layers={[
						{
							name: s.name,
							color: 'var(--series-2)',
							radius: 9,
							points: data.map.filter((p) => p.id === s.id)
						},
						{
							name: 'Other nurseries',
							color: 'var(--series-1)',
							points: data.map.filter((p) => p.id !== s.id)
						}
					]}
				/>
			{:else}
				<MooreaMap points={data.map} maxR={10} showLabels={false} />
			{/if}
			{#if s.directions || s.habitat}
				<p class="small"><b>Directions (2014–15 log):</b> {s.directions ?? '–'}</p>
				<p class="small"><b>Habitat:</b> {s.habitat ?? '–'}</p>
			{/if}
			{#if s.aliases.length}<p class="muted small">
					Spellings in the logs: {s.aliases.join(', ')}
				</p>{/if}
		</ChartCard>
		<ChartCard
			title="Human pressure"
			subtitle="Bouyoucos et al. (2024), values digitised from Fig. 4"
		>
			{#if s.fishingEffort != null}
				<table class="data">
					<tbody>
						<tr><th>Fishing effort</th><td class="num">{num(s.fishingEffort)}</td></tr>
						<tr><th>Direct human impact</th><td class="num">{num(s.humanImpact, 3)}</td></tr>
						<tr
							><th>Coastal artificialisation</th><td class="num">{num(s.artificialisation, 3)}</td
							></tr
						>
						<tr
							><th>Composite (0–1)</th><td class="num"
								>{num(s.pressureComposite, 2)} · {s.pressureTier}</td
							></tr
						>
					</tbody>
				</table>
				<p class="small muted">
					The paper found no significant effect of these pressures on neonate abundance. <a
						href="/pressure">More →</a
					>
				</p>
			{:else}
				<p class="muted">Not scored in the pressure ranking.</p>
			{/if}
		</ChartCard>
		<ChartCard title="Captures per season">
			<BarChart
				stacked
				categories={labels}
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.perSeason.map((r) => r.cm)
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						values: data.perSeason.map((r) => r.na)
					}
				]}
				hrefs={data.perSeason.map((r) => `/seasons/${r.season}`)}
			/>
		</ChartCard>
		<ChartCard
			title="Catch rate per season"
			papers={['eustache2024density']}
			subtitle="Sharks per net-hour"
		>
			<LineChart
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-1)',
						dots: true,
						points: data.perSeason.map((r, i) => ({ x: i, y: r.cpue }))
					}
				]}
				xFormat={(v) => labels[Math.round(v)] ?? ''}
				yFormat={(v) => num(v, 2)}
				yZero
			/>
		</ChartCard>
		<ChartCard title="Sizes" subtitle="Total length at first capture each season">
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
			title="Where its sharks turn up next"
			papers={['bouyoucos2020homerange']}
			subtitle="Consecutive captures of the same shark that involve this nursery"
		>
			{#if data.moves.length}
				<BarChart
					horizontal
					categories={data.moves.map((m) => m.name)}
					series={[
						{ name: 'Recaptures', color: 'var(--series-3)', values: data.moves.map((m) => m.n) }
					]}
					labels
				/>
			{:else}
				<p class="muted">No recaptures recorded here yet.</p>
			{/if}
		</ChartCard>
	</section>

	{#if data.insitu}
		{@const t = data.insitu}
		<section class="section grid-2">
			<ChartCard
				title="Water temperature here"
				papers={['bouyoucos2022nursery']}
				subtitle={`In-situ loggers, ${date(t.first)} to ${date(t.last)}: monthly means of the daily high, mean and low`}
				note={t.vsIsland != null
					? `Averaged ${num(t.mean, 1)} °C over ${num(t.days)} logged days, ${num(Math.abs(t.vsIsland), 2)} °C ${t.vsIsland >= 0 ? 'warmer' : 'cooler'} than the mean of all nurseries logged on the same days.`
					: `Averaged ${num(t.mean, 1)} °C over ${num(t.days)} logged days.`}
			>
				<LineChart
					xType="date"
					yLabel="°C"
					yFormat={(v) => num(v, 1)}
					series={[
						{ name: 'Daily high', color: 'var(--series-2)', points: t.monthly.max },
						{ name: 'Daily mean', color: 'var(--series-1)', points: t.monthly.mean },
						{ name: 'Daily low', color: 'var(--series-3)', points: t.monthly.min }
					]}
				/>
			</ChartCard>
			<ChartCard
				title="The daily cycle here"
				subtitle="Mean temperature by hour in the warm (Nov–Apr) and cool (May–Oct) months"
			>
				<LineChart
					xLabel="Hour"
					yLabel="°C"
					xFormat={(h) => `${String(h).padStart(2, '0')}:00`}
					yFormat={(v) => num(v, 1)}
					series={[
						{ name: 'Warm months', color: 'var(--series-2)', points: t.diel.warm },
						{ name: 'Cool months', color: 'var(--series-1)', points: t.diel.cool }
					]}
				/>
			</ChartCard>
		</section>
	{/if}

	{#if data.hobo.length}
		<section class="section card">
			<h2 class="h">Temperature loggers</h2>
			<DataTable
				columns={[
					{ key: 'season', label: 'Season log' },
					{ key: 'logger', label: 'Logger' },
					{ key: 'deployedL', label: 'Deployed' },
					{ key: 'retrievedL', label: 'Last checked / retrieved' },
					{ key: 'status', label: 'Status' }
				]}
				rows={data.hobo.map((h) => ({
					...h,
					deployedL: date(h.deployed),
					retrievedL: date(h.retrieved)
				}))}
			/>
			<p class="muted small">
				HOBO deployments as recorded in the season workbooks. The logged temperatures are on the <a
					href="/water-quality">water-quality page</a
				>.
			</p>
		</section>
	{/if}

	{#if data.notes.length}
		<section class="section">
			<h2>Recent field notes</h2>
			<ul class="notes">
				{#each data.notes as n, i (i)}<li>
						<span class="muted small">{date(n.date)} · {n.kind}</span>
						{n.text}
					</li>{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
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
	th {
		text-align: left;
	}
</style>
