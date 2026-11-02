<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { date, num, pValue } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const m = $derived(data.means);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Adult blacktips</h1>
		<p class="lede">
			Since October 2025 the team has also caught adult blacktip reef sharks by hook and line:
			measuring them, scanning females for pregnancy with ultrasound and taking two blood samples to
			track the stress of capture.
		</p>
	</header>

	{#if data.n}
		<div class="grid-4">
			<StatTile
				label="Adults caught"
				value={num(data.n)}
				sub={`${num(data.sex.F ?? 0)} females · ${num(data.sex.M ?? 0)} males`}
			/>
			<StatTile
				label="Pregnant"
				value={`${num(data.pregnant.yes)} of ${num(data.pregnant.scanned)}`}
				sub="females scanned by ultrasound"
			/>
			<StatTile
				label="Hook to boat"
				value={`${num(m.fight, 1)} min`}
				sub={`then ${num(m.handling, 1)} min of work-up`}
			/>
			<StatTile
				label="Wait for the first shark"
				value={`${num(data.firstWait)} min`}
				sub="after the bait goes in"
			/>
		</div>

		<section class="section grid-2">
			<ChartCard title="Adult size" subtitle="Total length by sex (cm values converted to mm)">
				<Histogram
					edges={data.edges}
					series={[
						{ name: 'Female', color: 'var(--series-5)', counts: data.tlF },
						{ name: 'Male', color: 'var(--series-1)', counts: data.tlM }
					]}
					xLabel="Total length (mm)"
				/>
			</ChartCard>
			<ChartCard title="Maturity" subtitle="Field maturity assessment">
				<BarChart
					horizontal
					categories={data.maturity.map((x) => x.k)}
					series={[
						{ name: 'Sharks', color: 'var(--series-1)', values: data.maturity.map((x) => x.n) }
					]}
					labels
				/>
			</ChartCard>
			<ChartCard
				title="Lactate at the first and second blood draw"
				subtitle="Each dot is one shark; dots above the dashed line had more lactate at the second draw"
				note={`Mean lactate ${num(m.lact1, 1)} → ${num(m.lact2, 1)} mmol/L; glucose ${num(m.gluc1, 1)} → ${num(m.gluc2, 1)}; β-hydroxybutyrate ${num(m.bhb1, 2)} → ${num(m.bhb2, 2)}.`}
			>
				<Scatter
					points={data.lactPairs.map((p) => ({ x: p.l1, y: p.l2, label: p.name }))}
					fits={data.lactPairs.length
						? [
								{
									name: 'No change',
									color: 'var(--ink-2)',
									dashed: true,
									points: [0, Math.max(...data.lactPairs.flatMap((p) => [p.l1, p.l2]))].map(
										(v) => ({ x: v, y: v })
									)
								}
							]
						: []}
					xLabel="1st draw lactate (mmol/L)"
					yLabel="2nd draw lactate (mmol/L)"
					r={5}
				/>
			</ChartCard>
			<ChartCard
				title="Longer fights, more lactate?"
				subtitle="First-draw lactate against minutes from hook-up to the boat"
				note={data.lactFit
					? `Slope ${num(data.lactFit.slope, 2)} mmol/L per minute, R² ${num(data.lactFit.r2, 2)}, ${pValue(data.lactFit.p)}, n = ${data.lactFit.n}.`
					: ''}
			>
				<Scatter
					points={data.fightScatter}
					fits={data.lactFit
						? [{ name: 'Linear fit', color: 'var(--ink)', points: data.lactFit.points }]
						: []}
					xLabel="Fight time (min)"
					yLabel="Lactate (mmol/L)"
					r={5}
				/>
			</ChartCard>
			<ChartCard title="Girth against length" subtitle="Pectoral girth: pregnant females stand out">
				<Scatter
					points={data.girth}
					groups={[
						{ name: 'Pregnant', color: 'var(--series-2)' },
						{ name: 'Female', color: 'var(--series-5)' },
						{ name: 'Male', color: 'var(--series-1)' }
					]}
					xLabel="TL (mm)"
					yLabel="Pectoral girth (mm)"
					r={5}
				/>
			</ChartCard>
			<ChartCard title="Hook-and-line sessions" subtitle="Sharks per hour of bait in the water">
				<BarChart
					categories={data.effort.map((e) => `${date(e.date)} ${e.session ?? ''}`)}
					series={[
						{
							name: 'Sharks / hour',
							color: 'var(--series-1)',
							values: data.effort.map((e) => e.cpue)
						}
					]}
					valueFormat={(v) => num(v, 1)}
				/>
			</ChartCard>
		</section>
	{:else}
		<p class="muted">No adult capture datasheet found.</p>
	{/if}

	{#if data.samples.length}
		<section class="section grid-2">
			<ChartCard
				title="Adult tissue samples by island"
				subtitle="2020–21 sample inventory (vet sampling directed by E. Clua)"
			>
				<BarChart
					horizontal
					categories={data.samples.map((s) => s.k)}
					series={[
						{ name: 'Samples', color: 'var(--series-6)', values: data.samples.map((s) => s.n) }
					]}
					labels
				/>
			</ChartCard>
			{#if data.hook.length}
				<div class="card">
					<h2 class="h">Adults in the juvenile logs</h2>
					<p class="small muted">
						Large sharks caught on hook and line or outside nurseries, recorded alongside the pups.
					</p>
					<DataTable
						columns={[
							{ key: 'dateL', label: 'Date' },
							{ key: 'site', label: 'Site' },
							{ key: 'species', label: 'Species' },
							{ key: 'sex', label: 'Sex' },
							{ key: 'tl', label: 'TL (mm)', num: true }
						]}
						rows={data.hook.map((h) => ({ ...h, dateL: date(h.date) }))}
					/>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
