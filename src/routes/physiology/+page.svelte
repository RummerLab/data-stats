<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import BoxPlot from '#lib/components/charts/BoxPlot.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { date, num, pct, pValue, season } from '#lib/format';
	import { SERIES, speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const dayLabel = (day: number) => {
		const d = new Date(Date.UTC(2001, 7, 1) + day * 86_400_000);
		return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
	};
	const dt = $derived(data.diet);
	type Share = {
		label: string;
		n: number;
		rate: number | null;
		lo: number | null;
		hi: number | null;
	};
	const shareBars = (rows: Share[]) => ({
		categories: rows.map((r) => `${r.label} (${r.n})`),
		series: [
			{ name: 'Food in stomach', color: 'var(--series-3)', values: rows.map((r) => r.rate) }
		],
		errors: rows.map((r) =>
			r.lo != null && r.hi != null ? ([r.lo, r.hi] as [number, number]) : null
		)
	});
	const testNote = (t: { stat: number; df: number; p: number } | null) =>
		t ? `χ² = ${num(t.stat, 1)}, df = ${t.df}, ${pValue(t.p)}` : '';
	const maxMass = $derived(Math.max(1.5, ...data.massPairs.flatMap((p) => [p.x, p.y])));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Physiology &amp; lab</h1>
		<p class="lede">
			Physioshark is a conservation-physiology project: alongside field surveys, pups are
			blood-sampled and some are kept for a few weeks at CRIOBE for experiments on temperature,
			oxygen and energy use before release. These charts summarise what the logs record about that
			work.
		</p>
	</header>

	<section class="section">
		<h2>Blood chemistry (2020–21)</h2>
		<p>
			{num(data.nBlood)} blood samples analysed for haematocrit, haemoglobin, cholesterol, free fatty
			acids and triglycerides.
		</p>
		<div class="grid-2">
			<ChartCard
				title="Haematocrit by nursery"
				papers={['schwieterman2019blood']}
				subtitle="% packed red cells: oxygen-carrying capacity"
			>
				<BoxPlot
					boxes={data.hct.map((b) => ({ ...b, color: 'var(--series-8)' }))}
					yLabel="Haematocrit (%)"
				/>
			</ChartCard>
			<ChartCard title="Triglycerides by nursery" subtitle="An energy-reserve marker">
				<BoxPlot
					boxes={data.tg.map((b) => ({ ...b, color: 'var(--series-4)' }))}
					yLabel="Triglycerides"
					yFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
			<ChartCard title="Cholesterol by nursery">
				<BoxPlot
					boxes={data.chol.map((b) => ({ ...b, color: 'var(--series-7)' }))}
					yLabel="Cholesterol"
					yFormat={(v) => num(v, 2)}
				/>
			</ChartCard>
			<ChartCard
				title="Haematocrit and body condition"
				subtitle="Field samples matched to their capture record (season, species, shark number)"
				note={data.hctFit
					? `R² ${num(data.hctFit.r2, 2)}, ${pValue(data.hctFit.p)}, n = ${data.hctFit.n}.`
					: 'Too few matched samples.'}
			>
				<Scatter
					points={data.hctK}
					xLabel="Fulton's K"
					yLabel="Haematocrit (%)"
					xFormat={(v) => num(v, 2)}
					r={4}
				/>
			</ChartCard>
		</div>
	</section>

	<section class="section">
		<h2>Sharks in the lab</h2>
		<p>
			{num(data.nLab)} lab records across seasons; average stay {num(data.medianDays, 1)} days.{data.died
				? ` ${data.died} logged as died in captivity.`
				: ''}
		</p>
		<div class="grid-2">
			<ChartCard title="Days in captivity" papers={['bouyoucos2018deadtired']}>
				<Histogram
					edges={data.daysEdges}
					series={[{ name: 'Sharks', color: 'var(--series-1)', counts: data.daysHist }]}
					xLabel="Days"
				/>
			</ChartCard>
			<ChartCard
				title="Mass on arrival and release"
				subtitle="Above the dashed line = heavier at release"
			>
				<Scatter
					points={data.massPairs}
					fits={[
						{
							name: 'No change',
							color: 'var(--ink-2)',
							dashed: true,
							points: [
								{ x: 0.5, y: 0.5 },
								{ x: maxMass, y: maxMass }
							]
						}
					]}
					xLabel="Arrival mass (kg)"
					yLabel="Release mass (kg)"
					xFormat={(v) => num(v, 1)}
					yFormat={(v) => num(v, 1)}
					r={4}
				/>
			</ChartCard>
			<ChartCard
				title="Appetite after arrival (2020–21)"
				subtitle="Mean % of offered food eaten, by days since a shark's first logged feed"
			>
				<LineChart
					series={[
						{
							name: '% eaten',
							color: 'var(--series-3)',
							dots: true,
							points: data.feeding.map((f) => ({ x: f.x, y: f.y }))
						}
					]}
					xLabel="Days since first feed"
					yFormat={(v) => `${num(v)}%`}
					yDomain={[0, 100]}
				/>
			</ChartCard>
			<ChartCard
				title="Tank temperature"
				papers={['bouyoucos2020thermal']}
				subtitle="Daily mean across tanks, by season"
			>
				<LineChart
					series={data.wqSeries.map((s, i) => ({
						name: season(s.season),
						color: SERIES[i % 8],
						points: s.points
					}))}
					xFormat={dayLabel}
					yFormat={(v) => `${num(v, 1)}°`}
				/>
			</ChartCard>
		</div>
	</section>

	<section class="section">
		<h2>Diet</h2>
		{#if dt}
			<p>
				Gastric lavage gently flushes a pup's stomach so its last meals can be seen. The logs record
				{num(dt.n)} lavaged pups ({dt.seasons.map((x) => season(x)).join(' and ')}); {pct(
					dt.cmFed.rate
				)}
				of {num(dt.nCm)} blacktips had food in the stomach. A lavage only shows the last few hours of
				feeding, so an empty stomach is common.
			</p>
		{/if}
		<div class="grid-2">
			{#if dt}
				<ChartCard
					title="What the lavage found"
					papers={['debaere2024lunar']}
					subtitle="Share of lavaged pups by stomach state (2016–17 recorded full or empty only)"
				>
					<BarChart
						horizontal
						stacked
						categories={dt.bySeason.map(
							(r) => `${season(r.season)} ${speciesName(r.species).toLowerCase()} (${r.n})`
						)}
						series={[
							{ name: 'Full', color: 'var(--seq-6)', values: dt.bySeason.map((r) => r.full / r.n) },
							{
								name: 'Traces of food',
								color: 'var(--seq-4)',
								values: dt.bySeason.map((r) => r.traces / r.n)
							},
							{
								name: 'Empty',
								color: 'var(--seq-2)',
								values: dt.bySeason.map((r) => r.empty / r.n)
							}
						]}
						valueFormat={(v) => pct(v)}
					/>
				</ChartCard>
				<ChartCard
					title="Does the moon change foraging success?"
					papers={['debaere2024lunar']}
					subtitle="Blacktips with food in the stomach, by moon phase on the night of capture. Whiskers: 95% intervals."
					note={dt.moonTest
						? `${testNote(dt.moonTest)}. ${dt.moonTest.p >= 0.05 ? 'No difference between phases, in line with the published analysis of these lavages.' : 'The phases differ more than chance would suggest.'}`
						: ''}
				>
					<BarChart horizontal {...shareBars(dt.moon)} valueFormat={(v) => pct(v)} labels />
				</ChartCard>
				<ChartCard
					title="Do newborns eat?"
					subtitle="Blacktips with food in the stomach, by umbilical scar. Newborns still live partly on the liver reserves from their mother."
					note={dt.scarTest
						? `${testNote(dt.scarTest)}. ${dt.scarTest.p >= 0.05 ? 'The groups overlap: with these numbers the difference could be chance.' : 'The share differs between scar stages.'}`
						: ''}
				>
					<BarChart horizontal {...shareBars(dt.scar)} valueFormat={(v) => pct(v)} labels />
				</ChartCard>
				<ChartCard
					title="Fed before or after dark?"
					subtitle="Blacktips with food in the stomach, by capture time relative to sunset"
					note={dt.sunsetTest
						? `${testNote(dt.sunsetTest)}. ${dt.sunsetTest.p >= 0.05 ? 'No clear change through the evening.' : 'The share changes through the evening.'}`
						: ''}
				>
					<BarChart horizontal {...shareBars(dt.sunset)} valueFormat={(v) => pct(v)} labels />
				</ChartCard>
				{#if dt.condition.length === 2}
					<ChartCard
						title="Body condition, fed or empty"
						subtitle="Fulton's condition factor K of lavaged blacktips"
						note={dt.conditionP != null
							? `Welch t-test ${pValue(dt.conditionP)}: ${dt.conditionP >= 0.05 ? 'pups with food in the stomach are no plumper than those without' : 'the two groups differ'}.`
							: ''}
					>
						<BoxPlot boxes={dt.condition} yLabel="K" yFormat={(v) => num(v, 2)} />
					</ChartCard>
				{/if}
				{#if dt.prey.length}
					<ChartCard
						title="What was in the stomachs"
						subtitle={`Lavage samples whose notes name each kind of food (${num(dt.withContents)} samples with notes; one sample can name several)`}
					>
						<BarChart
							horizontal
							categories={dt.prey.map((p) => p.label)}
							series={[
								{ name: 'Samples', color: 'var(--series-6)', values: dt.prey.map((p) => p.n) }
							]}
							labels
						/>
					</ChartCard>
				{/if}
			{/if}
			{#if data.preyTop.length}
				<ChartCard
					title="Prey species logged (2013–14)"
					papers={['debaere2024lunar']}
					subtitle="Fish found in nets or recovered by gastric lavage"
				>
					<BarChart
						horizontal
						categories={data.preyTop.map((p) => p.k)}
						series={[
							{ name: 'Records', color: 'var(--series-6)', values: data.preyTop.map((p) => p.n) }
						]}
						labels
					/>
				</ChartCard>
			{/if}
			<div class="card">
				<h3>Prey records</h3>
				<DataTable
					columns={[
						{ key: 'dateL', label: 'Date' },
						{ key: 'location', label: 'Where' },
						{ key: 'name', label: 'Prey' },
						{ key: 'size', label: 'Size' },
						{ key: 'notes', label: 'Notes' }
					]}
					rows={data.prey.map((p) => ({ ...p, dateL: date(p.date) }))}
				/>
			</div>
		</div>
	</section>

	{#if data.mouth.length}
		<section class="section card">
			<h3>Mouth gape (2019–20)</h3>
			<DataTable
				columns={[
					{ key: 'shark', label: 'Shark' },
					{ key: 'site', label: 'Nursery' },
					{ key: 'sex', label: 'Sex' },
					{ key: 'mol', label: 'Mouth length', num: true },
					{ key: 'mow', label: 'Mouth width', num: true }
				]}
				rows={data.mouth}
			/>
		</section>
	{/if}
</div>

<style>
	h3 {
		font-size: 1rem;
		margin: 0 0 8px;
	}
</style>
