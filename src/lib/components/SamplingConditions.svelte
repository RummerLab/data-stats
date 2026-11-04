<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import BarChart from './charts/BarChart.svelte';
	import { num, plural } from '#lib/format';
	import type { samplingConditions } from '#lib/server/analytics/samplingConditions';
	let { data }: { data: ReturnType<typeof samplingConditions> } = $props();

	const month = (m: string | null) =>
		m
			? new Date(`${m}-15T00:00:00Z`).toLocaleDateString('en-GB', {
					month: 'short',
					year: 'numeric',
					timeZone: 'UTC'
				})
			: '–';
</script>

<section class="section" id="sampling-conditions">
	<h2>Which conditions did fieldwork sample?</h2>
	<p>
		The weather on the {plural(data.nights, 'night')} with a gillnet set, against every day of the same
		{plural(data.months, 'month')} ({month(data.first)} to {month(data.last)}). Months with more
		fieldwork count for more, so the comparison isn't just wet season against dry. The weather and
		sea temperature are one series for the whole island, so a night counts once however many
		nurseries were netted.
	</p>
	<p class="small muted">
		The reference includes the fieldwork nights themselves. A difference shows which conditions the
		data covers; it doesn't say why a trip went ahead or how the sharks responded.
	</p>
	{#if data.nights}
		<div class="grid-2">
			{#each data.metrics as m (m.key)}
				<ChartCard
					title={m.label}
					subtitle={`Share of fieldwork nights and of all days in the same months (${m.unit})`}
					stats={m.stats}
					note={m.sampled
						? `${plural(m.sampled, 'night')} and ${plural(m.refDays ?? 0, 'day')} with a value${m.nightsMissing ? `; ${plural(m.nightsMissing, 'night')} without one` : ''}${m.refMissing ? `; ${plural(m.refMissing, 'day')} in those months without one` : ''}.`
						: undefined}
					table={m.rows.length
						? {
								columns: [
									{ key: 'bin', label: m.unit },
									{ key: 'sampled', label: 'Fieldwork nights', num: true },
									{ key: 'sampledPct', label: 'Fieldwork nights (%)', num: true, dp: 1 },
									{ key: 'reference', label: 'Days in the same months', num: true },
									{ key: 'referencePct', label: 'Days, weighted (%)', num: true, dp: 1 }
								],
								rows: m.rows
							}
						: undefined}
				>
					{#if m.rows.length}
						<BarChart
							categories={m.rows.map((r) => r.bin)}
							series={[
								{
									name: 'Fieldwork nights',
									color: 'var(--series-1)',
									values: m.rows.map((r) => r.sampledPct)
								},
								{
									name: 'All days, same months',
									color: 'var(--muted)',
									values: m.rows.map((r) => r.referencePct)
								}
							]}
							yLabel="Share (%)"
							valueFormat={(v) => `${num(v, v < 10 ? 1 : 0)}%`}
						/>
					{:else}
						<p class="muted small">No values for the fieldwork nights.</p>
					{/if}
				</ChartCard>
			{/each}
		</div>
	{:else}
		<p class="muted">No nursery gillnet sets to compare.</p>
	{/if}
</section>
