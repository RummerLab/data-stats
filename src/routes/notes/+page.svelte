<script lang="ts">
	import ChartCard from '#lib/components/ChartCard.svelte';
	import BarChart from '#lib/components/charts/BarChart.svelte';
	import { date, num, season } from '#lib/format';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let q = $state('');
	let kind = $state('all');
	let s = $state('all');
	let limit = $state(150);
	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return data.notes.filter(
			(n) =>
				(kind === 'all' || n.kind === kind) &&
				(s === 'all' || n.season === s) &&
				(!needle || n.text.toLowerCase().includes(needle) || n.site.toLowerCase().includes(needle))
		);
	});
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Fieldwork</p>
		<h1>Field notes</h1>
		<p class="lede">
			{num(data.notes.length)} free-text notes from set logs, shark logs, the lab and the adult datasheet,
			in English and French, exactly as written in the field. Rays swimming along the net, tourists arriving,
			a broken scale, a shark that "threw up during work-up": the texture behind the numbers.
		</p>
	</header>

	<section class="section grid-2">
		<ChartCard
			title="Most common words"
			subtitle="Words of four or more letters, common English/French words removed"
		>
			<BarChart
				horizontal
				categories={data.words.map((w) => w.w)}
				series={[
					{ name: 'Mentions', color: 'var(--series-5)', values: data.words.map((w) => w.n) }
				]}
				labels
			/>
		</ChartCard>
		<div class="card filters">
			<label
				>Search <input
					type="search"
					bind:value={q}
					placeholder="e.g. ray, rain, tourists, pregnant"
				/></label
			>
			<label
				>Kind
				<select bind:value={kind}>
					<option value="all">All</option>
					<option value="set">Set log</option>
					<option value="capture">Shark log</option>
					<option value="lab">Lab</option>
					<option value="adult">Adults</option>
					<option value="hobo">Loggers</option>
					<option value="prey">Prey</option>
				</select>
			</label>
			<label
				>Season
				<select bind:value={s}>
					<option value="all">All</option>
					{#each data.seasons as x (x)}<option value={x}>{season(x)}</option>{/each}
				</select>
			</label>
			<p class="muted small">{num(filtered.length)} matching notes</p>
		</div>
	</section>

	<ul class="notes">
		{#each filtered.slice(0, limit) as n, i (i)}
			<li>
				<span class="meta"
					>{date(n.date)} · {n.site} · {n.kind}{n.species ? ` · ${n.species}` : ''}</span
				>
				<span>{n.text}</span>
			</li>
		{/each}
	</ul>
	{#if filtered.length > limit}
		<button class="btn btn-ghost" onclick={() => (limit += 300)}>Show more</button>
	{/if}
</div>

<style>
	.filters {
		display: grid;
		gap: 12px;
		align-content: start;
	}
	label {
		display: grid;
		gap: 4px;
		font-size: 0.85rem;
		color: var(--ink-2);
	}
	.notes {
		list-style: none;
		padding: 0;
		display: grid;
		gap: 8px;
		margin: 16px 0;
	}
	.notes li {
		background: var(--surface);
		border: 1px solid var(--hairline);
		border-radius: 8px;
		padding: 10px 14px;
		display: grid;
		gap: 2px;
	}
	.meta {
		font-size: 0.78rem;
		color: var(--muted);
	}
	button {
		cursor: pointer;
		background: none;
		color: var(--accent-ink);
	}
</style>
