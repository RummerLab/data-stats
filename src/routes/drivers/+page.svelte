<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import { num, pct, pValue } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>What drives catches?</h1>
		<p class="lede">
			Every timed gillnet set ({num(data.n)} of them) joined with the sea temperature, heat stress, moon,
			tide, weather, waves and El Niño state of that evening. Catch rate (sharks per net-hour) is compared
			with each variable using Spearman rank correlation, which copes with the many zero-catch nights
			({pct(data.zero / Math.max(1, data.n))}).
		</p>
		<p class="callout small">
			These are single-variable associations: sites, seasons and variables overlap (warm years are
			also El Niño years, late sets are also darker), so a link here is a lead to test, not a cause.
			A multivariable model is tracked in issue #54.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Correlation with catch rate"
			subtitle="Spearman ρ between each variable and sharks per net-hour; bars to the right mean more sharks when the variable is higher"
			table={{
				columns: [
					{ key: 'label', label: 'Variable' },
					{ key: 'rho', label: 'ρ (all)', num: true, dp: 3 },
					{ key: 'cm', label: 'ρ blacktip', num: true, dp: 3 },
					{ key: 'na', label: 'ρ lemon', num: true, dp: 3 },
					{ key: 'pL', label: 'p' },
					{ key: 'n', label: 'Sets', num: true }
				],
				rows: data.corr.map((c) => ({ ...c, pL: pValue(c.p) }))
			}}
		>
			<BarChart
				horizontal
				categories={data.corr.map((c) => c.label)}
				series={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, values: data.corr.map((c) => c.cm) },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, values: data.corr.map((c) => c.na) }
				]}
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="How the variables relate to each other"
			subtitle="Spearman ρ between variables (blue negative, red positive)"
		>
			<Heatmap
				xLabels={data.matrixLabels}
				yLabels={data.matrixLabels}
				values={data.matrix}
				mode="div"
				format={(v) => num(v, 2)}
				domain={[-1, 1]}
			/>
		</ChartCard>
	</section>

	<section class="section">
		<h2>Catch rate across each variable's range</h2>
		<p>
			The strongest variables, split into five equal-sized groups of sets. Whiskers are 95%
			confidence intervals.
		</p>
		<div class="grid-2">
			{#each data.binned as b (b.key)}
				{#if b.bins.length}
					<ChartCard title={b.label} subtitle={b.unit ? `Bins in ${b.unit}` : undefined}>
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
				{/if}
			{/each}
		</div>
	</section>

	<section class="section grid-2">
		<ChartCard title="Day of the week" subtitle="Weekends bring more people to the beaches">
			<BarChart
				categories={data.weekday.map((w) => w.name)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-1)',
						values: data.weekday.map((w) => w.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
			/>
		</ChartCard>
		<ChartCard title="Crew size" subtitle="Do more hands (and more splashing) change the catch?">
			<BarChart
				categories={data.crewSize.map((c) => c.k)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-5)',
						values: data.crewSize.map((c) => c.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
			/>
			<DataTable
				columns={[
					{ key: 'k', label: 'Crew' },
					{ key: 'n', label: 'Sets', num: true }
				]}
				rows={data.crewSize}
			/>
		</ChartCard>
	</section>
</div>
