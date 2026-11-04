<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Heatmap from './charts/Heatmap.svelte';
	import type { measurementCoverage } from '#lib/server/analytics/measurementCoverage';
	let { data }: { data: ReturnType<typeof measurementCoverage> } = $props();
</script>

<section class="section">
	<h2>Measurement availability</h2>
	<p class="muted small">
		Recorded values, not accuracy or lab performance. Zero counts as available. Null does not tell
		us whether a measurement was omitted by protocol. Grey means no eligible records; pale blue
		means 0% recorded and dark blue means 100%. Counts and denominators are in each table.
	</p>
	<p class="small">
		Capture denominators are all field captures (including recaptures); set denominators are all
		gillnet sets. The lavage column includes only captures marked lavaged or with a recorded result. {data.unknownLavage}
		captures have unknown sampling status and no result; {data.notLavaged} are explicitly not lavaged
		with no result.
	</p>
	{#each [{ name: 'Field captures', panel: data.captures }, { name: 'Gillnet sets', panel: data.sets }] as p (p.name)}
		<ChartCard
			title={`${p.name}: coverage by season`}
			table={{
				columns: [
					{ key: 'season', label: 'Season' },
					{ key: 'field', label: 'Measurement' },
					{ key: 'available', label: 'Recorded', num: true },
					{ key: 'eligible', label: 'Eligible', num: true },
					{ key: 'percent', label: 'Recorded %', num: true }
				],
				rows: p.panel.rows
			}}
		>
			<Heatmap
				xLabels={p.panel.fields}
				yLabels={p.panel.seasons}
				values={p.panel.values}
				domain={[0, 100]}
				format={(v) => `${v.toFixed(1)}%`}
				xTitle="Measurement"
				yTitle="Season"
			/>
		</ChartCard>
	{/each}
</section>
