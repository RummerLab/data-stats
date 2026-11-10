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

	// Season slider (#172): the last stop shows every season pooled.
	let idx = $state(Number.MAX_SAFE_INTEGER);
	const all = $derived(data.seasons.length);
	const at = $derived(Math.min(idx, all));
	const seasonLabel = $derived(at === all ? 'All seasons' : season(data.seasons[at]));
	// One scale for every frame so circle sizes stay comparable between seasons.
	const scaleMax = $derived(
		Math.max(1e-9, ...data.heat.flat().map((v) => v ?? 0), ...data.rows.map((r) => r.cpue ?? 0))
	);
	const points = $derived(
		data.rows.flatMap((r, i) => {
			if (r.lat == null || r.lon == null) return [];
			const s = at === all ? null : data.perSeason[i][at];
			const value = at === all ? r.cpue : data.heat[i][at];
			return [
				{
					id: r.id,
					label: r.name,
					lat: r.lat,
					lon: r.lon,
					value,
					href: r.href,
					sub: s
						? value == null
							? s.sets
								? `${num(s.sets)} sets, none timed`
								: 'Not sampled this season'
							: `${num(s.captures)} captures, ${num(s.sets)} sets`
						: `${num(r.captures)} captures, ${num(r.sets)} sets`
				}
			];
		})
	);

	let timer: ReturnType<typeof setInterval> | undefined;
	let playing = $state(false);
	function stop() {
		clearInterval(timer);
		playing = false;
	}
	function play() {
		if (playing) return stop();
		if (at >= all - 1) idx = 0;
		playing = true;
		timer = setInterval(() => {
			if (idx >= all - 1) stop();
			else idx = Math.min(idx, all) + 1;
		}, 1200);
	}
	$effect(() => stop);
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
			papers={['eustache2024density', 'bouyoucos2022nursery']}
			subtitle="Circles sized by sharks per net-hour (both species), on one scale for every season. Dashed rings: not sampled with timed sets that season. Switch between satellite and street maps, or show adult blacktip capture spots."
		>
			<div class="slider">
				<button type="button" class="play" onclick={play} aria-pressed={playing}>
					{playing ? 'Pause' : 'Play seasons'}
				</button>
				<label for="season-slider">Season</label>
				<input
					id="season-slider"
					type="range"
					min="0"
					max={all}
					step="1"
					value={at}
					oninput={(e) => {
						stop();
						idx = Number(e.currentTarget.value);
					}}
					aria-valuetext={seasonLabel}
				/>
				<output for="season-slider">{seasonLabel}</output>
			</div>
			<InteractiveMap
				label="Map of Mo'orea's shark nurseries"
				valueLabel="Sharks / net-hour"
				format={(v) => num(v, 2)}
				layers={[
					{
						name: at === all ? 'Nurseries' : `Nurseries, ${seasonLabel}`,
						color: 'var(--series-1)',
						sized: true,
						max: scaleMax,
						points
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
			papers={['bouyoucos2022nursery']}
			subtitle="Catch rate per species: lemon sharks are concentrated in a few southern and western nurseries"
			stats={data.stats.species}
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
			papers={['eustache2024density']}
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

<style>
	.slider {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-bottom: 12px;
		font-size: 0.9rem;
	}
	.slider input {
		flex: 1 1 220px;
		accent-color: var(--series-1);
	}
	.slider output {
		min-width: 7.5em;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
	}
	.play {
		font: inherit;
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--hairline);
		background: var(--surface-2);
		color: var(--ink);
		cursor: pointer;
	}
</style>
