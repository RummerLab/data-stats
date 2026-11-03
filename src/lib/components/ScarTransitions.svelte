<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Heatmap from './charts/Heatmap.svelte';
	import BoxPlot from './charts/BoxPlot.svelte';
	import type { scarTransitions } from '#lib/server/analytics/scarTransitions';
	let { groups }: { groups: ReturnType<typeof scarTransitions> } = $props();
	const labels = ['Open', 'Healing', 'Closed'];
</script>

<section class="section">
	<h2>Scar changes in the same shark</h2>
	<p class="muted small">
		Consecutive known-stage field observations within a season; observations without a stage are
		skipped. These are days between observations, not healing time or age since birth. A last
		unhealed observation does not mean a shark never healed. Repeat pairs from one shark are not
		independent evidence.
	</p>
	{#each groups as g (g.species)}
		<h3>{g.species === 'Cm' ? 'Blacktip reef sharks' : 'Sicklefin lemon sharks'}</h3>
		<p class="small">
			{g.pairs} pairs from {g.sharks} sharks; {g.unknown} observations with unknown stages and {g.missingIdentityOrDate}
			without identity/date (counts can overlap). Excluded pairs: {g.excluded.identity} identity conflicts,
			{g.excluded.chronology} same-day/ambiguous chronology, {g.excluded.season} season boundaries, {g
				.excluded.lab} possible lab interruptions. {g.backward} backward transitions retained for review.
		</p>
		{#if g.pairs}
			<div class="grid-2">
				<ChartCard
					title="Observed scar transitions"
					subtitle="Rows: earlier observation; columns: later observation. Numbers are pairs, not unique sharks."
					table={{
						columns: [
							{ key: 'from', label: 'Earlier' },
							{ key: 'to', label: 'Later' },
							{ key: 'pairs', label: 'Pairs', num: true },
							{ key: 'sharks', label: 'Distinct sharks', num: true },
							{ key: 'backward', label: 'Backward transition' }
						],
						rows: g.rows
					}}
				>
					<Heatmap
						xLabels={labels}
						yLabels={labels}
						values={g.values}
						cellLabels
						domain={[0, Math.max(1, ...g.values.flat())]}
						xTitle="Later stage"
						yTitle="Earlier stage"
					/>
				</ChartCard>
				<ChartCard
					title="Days between scar observations"
					subtitle="Medians and interquartile ranges; whiskers extend to observations within 1.5 IQR. Transitions occurred somewhere between visits."
					note="Repeated pairs can contribute to more than one transition group."
				>
					<BoxPlot
						boxes={g.rows
							.filter((r) => r.stats)
							.map((r) => ({ name: `${r.from} → ${r.to}`, stats: r.stats }))}
						yLabel="Days between observations"
					/>
				</ChartCard>
			</div>
			<p class="small">
				Pairs contributed per shark: {g.contributions
					.map(
						(r) =>
							`${r.pairs} pair${r.pairs === 1 ? '' : 's'}: ${r.sharks} shark${r.sharks === 1 ? '' : 's'}`
					)
					.join('; ')}.
			</p>
		{:else}<p>No eligible repeat observations with known scar stages.</p>{/if}
	{/each}
</section>
