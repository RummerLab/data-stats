<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { num, pct, pValue, season } from '#lib/format';
	import { SPECIES, speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const seasons = $derived(data.kSeasons.map(season));
	const sexFit = (sp: 'Cm' | 'Na') => data.sexModel.find((m) => m.species === sp)?.fit ?? null;
	/** Mixed-model season test for a per-season chart (#117). */
	const seasonNote = (sp: 'Cm' | 'Na') => {
		const f = sexFit(sp);
		return f
			? `Mixed model (nursery and season as random effects): seasons vary by SD ${num(f.seasonSd, 2)} on the log-odds scale, likelihood-ratio ${pValue(f.seasonP)}${f.seasonP != null && f.seasonP >= 0.05 ? ': no more than chance' : ''}.`
			: undefined;
	};
	// Nurseries with at least 20 sharks; smaller ones sit at the typical share by design.
	const nurseryRows = (sp: 'Cm' | 'Na') => (sexFit(sp)?.nurseries ?? []).filter((r) => r.n >= 20);
	const lwPoints = $derived([
		...data.lwCm.points.map(([x, y]) => ({ x, y, g: SPECIES.Cm.common })),
		...data.lwNa.points.map(([x, y]) => ({ x, y, g: SPECIES.Na.common }))
	]);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Body size &amp; condition</h1>
		<p class="lede">
			How big are Mo'orea's pups, how heavy for their length, and does that change between nurseries
			and years? Sizes use each shark's first capture of the season so recaptures are not counted
			twice. Lengths are millimetres; sheets recorded in centimetres were converted.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Length-frequency"
			subtitle={`Total length at first capture. Median: blacktip ${num(data.medianTl.Cm)} mm, sicklefin lemon ${num(data.medianTl.Na)} mm.`}
		>
			<Histogram
				edges={data.edges}
				series={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color, counts: data.lfCm },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color, counts: data.lfNa }
				]}
				xLabel="Total length (mm)"
			/>
		</ChartCard>
		<ChartCard
			title="Length–mass relationship"
			papers={['weideli2019condition']}
			subtitle="Log–log axes; lines are fitted power curves W = a·L^b"
			note={[
				data.lwCm.fit
					? `Blacktip: b = ${num(data.lwCm.fit.b, 2)}, R² = ${num(data.lwCm.fit.r2, 2)}, n = ${num(data.lwCm.fit.n)}.`
					: '',
				data.lwNa.fit
					? `Sicklefin lemon: b = ${num(data.lwNa.fit.b, 2)}, R² = ${num(data.lwNa.fit.r2, 2)}, n = ${num(data.lwNa.fit.n)}.`
					: '',
				'b ≈ 3 means mass grows with the cube of length (isometric growth).'
			].join(' ')}
		>
			<Scatter
				points={lwPoints}
				groups={[
					{ name: SPECIES.Cm.common, color: SPECIES.Cm.color },
					{ name: SPECIES.Na.common, color: SPECIES.Na.color }
				]}
				fits={[
					...(data.lwCm.fit
						? [{ name: 'Blacktip fit', color: 'var(--ink)', points: data.lwCm.fit.curve }]
						: []),
					...(data.lwNa.fit
						? [
								{
									name: 'Lemon fit',
									color: 'var(--ink-2)',
									points: data.lwNa.fit.curve,
									dashed: true
								}
							]
						: [])
				]}
				xLog
				yLog
				xLabel="Total length (mm)"
				yLabel="Mass (kg)"
				yFormat={(v) => num(v, v < 1 ? 1 : 0)}
				r={2.5}
				opacity={0.45}
			/>
		</ChartCard>
		<ChartCard
			title="Newborn blacktip condition by nursery"
			papers={['weideli2019condition']}
			subtitle="Fulton's K = 100·mass(g)/TL(cm)³ for newborns (open or healing umbilical scar)"
		>
			<BoxPlot
				boxes={data.kBySite.map((b) => ({ ...b, color: SPECIES.Cm.color }))}
				yLabel="Fulton's K"
				yFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard
			title="Newborn condition by season"
			papers={['weideli2019condition', 'debaere2023umbilicus']}
			subtitle="Mean Fulton's K of newborns"
		>
			<LineChart
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						dots: true,
						points: data.kCm.map((y, i) => ({ x: i, y }))
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						dots: true,
						points: data.kNa.map((y, i) => ({ x: i, y }))
					}
				]}
				xFormat={(v) => seasons[Math.round(v)] ?? ''}
				yFormat={(v) => num(v, 2)}
			/>
		</ChartCard>
		<ChartCard title="Blacktip size by season" subtitle="Total length at first capture">
			<BoxPlot
				boxes={data.tlCm.map((b) => ({ ...b, color: SPECIES.Cm.color }))}
				yLabel="TL (mm)"
				yFormat={(v) => num(v)}
			/>
		</ChartCard>
		<ChartCard
			title="Measurement conversions"
			subtitle="Linear regressions for converting between length measures (first captures)"
		>
			<DataTable
				columns={[
					{ key: 'sp', label: 'Species' },
					{ key: 'label', label: 'Model' },
					{ key: 'intercept', label: 'a', num: true, dp: 1 },
					{ key: 'slope', label: 'b', num: true, dp: 4 },
					{ key: 'r2', label: 'R²', num: true, dp: 3 },
					{ key: 'n', label: 'n', num: true }
				]}
				rows={data.conversions.map((c) => ({ ...c!, sp: speciesName(c!.species) }))}
			/>
		</ChartCard>
	</section>

	<section class="section" id="sex">
		<h2>Sex ratios and differences</h2>
		<p>
			{#each data.overallSex as s (s.species)}
				{speciesName(s.species)}: {num(s.f)} females, {num(s.m)} males ({pct(
					s.f / Math.max(1, s.f + s.m)
				)} female, binomial {`${pValue(s.p)}). `}
			{/each}
		</p>
		<p>
			A logistic mixed model asks whether the ratio shifts between nurseries or between seasons. It
			counts each shark once, at its first capture, with the nursery and season of that capture as
			random effects.
			{#each data.sexModel as m (m.species)}
				{#if m.fit}
					{speciesName(m.species)}: {pct(m.fit.typical.est)} female at a typical nursery in a typical
					season (95% interval {pct(m.fit.typical.lo)}–{pct(m.fit.typical.hi)}); nurseries
					{m.fit.nurseryP != null && m.fit.nurseryP < 0.05
						? `differ (SD ${num(m.fit.nurserySd, 2)} on the log-odds scale, ${pValue(m.fit.nurseryP)})`
						: `do not differ beyond chance (${pValue(m.fit.nurseryP)})`}, and seasons
					{m.fit.seasonP != null && m.fit.seasonP < 0.05
						? `differ (SD ${num(m.fit.seasonSd, 2)}, ${pValue(m.fit.seasonP)}). `
						: `do not (${pValue(m.fit.seasonP)}). `}
				{/if}
			{/each}
		</p>
		<div class="grid-2">
			{#each ['Cm', 'Na'] as const as sp (sp)}
				{#if nurseryRows(sp).length}
					<ChartCard
						title={`Share of females by nursery: ${speciesName(sp).toLowerCase()}`}
						subtitle="Mixed-model estimate for each nursery with ≥ 20 sharks (first captures, n in brackets). Whiskers: approximate 95% intervals. Estimates are pulled towards the typical share when the data are thin."
					>
						<BarChart
							horizontal
							categories={nurseryRows(sp).map((r) => `${r.name} (${r.n})`)}
							series={[
								{
									name: 'Female share',
									color: SPECIES[sp].color,
									values: nurseryRows(sp).map((r) => r.est)
								}
							]}
							errors={nurseryRows(sp).map((r) => [r.lo, r.hi])}
							valueFormat={(v) => pct(v)}
						/>
					</ChartCard>
				{/if}
			{/each}
		</div>
		<div class="grid-2">
			<ChartCard
				title="Share of females per season: blacktip"
				subtitle="Bars show the share, whiskers the 95% Wilson interval; 50% is an even ratio"
				note={seasonNote('Cm')}
			>
				<BarChart
					categories={data.sexCm.map((r) => season(r.season))}
					series={[
						{ name: 'Female share', color: SPECIES.Cm.color, values: data.sexCm.map((r) => r.p) }
					]}
					errors={data.sexCm.map((r) => (r.lo != null && r.hi != null ? [r.lo, r.hi] : null))}
					valueFormat={(v) => pct(v)}
				/>
			</ChartCard>
			<ChartCard title="Share of females per season: sicklefin lemon" note={seasonNote('Na')}>
				<BarChart
					categories={data.sexNa.map((r) => season(r.season))}
					series={[
						{ name: 'Female share', color: SPECIES.Na.color, values: data.sexNa.map((r) => r.p) }
					]}
					errors={data.sexNa.map((r) => (r.lo != null && r.hi != null ? [r.lo, r.hi] : null))}
					valueFormat={(v) => pct(v)}
				/>
			</ChartCard>
			<ChartCard
				title="Are females bigger?"
				subtitle="Total length at first capture by sex"
				note={data.dimorph
					.map(
						(x) =>
							`${speciesName(x.species)}: females ${x.diff != null && x.diff >= 0 ? '+' : ''}${num(x.diff, 1)} mm vs males (Welch ${pValue(x.p)}).`
					)
					.join(' ')}
			>
				<BoxPlot
					boxes={data.dimorph.flatMap((x) => [
						{
							name: `${x.species} female`,
							color: x.species === 'Cm' ? SPECIES.Cm.color : SPECIES.Na.color,
							stats: x.F
						},
						{
							name: `${x.species} male`,
							color: x.species === 'Cm' ? SPECIES.Cm.color : SPECIES.Na.color,
							stats: x.M
						}
					])}
					yLabel="TL (mm)"
					yFormat={(v) => num(v)}
				/>
			</ChartCard>
			<ChartCard
				title="Clasper development"
				subtitle="Inner clasper length against total length in males: claspers lengthen as males approach maturity"
			>
				<Scatter
					points={data.claspers}
					groups={[
						{ name: 'Cm', color: SPECIES.Cm.color },
						{ name: 'Na', color: SPECIES.Na.color }
					]}
					xLabel="Total length (mm)"
					yLabel="Clasper length (mm)"
					r={3}
				/>
			</ChartCard>
		</div>
	</section>
</div>
