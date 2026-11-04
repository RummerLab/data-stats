<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Scatter from './charts/Scatter.svelte';
	import BarChart from './charts/BarChart.svelte';
	import type { modelDiagnostics } from '#lib/server/analytics/modelDiagnostics';
	let { groups }: { groups: { name: string; data: ReturnType<typeof modelDiagnostics> }[] } =
		$props();
	let selected = $state(0);
	const group = $derived(groups[selected]);
	const d = $derived(group?.data);
	const maxRate = $derived(
		Math.max(1, ...(d?.bins.flatMap((b) => [b.expected, b.observed]) ?? []))
	);
	const columns = [
		{ key: 'bin', label: 'Fitted-count bin', num: true },
		{ key: 'n', label: 'Sets', num: true },
		{ key: 'min', label: 'Min fitted count', num: true },
		{ key: 'max', label: 'Max fitted count', num: true },
		{ key: 'hours', label: 'Net-hours', num: true },
		{ key: 'expected', label: 'Expected / net-hour', num: true },
		{ key: 'observed', label: 'Observed / net-hour', num: true }
	];
</script>

<details class="section">
	<summary>How well does the model describe the catches?</summary>
	<p class="muted small">
		In-sample fit checks, not forecasting skill or causal evidence. Repeated sets and nights are not
		independent. No uncertainty bands are implied. Nursery and season fixed effects cannot directly
		predict unseen levels.
	</p>
	<label
		>Model <select bind:value={selected}
			>{#each groups as g, i (g.name)}<option value={i}>{g.name}</option>{/each}</select
		></label
	>
	{#if d}
		<p>
			{d.n} sets in the fitted sample. Calibration bins contain approximately equal numbers of sets, ordered
			by expected count. Zero-catch groups need at least 20 sets; all group counts remain in the tables.
		</p>
		<div class="grid-2">
			<ChartCard
				title="Observed and expected catch rates"
				subtitle="Both rates are summed counts divided by summed net-hours in each fitted-count bin"
				table={{ columns, rows: d.bins }}
			>
				<Scatter
					points={d.bins.map((b) => ({
						x: b.expected,
						y: b.observed,
						label: `Bin ${b.bin}: ${b.n} sets`
					}))}
					fits={[
						{
							name: '1:1',
							color: 'var(--ink-2)',
							dashed: true,
							points: [
								{ x: 0, y: 0 },
								{ x: maxRate, y: maxRate }
							]
						}
					]}
					xLabel="Expected sharks / net-hour"
					yLabel="Observed sharks / net-hour"
				/>
			</ChartCard>
			{#each [{ name: 'nursery', rows: d.sites }, { name: 'season', rows: d.seasons }] as panel (panel.name)}
				{@const rows = panel.rows.filter((r) => r.n >= 20)}
				<ChartCard
					title={`Zero-catch share by ${panel.name}`}
					table={{
						columns: [
							{ key: 'group', label: panel.name },
							{ key: 'n', label: 'Sets', num: true },
							{ key: 'observed', label: 'Observed fraction', num: true },
							{ key: 'expected', label: 'Expected fraction', num: true }
						],
						rows: panel.rows
					}}
				>
					{#if rows.length}<BarChart
							categories={rows.map((r) => r.group)}
							series={[
								{
									name: 'Observed',
									color: 'var(--series-1)',
									values: rows.map((r) => r.observed * 100)
								},
								{
									name: 'Expected',
									color: 'var(--series-2)',
									values: rows.map((r) => r.expected * 100)
								}
							]}
							yLabel="Zero-catch sets (%)"
						/>{:else}<p>No groups with at least 20 sets.</p>{/if}
				</ChartCard>
			{/each}
			{#each [{ key: 'expected' as const, label: 'Expected count' }, { key: 'day' as const, label: 'Days since 1 August' }] as axis (axis.key)}
				<ChartCard
					title={`Pearson residuals against ${axis.label.toLowerCase()}`}
					subtitle="Positive residuals mean more sharks than expected; negative means fewer"
				>
					<Scatter
						points={d.points.map((p) => ({ x: p[axis.key], y: p.residual }))}
						fits={[
							{
								name: 'Zero residual',
								color: 'var(--ink-2)',
								dashed: true,
								points: [
									{ x: Math.min(...d.points.map((p) => p[axis.key])), y: 0 },
									{ x: Math.max(...d.points.map((p) => p[axis.key])), y: 0 }
								]
							}
						]}
						xLabel={axis.label}
						yLabel="Pearson residual"
					/>
				</ChartCard>
			{/each}
		</div>
	{:else}<p>
			Diagnostics are unavailable: the model needs a converged fit and a supported sample.
		</p>{/if}
</details>

<style>
	label {
		display: block;
		margin: 1rem 0;
	}
	summary {
		cursor: pointer;
		font-weight: 650;
	}
</style>
