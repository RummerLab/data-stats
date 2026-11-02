<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import FindingCard from '#lib/components/FindingCard.svelte';
	import MooreaMap from '#lib/components/MooreaMap.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { MONTH_NAMES, num, season } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const k = $derived(data.kpi);
	const seasons = $derived(data.perSeason.map((s) => season(s.season)));
</script>

<section class="hero">
	<div class="container">
		<p class="eyebrow light">Physioshark · Mo'orea, French Polynesia</p>
		<h1>Thirteen seasons of baby sharks, in numbers</h1>
		<p class="lede">
			Every newborn blacktip reef shark and sicklefin lemon shark caught, measured and released in
			Mo'orea's nurseries since 2013, joined with the weather, the ocean, the tides and the moon.
		</p>
		<div class="hero-num">
			<span class="big">{num(k.captures)}</span>
			<span class="unit">shark captures across {k.seasons} seasons</span>
		</div>
		<div class="hero-cta">
			<a class="btn btn-primary" href="/findings">See the findings</a>
			<a class="btn btn-ghost" href="/nurseries">Explore the nurseries</a>
		</div>
	</div>
</section>

<div class="container">
	<section class="section">
		<div class="grid-4">
			<StatTile
				label="Individual sharks"
				value={num(k.individuals)}
				sub={`${num(k.recaptured)} caught more than once`}
				href="/sharks"
			/>
			<StatTile
				label="Gillnet sets"
				value={num(k.sets)}
				sub={`${num(k.hours)} net-hours`}
				href="/effort"
			/>
			<StatTile
				label="Sharks per net-hour"
				value={num(k.cpue, 2)}
				sub="Average catch rate"
				href="/drivers"
			/>
			<StatTile
				label="Nurseries surveyed"
				value={num(k.nurseries)}
				sub={`${num(k.people)} crew members logged`}
				href="/nurseries"
			/>
		</div>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Captures per season"
			subtitle="Nursery gillnet captures by species, including recaptures"
			table={{
				columns: [
					{ key: 'season', label: 'Season' },
					{ key: 'Cm', label: 'Blacktip', num: true },
					{ key: 'Na', label: 'Sicklefin lemon', num: true },
					{ key: 'other', label: 'Other', num: true },
					{ key: 'sets', label: 'Sets', num: true }
				],
				rows: data.perSeason
			}}
		>
			<BarChart
				categories={seasons}
				stacked
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.perSeason.map((s) => s.Cm)
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						values: data.perSeason.map((s) => s.Na)
					},
					{
						name: 'Other species',
						color: 'var(--series-3)',
						values: data.perSeason.map((s) => s.other)
					}
				]}
				yLabel="Captures"
				hrefs={data.perSeason.map((s) => `/seasons/${s.season}`)}
			/>
		</ChartCard>
		<ChartCard
			title="Catch rate per season"
			subtitle="Sharks per net-hour of gillnetting (2013–14 logs have no set times)"
		>
			<LineChart
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						dots: true,
						points: data.perSeason.map((s, i) => ({ x: i, y: s.cpueCm }))
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						dots: true,
						points: data.perSeason.map((s, i) => ({ x: i, y: s.cpueNa }))
					}
				]}
				xFormat={(v) => seasons[Math.round(v)] ?? ''}
				yLabel="Sharks / net-hour"
				yZero
				yFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Where the sharks are"
			subtitle="Nurseries sized by total captures. Select one for its profile."
		>
			<MooreaMap points={data.map} valueLabel="Captures" format={(v) => num(v)} />
		</ChartCard>
		<ChartCard
			title="When pups are caught"
			subtitle="Captures by calendar month across all seasons: pupping runs October to February"
		>
			<BarChart
				categories={data.byMonth.map((m) => MONTH_NAMES[m.month - 1])}
				stacked
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.byMonth.map((m) => m.Cm)
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						values: data.byMonth.map((m) => m.Na)
					}
				]}
				yLabel="Captures"
			/>
		</ChartCard>
	</section>

	<section class="section">
		<h2>Species</h2>
		<div class="grid-3">
			{#each data.species as s (s.code)}
				<div class="card sp">
					<span class="swatch" style:background={SPECIES[s.code].color}></span>
					<div>
						<p class="name">{SPECIES[s.code].common}</p>
						<p class="latin">{SPECIES[s.code].latin}</p>
						<p class="nums">
							{num(s.n)} captures · {num(s.individuals)} individuals · {num(s.neonates)} newborns
						</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	{#if data.findings.length}
		<section class="section">
			<h2>A few findings</h2>
			<p>
				Computed live from the logs; they update when a new season is added. <a href="/findings"
					>All findings →</a
				>
			</p>
			<div class="grid-3">
				{#each data.findings as f (f.id)}<FindingCard finding={f} />{/each}
			</div>
		</section>
	{/if}
</div>

<style>
	.hero {
		background:
			radial-gradient(1200px 500px at 85% 0%, rgb(90 160 240 / 0.35), transparent 60%),
			linear-gradient(160deg, var(--navy) 0%, var(--navy-2) 55%, #0d3f7a 100%);
		color: var(--on-navy);
		padding: 64px 0 56px;
	}
	.hero h1 {
		color: #fff;
		font-size: clamp(2.1rem, 5vw, 3.6rem);
		font-weight: 750;
		max-width: 820px;
		margin: 0 0 16px;
		text-transform: uppercase;
		letter-spacing: 0.01em;
		line-height: 1.05;
	}
	.lede {
		max-width: 720px;
		color: var(--on-navy-2);
		font-size: 1.12rem;
		margin: 0 0 28px;
	}
	.light {
		color: #8cbcf5;
	}
	.hero-num {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 12px;
		margin-bottom: 24px;
	}
	.big {
		font-size: clamp(3rem, 8vw, 4.5rem);
		font-weight: 700;
		color: #fff;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	.unit {
		color: var(--on-navy-2);
		font-size: 1.05rem;
	}
	.hero-cta {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.hero .btn-ghost {
		color: #fff;
	}
	.sp {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.sp .swatch {
		margin-top: 6px;
		width: 12px;
		height: 12px;
	}
	.name {
		font-weight: 650;
		margin: 0;
	}
	.latin {
		font-style: italic;
		color: var(--ink-2);
		margin: 0;
		font-size: 0.9rem;
	}
	.nums {
		color: var(--muted);
		font-size: 0.85rem;
		margin: 4px 0 0;
	}
</style>
