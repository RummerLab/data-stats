<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import Polar from '#lib/components/charts/Polar.svelte';
	import { num, pValue } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const t = $derived(data.timing);
	const mc = $derived(data.moonCloud);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Moon</h1>
		<p class="lede">
			Moonlight changes how visible a net is and how active predators and prey are. Moon phase,
			illumination and altitude are calculated for every set and capture from astronomical formulas
			(no lunar tide effect here: see <a href="/tides">Tides</a>).
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Catch rate around the lunar cycle"
			subtitle="Sharks per net-hour by moon phase (wedge area ∝ catch rate). New moon at the top, full moon at the bottom."
		>
			<Polar
				sectors={data.phases.map((p) => ({
					label: p.name.replace('Waxing ', 'Wax. ').replace('Waning ', 'Wan. '),
					value: p.cpue,
					sub: `${p.n} sets`
				}))}
				format={(v) => `${num(v, 2)} / h`}
				height={320}
			/>
		</ChartCard>
		<ChartCard
			title="Catch rate by phase and species"
			table={{
				columns: [
					{ key: 'name', label: 'Phase' },
					{ key: 'n', label: 'Sets', num: true },
					{ key: 'cpue', label: 'All', num: true },
					{ key: 'cpueCm', label: 'Blacktip', num: true },
					{ key: 'cpueNa', label: 'Lemon', num: true }
				],
				rows: data.phases
			}}
		>
			<BarChart
				categories={data.phases.map((p) => p.name)}
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.phases.map((p) => p.cpueCm)
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						values: data.phases.map((p) => p.cpueNa)
					}
				]}
				stacked
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="Catch rate by moon illumination"
			subtitle="Whiskers: 95% confidence intervals"
		>
			<BarChart
				categories={data.illum.map((b) => b.label)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-7)',
						values: data.illum.map((b) => b.mean)
					}
				]}
				errors={data.illum.map((b) => (b.lo != null && b.hi != null ? [b.lo, b.hi] : null))}
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="Is the moon up?"
			subtitle="Catch rate when the moon is above or below the horizon at mid-set"
		>
			<BarChart
				categories={data.upDown.map((u) => `${u.k} (${u.n})`)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-7)',
						values: data.upDown.map((u) => u.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Does cloud hide the moon?"
			subtitle="Catch rate on dark nights and on bright-moon nights (≥ 60% lit, moon above 10° at mid-set) under a clear (< 40% cloud) or overcast (≥ 70%) sky. Whiskers: 95% confidence intervals."
			note={`${mc.groups[1].mean != null && mc.groups[2].mean != null ? `Bright-moon nights averaged ${num(mc.groups[1].mean, 2)} sharks per net-hour under a clear sky and ${num(mc.groups[2].mean, 2)} under cloud (Welch ${pValue(mc.p)}). ` : ''}Moonlight reaching the water (illumination × moon height × clear sky) against catch rate: Spearman ρ = ${num(mc.rho, 2)} over ${num(mc.n)} sets.${mc.p != null && mc.p > 0.05 && mc.rho != null && Math.abs(mc.rho) < 0.1 ? ' Accounting for cloud does not reveal a moonlight effect.' : ''}`}
		>
			<BarChart
				categories={mc.groups.map((g) => `${g.k} (${g.n})`)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-7)',
						values: mc.groups.map((g) => g.mean)
					}
				]}
				errors={mc.groups.map((g) => (g.lo != null && g.hi != null ? [g.lo, g.hi] : null))}
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="Bright nights vs dark nights: when do sharks hit the net?"
			subtitle="Capture time after sunset on dark (< 25% illuminated) and bright (> 75%) nights"
			note={`Median ${num(t.dark)} min after sunset on dark nights (n = ${num(t.nDark)}) vs ${num(t.bright)} min on bright nights (n = ${num(t.nBright)}); Welch ${pValue(t.p)}.`}
		>
			<Histogram
				mode="overlay"
				edges={t.edges}
				series={[
					{ name: 'Dark nights', color: 'var(--series-1)', counts: t.histDark },
					{ name: 'Bright nights', color: 'var(--series-4)', counts: t.histBright }
				]}
				xLabel="Minutes after sunset"
				markers={[{ x: 0, label: 'sunset' }]}
			/>
		</ChartCard>
	</section>
</div>
