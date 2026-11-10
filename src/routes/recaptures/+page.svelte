<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InteractiveMap from '#lib/components/InteractiveMap.svelte';
	import StatTile from '#lib/components/StatTile.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import Histogram from '#lib/components/charts/Histogram.svelte';
	import Scatter from '#lib/components/charts/Scatter.svelte';
	import { date, num, pct, pValue, season } from '#lib/format';
	import { SPECIES, speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type Est = { est: number; lo: number | null; hi: number | null };
	const ci = (e: Est) =>
		e.lo != null && e.hi != null ? ` (95% interval ${pct(e.lo)}–${pct(e.hi)})` : '';
	const chi = (t: { lr: number; df: number; p: number }) =>
		`likelihood-ratio χ²(${t.df}) = ${num(t.lr, 1)}, ${pValue(t.p)}`;
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Biology</p>
		<h1>Recaptures &amp; site fidelity</h1>
		<p class="lede">
			Each tagged pup that turns up again says something about where it lives and how long it stays. {pct(
				data.fidelity
			)} of recaptures happened at the same nursery as the capture before.
		</p>
	</header>

	<div class="grid-4">
		<StatTile
			label="Recapture events"
			value={num(data.pairs)}
			sub={`median ${num(data.medianDays)} days apart`}
		/>
		<StatTile label="Recaptured at the same nursery" value={pct(data.fidelity)} />
		<StatTile label="Seen in more than one season" value={num(data.multiSeason)} />
		<StatTile
			label="Recapture rate"
			value={pct(data.bySpecies.find((s) => s.key === 'Cm')?.rate)}
			sub={`blacktips · lemons ${pct(data.bySpecies.find((s) => s.key === 'Na')?.rate)}`}
		/>
	</div>

	<section class="section grid-2">
		<ChartCard
			title="Recapture rate by season"
			subtitle="Share of individuals caught more than once"
			stats={data.stats.season}
		>
			<BarChart
				categories={data.bySeason.map((r) => season(r.key))}
				series={[
					{ name: 'Recaptured', color: 'var(--series-3)', values: data.bySeason.map((r) => r.rate) }
				]}
				valueFormat={(v) => pct(v)}
			/>
		</ChartCard>
		<ChartCard title="Recapture rate by nursery" stats={data.stats.site}>
			<BarChart
				horizontal
				categories={data.bySite.map((r) => r.name)}
				series={[
					{ name: 'Recaptured', color: 'var(--series-3)', values: data.bySite.map((r) => r.rate) }
				]}
				valueFormat={(v) => pct(v)}
				labels
			/>
		</ChartCard>
		<ChartCard
			title="Days between captures"
			papers={['bouyoucos2020homerange']}
			subtitle="Consecutive captures of the same shark, weekly bins (first 20 weeks)"
		>
			<Histogram
				edges={data.edges}
				series={[{ name: 'Recaptures', color: 'var(--series-1)', counts: data.daysHist }]}
				xLabel="Days"
			/>
		</ChartCard>
		<ChartCard
			title="How many times is a shark caught?"
			papers={['lionnet2025photoid']}
			subtitle="Individuals by number of captures (6 = six or more)"
		>
			<BarChart
				categories={data.capCounts.map((c) => (c.k === 6 ? '6+' : String(c.k)))}
				series={[
					{ name: 'Sharks', color: 'var(--series-1)', values: data.capCounts.map((c) => c.n) }
				]}
				labels
			/>
		</ChartCard>
	</section>

	<section class="section">
		<ChartCard
			title="Moves between nurseries on the map"
			papers={['bouyoucos2020homerange']}
			subtitle="Lines join the nurseries where a shark was caught one time and the next, both directions pooled; thicker is more moves. Circles: recaptures at the same nursery."
			note={`Lines join capture sites; they are not the route a shark swam. A shark can pass other nurseries, or move and come back, between two captures.${data.conflictsLeftOut ? ` ${num(data.conflictsLeftOut)} moves by sharks with conflicting records are left out.` : ''}`}
		>
			<InteractiveMap
				label="Map of recaptured sharks' moves between nurseries"
				valueLabel="Same-nursery recaptures"
				lineLabel="Moves"
				height={480}
				layers={[
					{
						name: 'Same-nursery recaptures',
						color: 'var(--series-3)',
						sized: true,
						points: data.stayed
					}
				]}
				lineLayers={data.moveLines.map((m) => ({
					name: `${speciesName(m.species)} moves`,
					color: SPECIES[m.species].color,
					lines: m.lines
				}))}
			/>
		</ChartCard>
	</section>

	<section class="section">
		<ChartCard
			title="Where recaptured sharks move"
			papers={['bouyoucos2020homerange']}
			subtitle="Rows: nursery of the earlier capture. Columns: nursery of the next. The diagonal is site fidelity."
		>
			<Heatmap
				xLabels={data.nurseryNames}
				yLabels={data.nurseryNames}
				values={data.matrix}
				cellLabels
				format={(v) => (v ? num(v) : '')}
			/>
		</ChartCard>
	</section>

	{#if data.stay.length}
		<section class="section" id="survival">
			<h2>How long do pups stay?</h2>
			<p>
				A Cormack–Jolly–Seber model follows each tagged pup from its first capture at a nursery
				through the rest of that season, in {data.occasionDays}-day steps, and separates two things
				a simple recapture rate mixes up: how likely a pup is to still be there, and how likely the
				net is to catch it when it is. The second rises with that fortnight's net-hours; a single
				typical set catches {data.stay
					.map((r) => `${pct(r.pTypicalSet)} of the ${speciesName(r.species).toLowerCase()} pups`)
					.join(' and ')} present. Because each pup enters at its own first capture, pups born later in
				the season don't bias the answer.
			</p>
			<p>
				{#each data.stay as r (r.species)}
					{speciesName(r.species)}: {pct(r.month.est)} of pups are still at their nursery 30 days later{ci(
						r.month
					)}, an average stay of about {num(r.residenceDays)} days ({num(r.histories)}
					pups, {`${num(r.recaptured)} seen again later in the season). `}
				{/each}
			</p>
			<p class="muted small">
				"Still there" means alive and not moved away: the model can't tell a pup that died from one
				that left, and a pup that moved to another nursery counts as gone (the movement chart above
				shows how often recaptures cross nurseries). Nurseries need at least ten pups seen again
				within a season to get their own estimate.
			</p>
			<div class="grid-2">
				{#each data.stay as r (r.species)}
					<ChartCard
						title={`Still at the nursery a month later: ${speciesName(r.species).toLowerCase()}`}
						subtitle="Share of pups at a nursery still there 30 days later (pups tagged there in brackets). Whiskers: 95% intervals."
						stats={[
							r.nurseryTest
								? `${r.nurseryTest.p < 0.05 ? 'Nurseries differ' : 'No detectable difference between nurseries'} (one rate per nursery vs one shared, ${chi(r.nurseryTest)}).`
								: null,
							r.transience
								? `${r.transience.p < 0.05 ? 'Newly tagged pups leave faster' : 'No sign that newly tagged pups leave faster'}: ${pct(r.transience.first.est)} stay their first fortnight, ${pct(r.transience.later.est)} each later one (${chi(r.transience)}).`
								: null
						]}
						note={r.transience && r.transience.p < 0.05
							? 'Some pups caught once are passing through, or move off after being handled; those that stay, stay longer.'
							: undefined}
					>
						<BarChart
							horizontal
							categories={r.nurseries.map((n) => `${n.name} (${n.histories})`)}
							series={[
								{
									name: 'Still there after 30 days',
									color: SPECIES[r.species].color,
									values: r.nurseries.map((n) => n.month.est)
								}
							]}
							errors={r.nurseries.map((n) =>
								n.month.lo != null && n.month.hi != null ? [n.month.lo, n.month.hi] : null
							)}
							valueFormat={(v) => pct(v)}
						/>
					</ChartCard>
				{/each}
			</div>
		</section>
	{/if}

	<section class="section grid-2">
		<div class="card">
			<h2 class="h">Longest moves between nurseries</h2>
			<DataTable
				columns={[
					{ key: 'id', label: 'Shark', href: 'href' },
					{ key: 'sp', label: 'Species' },
					{ key: 'from', label: 'From' },
					{ key: 'to', label: 'To' },
					{ key: 'km', label: 'km', num: true, dp: 1 },
					{ key: 'days', label: 'Days', num: true }
				]}
				rows={data.longest.map((r) => ({
					...r,
					sp: speciesName(r.species),
					href: `/sharks/${encodeURIComponent(r.id)}`
				}))}
			/>
			<p class="muted small">Straight-line distance between nursery coordinates.</p>
		</div>
		<div class="card">
			<h2 class="h">Most-caught sharks</h2>
			<DataTable
				columns={[
					{ key: 'id', label: 'Shark', href: 'href' },
					{ key: 'sp', label: 'Species' },
					{ key: 'n', label: 'Captures', num: true },
					{ key: 'seasons', label: 'Seasons', num: true },
					{ key: 'firstL', label: 'First' },
					{ key: 'lastL', label: 'Last' }
				]}
				rows={data.most.map((r) => ({
					...r,
					sp: speciesName(r.species),
					firstL: date(r.first),
					lastL: date(r.last)
				}))}
			/>
		</div>
	</section>

	{#if data.abundance.rows.length}
		{@const ab = data.abundance}
		{@const top = [...ab.rows].sort((a, b) => b.n - a.n).slice(0, 12)}
		<section class="section">
			<h2 class="h">How many pups use a nursery?</h2>
			<p class="muted small">
				Schnabel mark–recapture estimates for each nursery, season and species with at least three
				recaptures that season. Each set is a sample; a shark caught earlier the same season at the
				same nursery counts as marked. A nursery is not a closed population (pups are born through
				the season, move and die), so read these as a rough scale, not a census.
			</p>
			<div class="grid-2">
				<ChartCard
					title="Estimated pups vs catch rate"
					subtitle="One dot per nursery-season; each species against its own catch rate"
					note={[
						ab.cm
							? `Blacktips: Spearman ρ = ${num(ab.cm.rho, 2)} (${pValue(ab.cm.p)}, n = ${ab.cm.n}).`
							: '',
						ab.na
							? `Sicklefin lemons: ρ = ${num(ab.na.rho, 2)} (${pValue(ab.na.p)}, n = ${ab.na.n}).`
							: ''
					]
						.filter(Boolean)
						.join(' ') + ' Both come from the same catches, so some agreement is built in.'}
				>
					<Scatter
						points={ab.rows
							.filter((r) => r.cpue != null)
							.map((r) => ({
								x: r.cpue!,
								y: r.n,
								g: speciesName(r.species),
								label: `${r.site} ${season(r.season)}: ${num(r.n)} (${num(r.lo)}–${num(r.hi)})`
							}))}
						groups={[
							{ name: SPECIES.Cm.common, color: SPECIES.Cm.color },
							{ name: SPECIES.Na.common, color: SPECIES.Na.color }
						]}
						xLabel="Sharks / net-hour (that species)"
						yLabel="Estimated pups"
						xFormat={(v) => num(v, 2)}
						yFormat={(v) => num(v)}
					/>
				</ChartCard>
				<ChartCard
					title="Largest estimates"
					subtitle="Top 12 nursery-seasons; whiskers: 95% limits from exact Poisson limits on the recaptures. All estimates under Show data."
					table={{
						columns: [
							{ key: 'site', label: 'Nursery' },
							{ key: 'seasonL', label: 'Season' },
							{ key: 'sp', label: 'Species' },
							{ key: 'samples', label: 'Sets', num: true },
							{ key: 'distinct', label: 'Sharks caught', num: true },
							{ key: 'recaptures', label: 'Recaptures', num: true },
							{ key: 'n', label: 'Estimate', num: true },
							{ key: 'ci', label: '95% limits' }
						],
						rows: [...ab.rows]
							.sort((a, b) => b.n - a.n)
							.map((r) => ({
								...r,
								seasonL: season(r.season),
								sp: speciesName(r.species),
								ci: `${num(r.lo)}–${num(r.hi)}`
							}))
					}}
				>
					<BarChart
						horizontal
						categories={top.map(
							(r) => `${r.site} ${season(r.season)} (${r.species === 'Cm' ? 'blacktip' : 'lemon'})`
						)}
						series={[
							{ name: 'Estimated pups', color: 'var(--series-4)', values: top.map((r) => r.n) }
						]}
						errors={top.map((r) => [r.lo, r.hi] as [number, number])}
						valueFormat={(v) => num(v)}
					/>
				</ChartCard>
			</div>
		</section>
	{/if}
</div>

<style>
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
