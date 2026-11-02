<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { num } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Row = (typeof data.rows)[number];
	const pts = (fx: (r: Row) => number | null, fy: (r: Row) => number | null) =>
		data.rows
			.filter((r) => fx(r) != null && fy(r) != null)
			.map((r) => ({ x: fx(r)!, y: fy(r)!, label: r.name, href: `/nurseries/${r.id}` }));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Human pressure</h1>
		<p class="lede">
			Ten nurseries were scored for three human pressures by Bouyoucos et al. (2024, <i
				>Marine and Freshwater Research</i
			> 75, MF24080): relative fin-fish fishing effort (a proxy for bycatch, not shark fishing, banned
			since 2012), direct human impact (people moving around homes and tourism sites) and coastal artificialisation
			(walls and embankments). Values here were digitised from the paper's Figure 4.
		</p>
		<p class="callout small">
			The paper found <b>no significant effect</b> of any of these pressures on newborn abundance. With
			only ten nurseries, the correlations below can't overturn that; they show exposure, and whether
			this longer dataset hints at anything worth testing.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Pressure scores by nursery"
			subtitle="Each metric min–max normalised to 0–1 and averaged for the composite"
		>
			<BarChart
				horizontal
				categories={data.rows.map((r) => r.name)}
				series={[
					{
						name: 'Composite pressure',
						color: 'var(--series-8)',
						values: data.rows.map((r) => r.composite)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
				hrefs={data.rows.map((r) => `/nurseries/${r.id}`)}
			/>
		</ChartCard>
		<ChartCard
			title="Correlations with shark outcomes"
			subtitle="Spearman ρ across nurseries (n ≤ 10): blue negative, red positive"
		>
			<Heatmap
				xLabels={data.outcomes}
				yLabels={data.corr.map((c) => c.metric)}
				values={data.corr.map((c) => c.values)}
				mode="div"
				domain={[-1, 1]}
				cellLabels
				format={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard title="Fishing effort vs catch rate">
			<Scatter
				points={[
					...pts(
						(r) => r.fishing,
						(r) => r.cpueCm
					).map((p) => ({ ...p, g: 'Blacktip' })),
					...pts(
						(r) => r.fishing,
						(r) => r.cpueNa
					).map((p) => ({ ...p, g: 'Lemon' }))
				]}
				groups={[
					{ name: 'Blacktip', color: SPECIES.Cm.color },
					{ name: 'Lemon', color: SPECIES.Na.color }
				]}
				xLabel="Fishing effort"
				yLabel="Sharks / net-hour"
				yFormat={(v) => num(v, 2)}
				r={6}
				opacity={0.85}
			/>
		</ChartCard>
		<ChartCard title="Coastal artificialisation vs newborn condition">
			<Scatter
				points={pts(
					(r) => r.artif,
					(r) => r.k
				)}
				xLabel="Artificialisation index"
				yLabel="Newborn blacktip K"
				xFormat={(v) => num(v, 2)}
				yFormat={(v) => num(v, 2)}
				r={6}
				opacity={0.85}
			/>
		</ChartCard>
		<ChartCard title="Direct human impact vs growth">
			<Scatter
				points={pts(
					(r) => r.human,
					(r) => r.growth
				)}
				xLabel="Direct human impact"
				yLabel="Median growth (mm/day)"
				xFormat={(v) => num(v, 2)}
				yFormat={(v) => num(v, 2)}
				r={6}
				opacity={0.85}
			/>
		</ChartCard>
		<ChartCard title="Composite pressure vs blacktip catch rate">
			<Scatter
				points={pts(
					(r) => r.composite,
					(r) => r.cpueCm
				)}
				xLabel="Composite pressure (0–1)"
				yLabel="Sharks / net-hour"
				xFormat={(v) => num(v, 1)}
				yFormat={(v) => num(v, 2)}
				r={6}
				opacity={0.85}
			/>
		</ChartCard>
	</section>

	<section class="section card">
		<DataTable
			columns={[
				{ key: 'name', label: 'Nursery', href: 'href' },
				{ key: 'fishing', label: 'Fishing', num: true },
				{ key: 'human', label: 'Human impact', num: true, dp: 3 },
				{ key: 'artif', label: 'Artificial.', num: true, dp: 3 },
				{ key: 'composite', label: 'Composite', num: true, dp: 2 },
				{ key: 'tier', label: 'Tier' },
				{ key: 'cpueCm', label: 'Cm/h', num: true },
				{ key: 'cpueNa', label: 'Na/h', num: true },
				{ key: 'k', label: 'K', num: true, dp: 3 },
				{ key: 'growth', label: 'mm/day', num: true, dp: 3 }
			]}
			rows={data.rows.map((r) => ({ ...r, href: `/nurseries/${r.id}` }))}
		/>
	</section>
</div>
