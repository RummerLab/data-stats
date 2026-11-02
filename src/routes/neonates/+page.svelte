<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { num, pct, pValue, season } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const dayLabel = (day: number) => {
		const d = new Date(Date.UTC(2001, 7, 1) + day * 86_400_000);
		return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
	};
	const withWindow = $derived(data.window.filter((w) => w.n >= 5));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Newborns</h1>
		<p class="lede">
			A newborn shark carries an umbilical scar that heals over a few weeks, which lets field teams
			tell this year's pups from older juveniles. Tracking open scars through the season reveals
			when mothers give birth, and how big pups are when they arrive.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Share of pups with an unhealed scar, week by week"
			subtitle="Open or healing umbilical scars among first captures (weeks with ≥ 5 sharks)"
		>
			<LineChart
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						dots: true,
						points: data.weeks.map((w, i) => ({ x: w * 7, y: data.openCm[i] }))
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						dots: true,
						points: data.weeks.map((w, i) => ({ x: w * 7, y: data.openNa[i] }))
					}
				]}
				xFormat={dayLabel}
				yFormat={(v) => pct(v)}
				yDomain={[0, 1]}
			/>
		</ChartCard>
		<ChartCard
			title="Pups get bigger as the season goes on"
			subtitle="Total length at first capture against date"
			note={[
				data.fitCm
					? `Blacktip: +${num(data.fitCm.slope * 30, 1)} mm per month (R² ${num(data.fitCm.r2, 2)}).`
					: '',
				data.fitNa
					? `Sicklefin lemon: +${num(data.fitNa.slope * 30, 1)} mm per month (R² ${num(data.fitNa.r2, 2)}).`
					: ''
			].join(' ')}
		>
			<Scatter
				points={data.sizeScatter.map((p) => ({
					...p,
					g: p.g === 'Cm' ? SPECIES.Cm.common : SPECIES.Na.common
				}))}
				groups={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color }
				]}
				fits={[
					...(data.fitCm
						? [{ name: 'Blacktip trend', color: 'var(--ink)', points: data.fitCm.points }]
						: []),
					...(data.fitNa
						? [
								{
									name: 'Lemon trend',
									color: 'var(--ink-2)',
									points: data.fitNa.points,
									dashed: true
								}
							]
						: [])
				]}
				xFormat={dayLabel}
				xLabel="Date in season"
				yLabel="TL (mm)"
				r={2.5}
				opacity={0.45}
			/>
		</ChartCard>
		<ChartCard
			title="Birth window by season"
			subtitle="When open-scar pups were caught: 10th, 50th and 90th percentile dates (seasons with ≥ 5 open-scar pups)"
		>
			<LineChart
				series={[
					{
						name: 'Early (10%)',
						color: 'var(--series-3)',
						dots: true,
						points: withWindow.map((w, i) => ({ x: i, y: w.q10 }))
					},
					{
						name: 'Median',
						color: 'var(--series-1)',
						dots: true,
						points: withWindow.map((w, i) => ({ x: i, y: w.q50 }))
					},
					{
						name: 'Late (90%)',
						color: 'var(--series-7)',
						dots: true,
						points: withWindow.map((w, i) => ({ x: i, y: w.q90 }))
					}
				]}
				xFormat={(v) => season(withWindow[Math.round(v)]?.season ?? '')}
				yFormat={dayLabel}
			/>
		</ChartCard>
		<ChartCard
			title="Newborn size and sea temperature during pregnancy"
			subtitle="Mean TL of open-scar blacktips per season against mean SST from December to September before the season"
			note={data.gFit
				? `Slope ${num(data.gFit.slope, 1)} mm per °C, R² ${num(data.gFit.r2, 2)}, ${pValue(data.gFit.p)}, ${data.gFit.n} seasons. Few seasons: treat as a hypothesis, not a result.`
				: 'Not enough seasons yet.'}
		>
			<Scatter
				points={data.bySeason
					.filter((r) => r.n >= 10 && r.gSst != null && r.tl != null)
					.map((r) => ({ x: r.gSst!, y: r.tl!, label: `${season(r.season)} (n = ${r.n})` }))}
				xLabel="Gestation SST (°C)"
				yLabel="Newborn TL (mm)"
				xFormat={(v) => num(v, 1)}
				r={6}
				opacity={0.85}
			/>
		</ChartCard>
		<ChartCard
			title="Newborns and juveniles each season"
			subtitle="Age class at first capture (newborn = neonate or unhealed scar)"
		>
			<BarChart
				stacked
				categories={data.ageMix.map((r) => season(r.season))}
				series={[
					{ name: 'Newborn', color: 'var(--series-3)', values: data.ageMix.map((r) => r.neonate) },
					{
						name: 'Older juvenile',
						color: 'var(--series-1)',
						values: data.ageMix.map((r) => r.juvenile)
					},
					{ name: 'Not recorded', color: 'var(--axis)', values: data.ageMix.map((r) => r.unknown) }
				]}
			/>
		</ChartCard>
		<ChartCard
			title="Size by scar stage"
			subtitle="Mean TL at first capture: open → healing → healed"
		>
			<BarChart
				categories={data.usSize.map((u) => u.u)}
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.usSize.map((u) => u.cm)
					},
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, values: data.usSize.map((u) => u.na) }
				]}
				valueFormat={(v) => num(v)}
			/>
		</ChartCard>
	</section>
</div>
