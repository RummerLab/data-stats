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
	const busyText = $derived.by(() => {
		const { busyMean, quietMean, p } = data.busyDays;
		const test = p != null ? ` (Welch's t-test p = ${num(p, 3)})` : '';
		const verdict =
			p != null && p < 0.05
				? "The difference is unlikely to be chance alone, but the sets aren't randomised: crews, sites and moon phases differ between these days too."
				: 'That is within what chance alone would produce.';
		return `Busy days average ${num(busyMean, 2)} sharks per net-hour against ${num(quietMean, 2)} on ordinary weekdays${test}. ${verdict}`;
	});
	const schoolText = $derived.by(() => {
		const s = data.busyDays.school;
		if (s.p == null) return '';
		const verdict =
			s.p < 0.05
				? `${s.breakMean! > s.termMean! ? 'higher' : 'lower'} than chance alone would explain`
				: 'a difference chance alone would produce';
		return `On weekdays in the school holidays (${s.nBreak} sets), catches average ${num(s.breakMean, 2)} sharks per net-hour against ${num(s.termMean, 2)} on term-time weekdays (${s.nTerm} sets; p = ${num(s.p, 3)}): ${verdict}.`;
	});
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Environment</p>
		<h1>Human pressure</h1>
		<p class="lede">
			Ten nurseries were scored for three human pressures by Bouyoucos et al. (2024, <i
				>Marine and Freshwater Research</i
			>
			75, MF24080): relative fin-fish fishing effort (a proxy for bycatch, not shark fishing, banned since
			2012), direct human impact (people moving around homes and tourism sites) and coastal artificialisation
			(walls and embankments). The scores are the paper's own, from its
			<a href="https://doi.org/10.25903/2SFB-QX79">dataset</a> at James Cook University (CC BY-NC 4.0).
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
			papers={['bouyoucos2024abiotic']}
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
			papers={['bouyoucos2024abiotic']}
			subtitle="Spearman ρ across nurseries (n ≤ 10): blue negative, red positive"
			stats={data.stats.corr}
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
		<ChartCard
			title="Fishing effort vs catch rate"
			papers={['bouyoucos2024abiotic']}
			stats={data.stats.fishing}
		>
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
		<ChartCard
			title="Coastal artificialisation vs newborn condition"
			papers={['bouyoucos2024abiotic']}
			stats={data.stats.artif}
		>
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
		<ChartCard title="Direct human impact vs growth" stats={data.stats.human}>
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
		<ChartCard
			title="Composite pressure vs blacktip catch rate"
			papers={['bouyoucos2024abiotic']}
			stats={data.stats.composite}
		>
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

	<section class="section">
		<h2>Busy days</h2>
		<p>
			A rough proxy for people on the water: weekends, French Polynesia's public holidays, the
			Christmas–New Year period (20 Dec – 5 Jan) and the Polynesian school holidays{data.busyDays
				.school.since
				? ` (official calendars since ${data.busyDays.school.since})`
				: ''}. Each date gets one label: a public holiday beats the Christmas–New Year period, which
			beats the school holidays, which beat the weekend. {busyText}
			{schoolText}
		</p>
		<div class="grid-2">
			<ChartCard
				title="Catch rate by type of day"
				subtitle="Mean sharks per net-hour per set, sets in brackets. Whiskers: 95% confidence intervals"
				stats={data.stats.dayType}
			>
				<BarChart
					categories={data.busyDays.byType.map((t) => `${t.label} (${t.n})`)}
					series={[
						{
							name: 'Sharks / net-hour',
							color: 'var(--series-1)',
							values: data.busyDays.byType.map((t) => t.mean)
						}
					]}
					errors={data.busyDays.byType.map((t) =>
						t.lo != null && t.hi != null ? [t.lo, t.hi] : null
					)}
					valueFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
			<ChartCard
				title="Catch rate by day of the week"
				subtitle="Mean sharks per net-hour per set, sets in brackets. Whiskers: 95% confidence intervals"
				stats={data.stats.weekday}
			>
				<BarChart
					categories={data.busyDays.byWeekday.map((t) => `${t.label} (${t.n})`)}
					series={[
						{
							name: 'Sharks / net-hour',
							color: 'var(--series-1)',
							values: data.busyDays.byWeekday.map((t) => t.mean)
						}
					]}
					errors={data.busyDays.byWeekday.map((t) =>
						t.lo != null && t.hi != null ? [t.lo, t.hi] : null
					)}
					valueFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
		</div>
		{#if data.busyDays.holidays.length}
			<p class="small">
				Sets on public holidays: {data.busyDays.holidays
					.map((h) => `${h.name} (${h.n})`)
					.join(', ')}.
			</p>
		{/if}
		{#if data.busyDays.breaks.length}
			<p class="small">
				Sets in the school holidays: {data.busyDays.breaks
					.map((h) => `${h.name} (${h.n})`)
					.join(', ')}. School calendars: the Polynesian government's archived orders for 2013-14 to
				2016-17 (collèges and lycées), then the French Ministry of Education's open data (Licence
				Ouverte 2.0).
			</p>
		{/if}
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
