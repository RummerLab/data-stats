<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import BarChart from './charts/BarChart.svelte';
	import { num, plural } from '#lib/format';
	import type { modelSelectionFlow } from '#lib/server/analytics/measurementCoverage';
	let { flow }: { flow: ReturnType<typeof modelSelectionFlow> } = $props();

	const incomplete = $derived(flow.rows[1]?.excluded ?? 0);
	const missingText = $derived(
		flow.missing.map((m, i) =>
			i ? `${num(m.n)} the ${m.label}` : `${num(m.n)} lack the ${m.label}`
		)
	);
</script>

<details class="selection">
	<summary>Which sets does the model use?</summary>
	<p>
		Each bar is the number of sets left after a filter, counted by the same code the model uses. The
		first three filters run in order and leave the sample for all sharks. Each species model then
		starts again from that sample and drops the nurseries where that species was rarely caught.
	</p>
	{#if incomplete}
		<p>
			Of the {plural(incomplete, 'set')} missing a model variable, {missingText.length > 1
				? `${missingText.slice(0, -1).join(', ')} and ${missingText.at(-1)}`
				: missingText[0]}{flow.missing.length > 1 ? `; a set can lack more than one` : ''}.
		</p>
	{/if}
	<p class="small muted">
		Being in the sample doesn't guarantee a fit: the model also needs at least {num(
			flow.minModelSets
		)} sets, two nurseries and two seasons. The sample for all sharks has {plural(
			flow.modelSets,
			'set'
		)} from {plural(flow.nurseries, 'nursery', 'nurseries')} over {plural(flow.seasons, 'season')}.
	</p>
	<ChartCard
		title="Sets left after each filter"
		subtitle="Timed gillnet sets, from all of them down to each model's sample"
		table={{
			columns: [
				{ key: 'stage', label: 'Filter' },
				{ key: 'rule', label: 'Keeps' },
				{ key: 'remaining', label: 'Sets left', num: true },
				{ key: 'nurseries', label: 'Nurseries', num: true },
				{ key: 'excluded', label: 'Left out at this filter', num: true }
			],
			rows: flow.rows
		}}
	>
		<BarChart
			horizontal
			categories={flow.rows.map((r) => r.stage)}
			series={[
				{ name: 'Sets', color: 'var(--series-1)', values: flow.rows.map((r) => r.remaining) }
			]}
			valueFormat={(v) => num(v)}
		/>
	</ChartCard>
</details>

<style>
	.selection {
		margin-top: 24px;
	}
	summary {
		cursor: pointer;
		font-weight: 650;
	}
	.selection p {
		margin: 10px 0;
	}
</style>
