<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import DataTable from '#lib/components/DataTable.svelte';
	import InteractiveMap from '#lib/components/InteractiveMap.svelte';
	import MooreaMap from '#lib/components/MooreaMap.svelte';
	import LineChart from '#lib/components/charts/LineChart.svelte';
	import { toDay } from '#lib/components/charts/scale';
	import { clock, date, num } from '#lib/format';
	import { speciesColor, speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ind = $derived(data.ind);
	const growth = $derived(data.captures.filter((c) => c.date && c.tl != null));

	// Play this shark's captures in order (#173): lines appear as it moves, a dot glides along.
	const stops = $derived(data.track.length);
	let step = $state(Number.MAX_SAFE_INTEGER);
	const at = $derived(Math.min(step, stops));
	const current = $derived(at < stops ? data.track[at] : null);
	// An unlocated capture breaks the path: do not animate across that unknown stop.
	const previous = $derived(
		current && at > 0 && data.track[at - 1].n === current.n - 1 ? data.track[at - 1] : null
	);
	const color = $derived(speciesColor(ind.species));
	const shownMoves = $derived(
		current ? data.moves.filter((m) => m.at + 1 <= current.n) : data.moves
	);
	let timer: ReturnType<typeof setInterval> | undefined;
	let playing = $state(false);
	function stop() {
		clearInterval(timer);
		playing = false;
	}
	function play() {
		if (playing) return stop();
		if (at >= stops - 1) step = 0;
		playing = true;
		timer = setInterval(() => {
			if (step >= stops - 1) stop();
			else step = Math.min(step, stops) + 1;
		}, 1400);
	}
	$effect(() => stop);
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
					? 'Circle size = number of captures. Lines join consecutive captures at different nurseries (not the route swum). Play steps through the captures in order.'
					: 'Circle size = number of captures'}
			>
				{#if data.moves.length}
					<div class="player">
						<button type="button" class="play" onclick={play} aria-pressed={playing}>
							{playing ? 'Pause' : 'Play'}
						</button>
						<label for="capture-slider">Capture</label>
						<input
							id="capture-slider"
							type="range"
							min="0"
							max={stops}
							step="1"
							value={at}
							oninput={(e) => {
								stop();
								step = Number(e.currentTarget.value);
							}}
							aria-valuetext={current
								? `Capture ${current.n}: ${current.site}, ${date(current.date)}`
								: 'All captures'}
						/>
						<output for="capture-slider" aria-live="polite">
							{#if current}
								<strong>Capture {current.n} of {ind.nCaptures}</strong>
								· {date(current.date)} · {current.site}{current.tl != null
									? ` · ${num(current.tl)} mm`
									: ''}{previous && previous.site !== current.site
									? ` (moved from ${previous.site})`
									: ''}
							{:else}
								<strong>All captures</strong>
							{/if}
						</output>
					</div>
					<InteractiveMap
						label={`Map of where shark ${ind.id} was caught`}
						valueLabel="Captures"
						height={340}
						layers={[
							{ name: 'Capture sites', color, sized: true, maxRadius: 12, points: data.map }
						]}
						lineLayers={[{ name: 'Moves', color, lines: shownMoves }]}
						lineMax={4}
						traveller={current
							? {
									key: at,
									from: previous ?? current,
									to: current,
									color
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
