<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Histogram from './charts/Histogram.svelte';
	import type { samplingConditions } from '#lib/server/analytics/samplingConditions';
	let { data }: { data: ReturnType<typeof samplingConditions> } = $props();
</script>

<section class="section" id="sampling-conditions">
	<h2>Which conditions did fieldwork sample?</h2>
	<p class="muted small">
		Compare distinct sampling dates with all available calendar days in one nursery-month. The
		reference includes sampling dates, so these overlapping groups are descriptive, not independent
		samples for a test. The regional weather and offshore SST are shared environmental proxies, not
		nursery measurements. Differences do not establish why trips happened or how sharks responded.
	</p>
	{#if data.site}
		<form method="GET" action="/effort#sampling-conditions">
			<label
				>Nursery <select name="nursery" value={data.site.id}
					>{#each data.sites as site (site.id)}<option value={site.id}>{site.name}</option
						>{/each}</select
				></label
			>
			<label
				>Calendar month <select name="period" value={data.period}
					>{#each data.periods as period (period)}<option value={period}>{period}</option
						>{/each}</select
				></label
			>
			<button type="submit">Compare conditions</button>
		</form>
		<p class="small">
			{data.site.name}, {data.period}: {data.sampleDays} sampling dates in {data.calendarDays} calendar
			days. Multiple sets on a date count once. Each plot uses the same daily quantity for both groups.
			Changing nursery selects its latest sampled month if the chosen month is unavailable. No months
			or nurseries are pooled.
		</p>
		<div class="grid-2">
			{#each data.metrics as m (m.key)}
				<ChartCard
					title={m.label}
					subtitle={`${m.sampled} sampled dates and ${m.all} reference dates with data`}
					note={`${m.missingSample} sampling dates and ${m.missingAll} calendar days have missing source values. Missing is not zero; percentages use only valid dates. Small samples can make distributions unstable.`}
					table={{
						columns: [
							{ key: 'from', label: `Bin start (${m.unit})`, num: true },
							{ key: 'to', label: `Bin end (${m.unit})`, num: true },
							{ key: 'sampled', label: 'Sampled dates', num: true },
							{ key: 'all', label: 'Reference dates', num: true },
							{ key: 'sampledPct', label: 'Sampled %', num: true },
							{ key: 'allPct', label: 'Reference %', num: true }
						],
						rows: m.rows
					}}
				>
					{#if m.all}
						<Histogram
							edges={m.edges}
							series={[
								{
									name: 'All available calendar days',
									color: 'var(--series-1)',
									counts: m.rows.map((r) => r.allPct!)
								},
								...(m.sampled
									? [
											{
												name: 'Sampling days',
												color: 'var(--series-2)',
												counts: m.rows.map((r) => r.sampledPct!)
											}
										]
									: [])
							]}
							mode="overlay"
							xLabel={`${m.label} (${m.unit})`}
							yLabel="Valid dates (%)"
						/>
						{#if !m.sampled}<p>No matched sampling dates; only the reference is shown.</p>{/if}
					{:else}<p>No environmental data for this month.</p>{/if}
				</ChartCard>
			{/each}
		</div>
	{:else}<p>No nursery sampling dates available.</p>{/if}
</section>

<style>
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 1rem;
	}
	label {
		display: grid;
		gap: 4px;
	}
</style>
