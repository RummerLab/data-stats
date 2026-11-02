<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InteractiveMap from '#lib/components/InteractiveMap.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import Heatmap from '#lib/components/charts/Heatmap.svelte';
	import { num, pct, season } from '#lib/format';
	import { SPECIES } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const mapped = $derived(data.rows.filter((r) => r.lat != null && r.lon != null));
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Explore</p>
		<h1>Nurseries</h1>
		<p class="lede">
			Mo'orea's shallow, sandy lagoon beaches where blacktip reef and sicklefin lemon sharks are
			born. Some are busy with pups; others are almost empty. Select a nursery for its full profile.
		</p>
	</header>

	<section class="section">
		<ChartCard
			title="Nurseries around the island"
			subtitle="Circles sized by sharks per net-hour (both species). Switch between satellite and street maps, or show adult blacktip capture spots."
		>
			<InteractiveMap
				label="Map of Mo'orea's shark nurseries"
				valueLabel="Sharks / net-hour"
				format={(v) => num(v, 2)}
				layers={[
					{
						name: 'Nurseries',
						color: 'var(--series-1)',
						sized: true,
						points: mapped.map((r) => ({
							id: r.id,
							label: r.name,
							lat: r.lat!,
							lon: r.lon!,
							value: r.cpue,
							href: r.href,
							sub: `${num(r.captures)} captures, ${num(r.sets)} sets`
						}))
					},
					...(data.adults.length
						? [{ name: 'Adult blacktip captures', color: 'var(--series-4)', points: data.adults }]
						: [])
				]}
			/>
		</ChartCard>
	</section>

	<section class="section grid-2">
		<ChartCard
			title="Sicklefin lemons vs blacktips"
			subtitle="Catch rate per species: lemon sharks are concentrated in a few southern and western nurseries"
		>
			<BarChart
				horizontal
				categories={data.rows.map((r) => r.name)}
				series={[
					{
						name: SPECIES.Cm.common,
						color: SPECIES.Cm.color,
						values: data.rows.map((r) => r.cpueCm)
					},
					{
						name: SPECIES.Na.common,
						color: SPECIES.Na.color,
						values: data.rows.map((r) => r.cpueNa)
					}
				]}
				valueFormat={(v) => num(v, 2)}
				hrefs={data.rows.map((r) => r.href)}
			/>
		</ChartCard>
	</section>

	<section class="section">
		<ChartCard
			title="Catch rate by nursery and season"
			subtitle="Sharks per net-hour; darker is busier, grey means not sampled with timed sets"
			table={{
				columns: [
					{ key: 'name', label: 'Nursery' },
					...data.seasons.map((s, i) => ({ key: `s${i}`, label: season(s), num: true }))
				],
				rows: data.rows.map((r, i) => ({
					name: r.name,
					...Object.fromEntries(data.heat[i].map((v, k) => [`s${k}`, v]))
				}))
			}}
		>
			<Heatmap
				xLabels={data.seasons.map(season)}
				yLabels={data.rows.map((r) => r.name)}
				values={data.heat}
				format={(v) => num(v, 2)}
				cellLabels
			/>
		</ChartCard>
	</section>

	<section class="section card">
		<DataTable
			columns={[
				{ key: 'name', label: 'Nursery', href: 'href' },
				{ key: 'seasons', label: 'Seasons', num: true },
				{ key: 'sets', label: 'Sets', num: true },
				{ key: 'captures', label: 'Captures', num: true },
				{ key: 'cpue', label: 'Sharks/h', num: true },
				{ key: 'zeroL', label: 'Zero-catch', num: true },
				{ key: 'newbornL', label: 'Newborn share', num: true },
				{ key: 'tlCm', label: 'Cm TL (mm)', num: true },
				{ key: 'kCm', label: 'Newborn Cm K', num: true, dp: 3 },
				{ key: 'recapL', label: 'Recaptured', num: true },
				{ key: 'tier', label: 'Human pressure' }
			]}
			rows={data.rows.map((r) => ({
				...r,
				zeroL: pct(r.zero),
				newbornL: pct(r.newborn),
				recapL: pct(r.recapRate)
			}))}
		/>
		<p class="muted small">
			K is Fulton's condition factor (100·mass/length³). Human-pressure tiers come from Bouyoucos et
			al. (2024); see
			<a href="/pressure">Human pressure</a>.
		</p>
	</section>
</div>
