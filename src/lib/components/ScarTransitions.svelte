<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Heatmap from './charts/Heatmap.svelte';
	import BoxPlot from './charts/BoxPlot.svelte';
	import { num } from '#lib/format';
	import { SPECIES, speciesName } from '#lib/species';
	import type { scarTransitions } from '#lib/server/analytics/scarTransitions';
	let { groups }: { groups: ReturnType<typeof scarTransitions> } = $props();
	const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
</script>

<section class="section" id="scar-transitions">
	<h2>Scar changes in the same shark</h2>
	<p class="muted small">
		Each pair is two consecutive captures of one shark in the same season with a scar stage recorded
		both times; captures without a stage are skipped. The days are the time between those captures,
		not how long the scar took to heal or the shark's age: the change happened somewhere in between.
		A last unhealed record doesn't mean the scar never healed, and pairs from one shark aren't
		independent.
	</p>
	{#each groups as g (g.species)}
		{@const name = speciesName(g.species).toLowerCase()}
		<h3>{speciesName(g.species)}</h3>
		<p class="small">
			{plural(g.pairs, 'pair')} from {plural(g.sharks, 'shark')}. Left out: {plural(
				g.excluded.identity,
				'pair'
			)} from sharks whose records disagree (sex, species or a shrinking length), {num(
				g.excluded.chronology
			)} with two captures on one day, {num(g.excluded.season)} spanning two seasons and {num(
				g.excluded.lab
			)} with a lab stay in between. {plural(g.unknown, 'capture')} had no scar stage recorded{g.missingIdentityOrDate
				? `, and ${plural(g.missingIdentityOrDate, 'capture')} no tag or date`
				: ''}. {g.backward
				? `${plural(g.backward, 'pair goes', 'pairs go')} backwards (a healed scar later recorded as open or healing); they stay in the chart for the lab to check.`
				: 'No pair goes backwards.'}
		</p>
		{#if g.pairs}
			<div class="grid-2">
				<ChartCard
					title={`Observed scar transitions: ${name}`}
					subtitle="Rows: stage at the earlier capture; columns: at the later one. Numbers are pairs, not sharks."
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
						xLabels={g.labels}
						yLabels={g.labels}
						values={g.values}
						cellLabels
						domain={[0, Math.max(1, ...g.values.flat())]}
						xTitle="Later stage"
						yTitle="Earlier stage"
					/>
				</ChartCard>
				<ChartCard
					title={`Days between scar records: ${name}`}
					subtitle="Median and interquartile range; whiskers reach observations within 1.5 IQR. Transitions with at least five pairs."
					note="A shark seen several times can add a pair to more than one row."
				>
					<BoxPlot
						boxes={g.rows
							.filter((r) => r.stats)
							.map((r) => ({
								name: `${r.from} → ${r.to}`,
								color: SPECIES[g.species].color,
								stats: r.stats
							}))}
						yLabel="Days between captures"
					/>
				</ChartCard>
			</div>
			<p class="small muted">
				Pairs per shark: {g.contributions
					.map((r) => `${plural(r.sharks, 'shark')} gave ${plural(r.pairs, 'pair')}`)
					.join(', ')}.
			</p>
		{:else}<p>No sharks were recorded at a known scar stage twice in one season.</p>{/if}
	{/each}
</section>
