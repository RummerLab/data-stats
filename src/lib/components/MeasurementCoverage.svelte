<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Heatmap from './charts/Heatmap.svelte';
	import { plural } from '#lib/format';
	import type { measurementCoverage } from '#lib/server/analytics/measurementCoverage';
	let { data }: { data: ReturnType<typeof measurementCoverage> } = $props();

	// Don't round 99.6% up to a complete 100%, or 0.4% down to nothing.
	const share = (v: number) =>
		v >= 100 ? '100%' : v > 99 ? '>99%' : v > 0 && v < 1 ? '<1%' : `${Math.round(v)}%`;
	const panels = $derived([
		{
			title: 'Field captures: share with each measurement',
			subtitle: 'Every field capture, recaptures included',
			panel: data.captures
		},
		{
			title: 'Gillnet sets: share with each measurement',
			subtitle: 'Every gillnet set; SST, rain and tide are joined from outside sources',
			panel: data.sets
		}
	]);
</script>

<section class="section" id="coverage">
	<h2>What was recorded, season by season</h2>
	<p>
		The share of records with a value for each measurement, which shows what each comparison on this
		site can draw on. It is not a check that the values are right, and it says nothing about the
		lab's work. A zero counts as recorded. A blank can't tell a skipped measurement from one the
		protocol didn't call for that season. A dashed cell has no records to count. Each table gives
		the counts.
	</p>
	<p class="small muted">
		Lavage results count only captures marked as lavaged or with a result. Of the rest, {plural(
			data.unknownLavage,
			'capture doesn’t',
			'captures don’t'
		)} say whether the shark was lavaged and {plural(data.notLavaged, 'was', 'were')} marked as not lavaged.
	</p>
	{#each panels as p (p.title)}
		<ChartCard
			title={p.title}
			subtitle={p.subtitle}
			table={{
				columns: [
					{ key: 'season', label: 'Season' },
					{ key: 'field', label: 'Measurement' },
					{ key: 'available', label: 'Recorded', num: true },
					{ key: 'eligible', label: 'Eligible', num: true },
					{ key: 'percent', label: 'Recorded %', num: true, dp: 1 }
				],
				rows: p.panel.rows
			}}
		>
			<Heatmap
				xLabels={p.panel.fields}
				yLabels={p.panel.seasons}
				values={p.panel.values}
				domain={[0, 100]}
				format={share}
				cellLabels
				xTitle="Measurement"
				yTitle="Season"
			/>
		</ChartCard>
	{/each}
</section>
