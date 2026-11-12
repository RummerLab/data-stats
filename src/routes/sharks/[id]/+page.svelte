<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InteractiveMap from '#lib/components/InteractiveMap.svelte';
	import MooreaMap from '#lib/components/MooreaMap.svelte';
	import { moveDuration } from '#lib/components/lineGeometry';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { toDay } from '#lib/components/charts/scale';
	import { clock, date, num } from '#lib/format';
	import { speciesColor, speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ind = $derived(data.ind);
	const growth = $derived(data.captures.filter((c) => c.date && c.tl != null));

	// Play this shark's captures in order (#173, #183): continuous slider scrubbing and animated water routes.
	const stops = $derived(data.track.length);
	const totalMoves = $derived(Math.max(1, stops - 1));
	let progress = $state(0);
	let playing = $state(false);
	let showAll = $state(false);

	// Which leg of the track is active (0 to totalMoves - 1):
	const activeLeg = $derived(Math.min(totalMoves - 1, Math.floor(progress)));
	const legFraction = $derived(progress >= totalMoves ? 1 : Math.max(0, progress - activeLeg));
	const fromStop = $derived(data.track[activeLeg] ?? data.track[0]);
	const toStop = $derived(data.track[activeLeg + 1] ?? data.track[stops - 1]);
	// The move between consecutive captures (m.at is the destination capture index in +page.server.ts):
	const activeMove = $derived(data.moves.find((m) => m.at === activeLeg + 1));
	const color = $derived(speciesColor(ind.species));

	const shownMoves = $derived(
		showAll ? data.moves : data.moves.filter((m) => m.at <= activeLeg + 1)
	);

	function stop() {
		playing = false;
	}

	function play() {
		if (playing) return stop();
		showAll = false;
		if (progress >= totalMoves - 0.001) {
			progress = 0;
		}
		playing = true;
	}

	function jumpTo(idx: number) {
		stop();
		showAll = false;
		progress = idx;
	}

	function toggleAll() {
		stop();
		showAll = true;
		progress = totalMoves;
	}

	$effect(() => {
		if (!playing) return;
		let lastTime: number | null = null;
		let raf: number;
		const tick = (now: number) => {
			if (!playing) return;
			if (lastTime == null) {
				lastTime = now;
				raf = requestAnimationFrame(tick);
				return;
			}
			const dt = now - lastTime;
			lastTime = now;

			const leg = Math.min(totalMoves - 1, Math.floor(progress));
			const move = data.moves.find((m) => m.at === leg + 1);
			const duration = moveDuration(move?.km);
			const next = progress + dt / Math.max(800, duration);

			if (next >= totalMoves) {
				progress = totalMoves;
				playing = false;
				return;
			}
			progress = next;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	const sliderAriaText = $derived(
		showAll
			? 'All captures'
			: activeMove && legFraction > 0.01 && legFraction < 0.99
				? `Swimming from ${fromStop.site} to ${toStop.site}, ${Math.round(legFraction * 100)}%`
				: progress >= 0.99
					? `Capture ${toStop.n}: ${toStop.site}, ${date(toStop.date)}`
					: `Capture 1: ${data.track[0].site}, ${date(data.track[0].date)}`
	);
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow"><a href="/sharks">Sharks</a></p>
		<h1>{speciesName(ind.species)} <span class="id">{ind.id}</span></h1>
		<p class="lede">
			{ind.sex === 'F' ? 'Female' : ind.sex === 'M' ? 'Male' : 'Sex unknown'} · {num(ind.nCaptures)} capture{ind.nCaptures ===
			1
				? ''
				: 's'} · first seen {date(ind.firstDate)}{ind.nCaptures > 1
				? `, last seen ${date(ind.lastDate)}`
				: ''}
			{#if ind.tags.length > 1}· tags {ind.tags.join(', ')}{/if}
		</p>
		{#if ind.conflict}
			<p class="callout small">
				The captures linked to this tag disagree on <b>{ind.conflict}</b>; see
				<a href="/data-quality">data quality</a>.
			</p>
		{/if}
	</header>

	<section class="section grid-2">
		{#if growth.length > 1}
			<ChartCard title="Growth" subtitle="Total length at each capture">
				<LineChart
					xType="date"
					series={[
						{
							name: 'Total length (mm)',
							color: speciesColor(ind.species),
							dots: true,
							points: growth.map((c) => ({ x: toDay(c.date!), y: c.tl }))
						}
					]}
					yFormat={(v) => `${num(v)} mm`}
				/>
			</ChartCard>
		{/if}
		{#if data.map.length}
			<ChartCard
				title="Where it was caught"
				subtitle={data.moves.length
					? 'Circle size = number of captures. Arrows join consecutive captures at different nurseries along the shortest water route (an estimate, not the actual path swum). Play steps through the captures in order.'
					: 'Circle size = number of captures'}
			>
				{#if data.moves.length}
					<div class="player">
						<button type="button" class="play" onclick={play} aria-pressed={playing}>
							{playing ? 'Pause' : progress >= totalMoves ? 'Replay' : 'Play'}
						</button>
						<label for="capture-slider">Capture</label>
						<input
							id="capture-slider"
							type="range"
							min="0"
							max={totalMoves}
							step="0.002"
							value={progress}
							oninput={(e) => {
								stop();
								showAll = false;
								progress = Number(e.currentTarget.value);
							}}
							aria-valuetext={sliderAriaText}
						/>
						<output for="capture-slider" aria-live="polite">
							{#if showAll}
								<strong>All captures</strong> ({data.track.length} captures, {data.moves.length} moves)
							{:else if activeMove && legFraction > 0.01 && legFraction < 0.99}
								<strong>Swimming:</strong>
								{fromStop.site} → {toStop.site}
								{#if activeMove.km != null}
									· <strong
										>{num(activeMove.km * legFraction, 1)} of {num(activeMove.km, 1)} km by water</strong
									>
									({Math.round(legFraction * 100)}%)
								{/if}
							{:else if progress >= 0.99}
								{@const arrivedStop = toStop}
								{@const prevStop = fromStop}
								<strong>Capture {arrivedStop.n} of {ind.nCaptures}</strong>
								· {date(arrivedStop.date)} · {arrivedStop.site}{arrivedStop.tl != null
									? ` · ${num(arrivedStop.tl)} mm`
									: ''}{prevStop && prevStop.site !== arrivedStop.site
									? ` (moved from ${prevStop.site}${activeMove?.km ? ` · ≥ ${num(activeMove.km, 1)} km by water` : ''})`
									: prevStop
										? ` (recaptured at ${arrivedStop.site})`
										: ''}
							{:else}
								{@const firstStop = data.track[0]}
								<strong>Capture 1 of {ind.nCaptures}</strong>
								· {date(firstStop.date)} · {firstStop.site}{firstStop.tl != null
									? ` · ${num(firstStop.tl)} mm`
									: ''} (starting nursery)
							{/if}
						</output>
						<div class="stops-nav" role="group" aria-label="Jump to capture stop">
							{#each data.track as t, i (t.n)}
								<button
									type="button"
									class="stop-btn"
									class:active={!showAll && Math.abs(progress - i) < 0.05}
									onclick={() => jumpTo(i)}
								>
									Capture {t.n} · {t.site}
								</button>
							{/each}
							<button type="button" class="stop-btn" class:active={showAll} onclick={toggleAll}>
								All moves
							</button>
						</div>
					</div>
					<InteractiveMap
						label={`Map of where shark ${ind.id} was caught`}
						valueLabel="Captures"
						height={340}
						bounds={data.moves.flatMap((m) =>
							m.path && m.path.length > 0
								? m.path
								: [
										[m.from.lat, m.from.lon],
										[m.to.lat, m.to.lon]
									]
						)}
						layers={[
							{ name: 'Capture sites', color, sized: true, maxRadius: 12, points: data.map }
						]}
						lineLayers={[{ name: 'Moves', color, lines: shownMoves }]}
						lineMax={4}
						traveller={data.track.length
							? {
									key: activeLeg,
									from: fromStop,
									to: toStop,
									path: activeMove?.path,
									km: activeMove?.km,
									color,
									species: ind.species,
									lineId: activeMove?.id,
									still: !activeMove,
									fraction: showAll ? 1 : legFraction,
									playing
								}
							: undefined}
					/>
				{:else}
					<MooreaMap points={data.map} maxR={12} valueLabel="Captures" />
				{/if}
			</ChartCard>
		{/if}
	</section>

	<section class="section card">
		<h2 class="h">Capture history</h2>
		<DataTable
			columns={[
				{ key: 'dateL', label: 'Date' },
				{ key: 'site', label: 'Nursery' },
				{ key: 'timeL', label: 'Time' },
				{ key: 'tl', label: 'TL (mm)', num: true },
				{ key: 'fl', label: 'FL (mm)', num: true },
				{ key: 'mass', label: 'Mass (kg)', num: true },
				{ key: 'k', label: 'K', num: true, dp: 3 },
				{ key: 'umbilical', label: 'Umbilical' },
				{ key: 'sst', label: 'SST °C', num: true },
				{ key: 'notes', label: 'Notes' },
				{ key: 'source', label: 'Source' }
			]}
			rows={data.captures.map((c) => ({ ...c, dateL: date(c.date), timeL: clock(c.time) }))}
		/>
	</section>

	{#if data.lab.length}
		<section class="section card">
			<h2 class="h">Lab stays (CRIOBE)</h2>
			<DataTable
				columns={[
					{ key: 'arrivalL', label: 'Arrived' },
					{ key: 'releaseL', label: 'Released' },
					{ key: 'days', label: 'Days', num: true },
					{ key: 'arrTl', label: 'TL in', num: true },
					{ key: 'relTl', label: 'TL out', num: true },
					{ key: 'arrMass', label: 'Mass in', num: true },
					{ key: 'relMass', label: 'Mass out', num: true },
					{ key: 'notes', label: 'Notes' }
				]}
				rows={data.lab.map((l) => ({ ...l, arrivalL: date(l.arrival), releaseL: date(l.release) }))}
			/>
		</section>
	{/if}
</div>

<style>
	.player {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin-bottom: 12px;
		font-size: 0.9rem;
	}
	.player input {
		flex: 1 1 140px;
		accent-color: var(--series-1);
	}
	.player output {
		flex: 1 1 100%;
		min-height: 1.5em;
		color: var(--ink);
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
	.stops-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		width: 100%;
		margin-top: 2px;
	}
	.stop-btn {
		font: inherit;
		font-size: 0.78rem;
		padding: 2px 9px;
		border-radius: 999px;
		border: 1px solid var(--hairline);
		background: var(--surface-2);
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}
	.stop-btn:hover {
		color: var(--ink);
		border-color: var(--ink-2);
	}
	.stop-btn.active {
		background: var(--series-1);
		color: #ffffff;
		border-color: var(--series-1);
		font-weight: 600;
	}
	.id {
		font-weight: 400;
		color: var(--ink-2);
		font-size: 0.6em;
		font-variant-numeric: tabular-nums;
	}
	.h {
		font-size: 1.1rem;
		margin: 0 0 8px;
	}
</style>
