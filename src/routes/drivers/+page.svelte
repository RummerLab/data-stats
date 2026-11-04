<script lang="ts">
	import ModelDiagnostics from '#lib/components/ModelDiagnostics.svelte';
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import ForestPlot from '#lib/components/charts/ForestPlot.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { num, pct, pValue, season, seasonDayLabel } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Effect = { est: number; lo: number; hi: number; p: number } | null;
	const fv = (e: Effect | undefined) => (e ? { est: e.est, lo: e.lo, hi: e.hi } : null);
	const clear = (e: Effect | undefined) => !!e && (e.hi < 1 || e.lo > 1);
	const effectText = (e: Effect | undefined) =>
		e ? `${num(e.est, 2)} (${num(e.lo, 2)}–${num(e.hi, 2)}), ${pValue(e.p)}` : '–';
	const md = $derived(data.model);
	const termLabels = $derived(
		md?.terms.map(
			(t) =>
				`${t.label} (+${num(t.sd, t.sd >= 10 ? 0 : t.sd >= 1 ? 1 : 2)}${t.unit === '%' ? '%' : t.unit ? ` ${t.unit}` : ''})`
		) ?? []
	);
	const siteOrder = $derived(
		md
			? md.sites
					.map((_, i) => i)
					.sort((a, b) => (md.cm?.sites[b]?.est ?? 0) - (md.cm?.sites[a]?.est ?? 0))
			: []
	);
	const lastSeason = $derived(md?.seasons[md.seasons.length - 1]);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>What drives catches?</h1>
		<p class="lede">
			Every timed gillnet set ({num(data.n)} of them) joined with the sea temperature, heat stress, ocean
			colour, moon, tide, weather, waves and El Niño state of that evening. Catch rate (sharks per net-hour)
			is compared with each variable using Spearman rank correlation, which copes with the many zero-catch
			nights ({pct(data.zero / Math.max(1, data.n))}).
		</p>
		<p class="callout small">
			These are single-variable associations: sites, seasons and variables overlap (warm years are
			also El Niño years, late sets are also darker), so a link here is a lead to test, not a cause.
			The model further down estimates them together.
		</p>
	</header>
	<ModelDiagnostics
		groups={md?.diagnostics ?? [
			{ name: 'All sharks', data: null },
			{ name: 'Blacktip reef sharks', data: null },
			{ name: 'Sicklefin lemon sharks', data: null }
		]}
	/>

	<section class="section grid-2">
		<ChartCard
			title="Correlation with catch rate"
			papers={['bouyoucos2024abiotic']}
			subtitle="Spearman ρ between each variable and sharks per net-hour; bars to the right mean more sharks when the variable is higher"
			table={{
				columns: [
					{ key: 'label', label: 'Variable' },
					{ key: 'rho', label: 'ρ (all)', num: true, dp: 3 },
					{ key: 'cm', label: 'ρ blacktip', num: true, dp: 3 },
					{ key: 'na', label: 'ρ lemon', num: true, dp: 3 },
					{ key: 'pL', label: 'p' },
					{ key: 'n', label: 'Sets', num: true }
				],
				rows: data.corr.map((c) => ({ ...c, pL: pValue(c.p) }))
			}}
			stats={data.stats.corr}
		>
			<BarChart
				horizontal
				categories={data.corr.map((c) => c.label)}
				series={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, values: data.corr.map((c) => c.cm) },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, values: data.corr.map((c) => c.na) }
				]}
				valueFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="How the variables relate to each other"
			subtitle="Spearman ρ between variables (blue negative, red positive)"
		>
			<Heatmap
				xLabels={data.matrixLabels}
				yLabels={data.matrixLabels}
				values={data.matrix}
				mode="div"
				format={(v) => num(v, 2)}
				domain={[-1, 1]}
			/>
		</ChartCard>
	</section>

	{#if md}
		{@const sst = md.sst}
		{@const strong = md.terms.filter((_, j) => clear(md.all.env[j]))}
		<section class="section" id="model">
			<h2>All together: a model of catches</h2>
			<p>
				A negative-binomial regression of the sharks caught in each set ({num(md.n)} sets with every variable;
				net-hours as the exposure), with a smooth curve for the day of the season, an effect for each
				nursery and each season, and the environment. Each effect is the change in catch rate with all
				the others held where they were. It can only adjust for what was measured, so it is still a guide,
				not proof of cause.
			</p>
			<div class="grid-2">
				<ChartCard
					title="Sea temperature, step by step"
					subtitle="Change in catch rate per +1 °C of sea-surface temperature as other factors join the model (rate ratio; 1 = no change; whiskers: 95% intervals)"
					note={sst[0].v && sst[1].v
						? `Alone, every extra °C goes with ${pct(Math.abs(sst[0].v.est - 1))} ${sst[0].v.est < 1 ? 'fewer' : 'more'} sharks per net-hour (${pValue(sst[0].v.p)}). With the day of the season in the model the rate ratio is ${num(sst[1].v.est, 2)} (${num(sst[1].v.lo, 2)}–${num(sst[1].v.hi, 2)})${clear(sst[1].v) ? '' : ', indistinguishable from no effect'}: the sea warms as the season goes on, so the raw link mostly reflects the calendar.`
						: ''}
				>
					<ForestPlot
						rows={sst.map((x) => x.label)}
						series={[
							{ name: 'All sharks', color: 'var(--series-1)', values: sst.map((x) => fv(x.v)) }
						]}
						xLabel="Rate ratio per +1 °C"
					/>
				</ChartCard>
				<ChartCard
					title="The environment, adjusted"
					papers={['bouyoucos2024abiotic']}
					subtitle="Change in catch rate for a typical (+1 SD) step in each variable, everything else held fixed"
					note={strong.length
						? `For all sharks together, the intervals clear 1 for ${strong.map((t) => t.label.toLowerCase()).join(', ')}. The rest are within the noise.`
						: 'For all sharks together, no environmental variable clears the noise once the calendar, nursery and season are in the model.'}
					table={{
						columns: [
							{ key: 'label', label: 'Variable (+1 SD)' },
							{ key: 'all', label: 'All sharks' },
							{ key: 'cm', label: 'Blacktip' },
							{ key: 'na', label: 'Lemon' }
						],
						rows: termLabels.map((label, j) => ({
							label,
							all: effectText(md.all.env[j]),
							cm: effectText(md.cm?.env[j]),
							na: effectText(md.na?.env[j])
						}))
					}}
				>
					<ForestPlot
						rows={termLabels}
						series={[
							{
								name: SPECIES.Cm.common,
								color: SPECIES.Cm.color,
								values: md.terms.map((_, j) => fv(md.cm?.env[j]))
							},
							{
								name: SPECIES.Na.common,
								color: SPECIES.Na.color,
								values: md.terms.map((_, j) => fv(md.na?.env[j]))
							}
						]}
						xLabel="Rate ratio (1 = no change)"
					/>
				</ChartCard>
				<ChartCard
					title="Through the season, adjusted"
					subtitle="Catch rate on each date relative to the season average, with nursery, season and conditions held fixed"
				>
					<LineChart
						series={[
							{
								name: SPECIES.Cm.common,
								color: SPECIES.Cm.color,
								points: md.cm?.day.map((p) => ({ x: p.x, y: p.est })) ?? []
							},
							{
								name: SPECIES.Na.common,
								color: SPECIES.Na.color,
								points: md.na?.day.map((p) => ({ x: p.x, y: p.est })) ?? []
							}
						]}
						refs={[{ y: 1, label: 'season average' }]}
						xFormat={(x) => seasonDayLabel(Math.round(x))}
						yFormat={(v) => `×${num(v, 1)}`}
						yLabel="Rate ratio"
					/>
				</ChartCard>
				<ChartCard
					title="Nurseries, adjusted"
					subtitle="Catch rate at each nursery relative to the average nursery, on the same dates and in the same conditions"
					note="Nurseries with at least 30 complete sets, ordered by the blacktip estimate. Lemons are modelled only where at least 10 were caught; elsewhere there is no lemon estimate."
					stats={data.stats.nurseries}
				>
					<ForestPlot
						rows={siteOrder.map((i) => md.sites[i].name)}
						series={[
							{
								name: SPECIES.Cm.common,
								color: SPECIES.Cm.color,
								values: siteOrder.map((i) => fv(md.cm?.sites[i]))
							},
							{
								name: SPECIES.Na.common,
								color: SPECIES.Na.color,
								values: siteOrder.map((i) => fv(md.na?.sites[i]))
							}
						]}
						xLabel="Rate ratio vs the average nursery"
					/>
				</ChartCard>
				<ChartCard
					title="Seasons, adjusted"
					subtitle="Catch rate in each season relative to the average season, after the calendar, nursery and conditions"
					note={lastSeason
						? `${season(lastSeason)} may still be under way; its estimate covers the dates netted so far.`
						: ''}
					stats={data.stats.seasons}
				>
					<ForestPlot
						rows={md.seasons.map((x) => season(x))}
						series={[
							{
								name: SPECIES.Cm.common,
								color: SPECIES.Cm.color,
								values: md.seasons.map((_, i) => fv(md.cm?.seasons[i]))
							},
							{
								name: SPECIES.Na.common,
								color: SPECIES.Na.color,
								values: md.seasons.map((_, i) => fv(md.na?.seasons[i]))
							}
						]}
						xLabel="Rate ratio vs the average season"
					/>
				</ChartCard>
				<div class="card small">
					<h3 class="h">About the model</h3>
					<ul>
						<li>
							Counts per set (blacktips, sicklefin lemons, and all sharks for the sea-temperature
							steps) with log(net-hours) as the offset, so effects are on catch rate.
						</li>
						<li>
							Negative binomial, because catches are clumped: the dispersion θ is {num(
								md.all.theta,
								2
							)} for all sharks, and the model beats a Poisson by {num(
								(md.aicPoisson ?? 0) - (md.aicNb ?? 0)
							)} AIC points.
						</li>
						<li>
							Day of the season: natural cubic spline with knots at {md.knots.join(', ')}. Nurseries
							and seasons are fixed effects coded against their average.
						</li>
						<li>
							{num(md.dropped)} timed sets are left out for a missing variable (mostly the tide) or because
							their nursery has fewer than 30 complete sets. The model explains {pct(
								md.all.devExplained
							)} of the deviance for all sharks.
						</li>
						<li>Each rate ratio has a Wald 95% interval, with no correction for the many terms.</li>
					</ul>
				</div>
			</div>
		</section>
	{/if}

	<section class="section">
		<h2>Catch rate across each variable's range</h2>
		<p>
			The strongest variables, split into five equal-sized groups of sets. Whiskers are 95%
			confidence intervals.
		</p>
		<div class="grid-2">
			{#each data.binned as b (b.key)}
				{#if b.bins.length}
					<ChartCard title={b.label} subtitle={b.unit ? `Bins in ${b.unit}` : undefined}>
						<BarChart
							categories={b.bins.map((x) => x.label)}
							series={[
								{
									name: 'Sharks / net-hour',
									color: 'var(--series-1)',
									values: b.bins.map((x) => x.mean)
								}
							]}
							errors={b.bins.map((x) => (x.lo != null && x.hi != null ? [x.lo, x.hi] : null))}
							valueFormat={(v) => num(v, 2)}
						/>
					</ChartCard>
				{/if}
			{/each}
		</div>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Day of the week"
			subtitle="Weekends bring more people to the beaches"
			stats={data.stats.weekday}
		>
			<BarChart
				categories={data.weekday.map((w) => w.name)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-1)',
						values: data.weekday.map((w) => w.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Crew size"
			subtitle="Do more hands (and more splashing) change the catch?"
			stats={data.stats.crew}
		>
			<BarChart
				categories={data.crewSize.map((c) => c.k)}
				series={[
					{
						name: 'Sharks / net-hour',
						color: 'var(--series-5)',
						values: data.crewSize.map((c) => c.cpue)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				labels
			/>
			<DataTable
				columns={[
					{ key: 'k', label: 'Crew' },
					{ key: 'n', label: 'Sets', num: true }
				]}
				rows={data.crewSize}
			/>
		</ChartCard>
	</section>
</div>

<style>
	.h {
		font-size: 1rem;
		margin: 0 0 8px;
	}
	ul {
		margin: 0;
		padding-left: 1.1em;
	}
	li + li {
		margin-top: 6px;
	}
</style>
