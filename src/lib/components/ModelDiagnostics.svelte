<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Scatter from './charts/Scatter.svelte';
	import BarChart from './charts/BarChart.svelte';
	import { num, plural, season, seasonDayLabel } from '#lib/format';
	import type { modelDiagnostics } from '#lib/server/analytics/modelDiagnostics';

	let {
		groups
	}: {
		groups: { name: string; color: string; data: ReturnType<typeof modelDiagnostics> }[];
	} = $props();

	/** Zero-catch shares from fewer sets than this are too noisy to chart (they stay in the table). */
	const MIN_GROUP_SETS = 20;

	let selected = $state(0);
	const group = $derived(groups[selected]);
	const d = $derived(group?.data);
	const maxRate = $derived(
		Math.max(0.1, ...(d?.bins.flatMap((b) => [b.expected, b.observed]) ?? []))
	);
	const binColumns = [
		{ key: 'bin', label: 'Group', num: true },
		{ key: 'n', label: 'Sets', num: true },
		{ key: 'min', label: 'Lowest expected count', num: true, dp: 2 },
		{ key: 'max', label: 'Highest expected count', num: true, dp: 2 },
		{ key: 'hours', label: 'Net-hours', num: true, dp: 1 },
		{ key: 'expected', label: 'Expected sharks / net-hour', num: true, dp: 3 },
		{ key: 'observed', label: 'Observed sharks / net-hour', num: true, dp: 3 }
	];
	const panels = $derived(
		d
			? [
					{ name: 'nursery', rows: d.sites },
					{ name: 'season', rows: d.seasons.map((r) => ({ ...r, group: season(r.group) })) }
				]
			: []
	);
	const residualPanels = $derived(
		d
			? [
					{
						title: 'Residuals against the expected catch',
						note: ' The curved bands are sets that caught 0, 1, 2… sharks.',
						xs: d.residuals.expected,
						xLabel: 'Expected sharks in the set (log scale)',
						xLog: true,
						xFormat: (v: number) => num(v, v < 1 ? 2 : 0)
					},
					{
						title: 'Residuals through the season',
						note: '',
						xs: d.residuals.day,
						xLabel: 'Date in the season',
						xLog: false,
						xFormat: seasonDayLabel
					}
				]
			: []
	);
</script>

<details class="section diagnostics" id="model-fit">
	<summary>How well does the model describe the catches?</summary>
	<p>
		These checks compare the model with the same sets it was fitted to. They show where it expects
		too many or too few sharks. They don't show how well it would forecast another season, and a
		good fit doesn't make an effect a cause. Sets from the same night or nursery aren't independent,
		so the charts carry no uncertainty bands.
	</p>
	<label class="filter">
		Model
		<select bind:value={selected}>
			{#each groups as g, i (g.name)}<option value={i}>{g.name}</option>{/each}
		</select>
	</label>
	{#if d}
		<p class="small muted">
			{plural(d.n, 'set')} in this model's sample. Zero-catch charts leave out groups with fewer than
			{MIN_GROUP_SETS} sets; their tables keep every group.
		</p>
		<div class="grid-2">
			<ChartCard
				title="Observed and expected catch rates"
				subtitle={`Sets sorted by the catch the model expects and split into ${d.bins.length} groups of about ${num(d.n / d.bins.length)}. Each point is one group's sharks per net-hour; points on the dashed line match the model.`}
				table={{ columns: binColumns, rows: d.bins }}
			>
				<Scatter
					points={d.bins.map((b) => ({
						x: b.expected,
						y: b.observed,
						g: group.name,
						label: `Group ${b.bin}: ${plural(b.n, 'set')}`
					}))}
					groups={[{ name: group.name, color: group.color }]}
					fits={[
						{
							name: 'Observed = expected',
							color: 'var(--ink-2)',
							dashed: true,
							points: [
								{ x: 0, y: 0 },
								{ x: maxRate, y: maxRate }
							]
						}
					]}
					xLabel="Expected sharks per net-hour"
					yLabel="Observed sharks per net-hour"
					r={5}
					opacity={0.9}
				/>
			</ChartCard>
			{#each panels as panel (panel.name)}
				{@const rows = panel.rows.filter((r) => r.n >= MIN_GROUP_SETS)}
				<ChartCard
					title={`Sets with no sharks, by ${panel.name}`}
					subtitle="Share of sets that caught nothing, as seen and as the model expects"
					table={{
						columns: [
							{ key: 'group', label: panel.name === 'nursery' ? 'Nursery' : 'Season' },
							{ key: 'n', label: 'Sets', num: true },
							{ key: 'observed', label: 'Observed (%)', num: true, dp: 1 },
							{ key: 'expected', label: 'Expected (%)', num: true, dp: 1 }
						],
						rows: panel.rows
					}}
				>
					{#if rows.length}
						<BarChart
							categories={rows.map((r) => r.group)}
							series={[
								{ name: 'Observed', color: group.color, values: rows.map((r) => r.observed) },
								{ name: 'Expected', color: 'var(--muted)', values: rows.map((r) => r.expected) }
							]}
							yLabel="Sets with no sharks (%)"
							valueFormat={(v) => `${num(v)}%`}
						/>
					{:else}
						<p class="muted small">No {panel.name} has {MIN_GROUP_SETS} sets in this sample.</p>
					{/if}
				</ChartCard>
			{/each}
			{#each residualPanels as r (r.title)}
				<ChartCard
					title={r.title}
					subtitle={`Each dot is a set: (observed − expected) ÷ the spread the model allows for that set. Above zero, more sharks than expected; below, fewer.${r.note}`}
				>
					<Scatter
						points={r.xs.map((x, i) => ({ x, y: d.residuals.value[i], g: group.name }))}
						groups={[{ name: group.name, color: group.color }]}
						fits={[
							{
								name: 'As expected',
								color: 'var(--ink-2)',
								dashed: true,
								points: [
									{ x: Math.min(...r.xs), y: 0 },
									{ x: Math.max(...r.xs), y: 0 }
								]
							}
						]}
						xLabel={r.xLabel}
						xLog={r.xLog}
						xFormat={r.xFormat}
						yLabel="Pearson residual"
					/>
				</ChartCard>
			{/each}
		</div>
	{:else}
		<p>Diagnostics are unavailable: the model needs a converged fit and a supported sample.</p>
	{/if}
</details>

<style>
	summary {
		cursor: pointer;
		font-weight: 650;
	}
	.diagnostics p {
		margin: 10px 0;
	}
	.filter {
		display: inline-grid;
		gap: 4px;
		font-size: 0.85rem;
		margin: 4px 0 12px;
	}
</style>
