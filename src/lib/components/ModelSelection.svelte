<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import BarChart from './charts/BarChart.svelte';
	import type { modelSelectionFlow } from '#lib/server/analytics/measurementCoverage';
	let { groups }: { groups: ReturnType<typeof modelSelectionFlow> } = $props();
</script>

<details class="section">
	<summary>Which sets are eligible for the catch model?</summary>
	<p>
		Sequential filters from the same selection logic used by the model. A set missing several fields
		is excluded once. Eligibility does not guarantee a converged fit: the model also needs at least
		200 base sets, two nurseries and two seasons, and each species fit needs two supported
		nurseries. The all-sharks model has no species catch threshold.
	</p>
	{#each groups as g (g.name)}
		<ChartCard
			title={`Sample selection: ${g.name}`}
			table={{
				columns: [
					{ key: 'stage', label: 'Stage' },
					{ key: 'remaining', label: 'Remaining sets', num: true },
					{ key: 'excluded', label: 'Excluded at this step', num: true }
				],
				rows: g.rows
			}}
		>
			<BarChart
				horizontal
				categories={g.rows.map((r) => r.stage)}
				series={[
					{
						name: 'Remaining sets',
						color: 'var(--series-1)',
						values: g.rows.map((r) => r.remaining)
					}
				]}
			/>
		</ChartCard>
	{/each}
</details>
