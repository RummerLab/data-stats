<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import { date, num, pct, season } from '#lib/format';
	import { speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Recaptures &amp; site fidelity</h1>
		<p class="lede">
			Each tagged pup that turns up again says something about where it lives and how long it stays. {pct(
				data.fidelity
			)} of recaptures happened at the same nursery as the capture before.
		</p>
	</header>

	<div class="grid-4">
		<StatTile
			label="Recapture events"
			value={num(data.pairs)}
			sub={`median ${num(data.medianDays)} days apart`}
		/>
		<StatTile label="Recaptured at the same nursery" value={pct(data.fidelity)} />
		<StatTile label="Seen in more than one season" value={num(data.multiSeason)} />
		<StatTile
			label="Recapture rate"
			value={pct(data.bySpecies.find((s) => s.key === 'Cm')?.rate)}
			sub={`blacktips · lemons ${pct(data.bySpecies.find((s) => s.key === 'Na')?.rate)}`}
		/>
	</div>

	<section class="section grid-2">
		<ChartCard
			title="Recapture rate by season"
			subtitle="Share of individuals caught more than once"
		>
			<BarChart
				categories={data.bySeason.map((r) => season(r.key))}
				series={[
					{ name: 'Recaptured', color: 'var(--series-3)', values: data.bySeason.map((r) => r.rate) }
				]}
				valueFormat={(v) => pct(v)}
			/>
		</ChartCard>
		<ChartCard title="Recapture rate by nursery">
			<BarChart
				horizontal
				categories={data.bySite.map((r) => r.name)}
				series={[
					{ name: 'Recaptured', color: 'var(--series-3)', values: data.bySite.map((r) => r.rate) }
				]}
				valueFormat={(v) => pct(v)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Days between captures"
			papers={['bouyoucos2020homerange']}
			subtitle="Consecutive captures of the same shark, weekly bins (first 20 weeks)"
		>
			<Histogram
				edges={data.edges}
				series={[{ name: 'Recaptures', color: 'var(--series-1)', counts: data.daysHist }]}
				xLabel="Days"
			/>
		</ChartCard>
		<ChartCard
			title="How many times is a shark caught?"
			papers={['lionnet2025photoid']}
			subtitle="Individuals by number of captures (6 = six or more)"
		>
			<BarChart
				categories={data.capCounts.map((c) => (c.k === 6 ? '6+' : String(c.k)))}
				series={[
					{ name: 'Sharks', color: 'var(--series-1)', values: data.capCounts.map((c) => c.n) }
				]}
				labels
			/>
		</ChartCard>
	</section>

	<section class="section">
		<ChartCard
			title="Where recaptured sharks move"
			papers={['bouyoucos2020homerange']}
			subtitle="Rows: nursery of the earlier capture. Columns: nursery of the next. The diagonal is site fidelity."
		>
			<Heatmap
				xLabels={data.nurseryNames}
				yLabels={data.nurseryNames}
				values={data.matrix}
				cellLabels
				format={(v) => (v ? num(v) : '')}
			/>
		</ChartCard>
	</section>

	<section class="section grid-2">
		<div class="card">
			<h2 class="h">Longest moves between nurseries</h2>
			<DataTable
				columns={[
					{ key: 'id', label: 'Shark', href: 'href' },
					{ key: 'sp', label: 'Species' },
					{ key: 'from', label: 'From' },
					{ key: 'to', label: 'To' },
					{ key: 'km', label: 'km', num: true, dp: 1 },
					{ key: 'days', label: 'Days', num: true }
				]}
				rows={data.longest.map((r) => ({
					...r,
					sp: speciesName(r.species),
					href: `/sharks/${encodeURIComponent(r.id)}`
				}))}
			/>
			<p class="muted small">Straight-line distance between nursery coordinates.</p>
		</div>
		<div class="card">
			<h2 class="h">Most-caught sharks</h2>
			<DataTable
				columns={[
					{ key: 'id', label: 'Shark', href: 'href' },
					{ key: 'sp', label: 'Species' },
					{ key: 'n', label: 'Captures', num: true },
					{ key: 'seasons', label: 'Seasons', num: true },
					{ key: 'firstL', label: 'First' },
					{ key: 'lastL', label: 'Last' }
				]}
				rows={data.most.map((r) => ({
					...r,
					sp: speciesName(r.species),
					firstL: date(r.first),
					lastL: date(r.last)
				}))}
			/>
		</div>
	</section>
</div>

<style>
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
