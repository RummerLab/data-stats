<script lang="ts">
	import DataTable from '#lib/components/DataTable.svelte';
	import { date, num } from '#lib/format';
	import { speciesName } from '#lib/species';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let q = $state('');
	let species = $state('all');
	let recapOnly = $state(true);

	const filtered = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		return data.rows.filter(
			(r) =>
				(species === 'all' || r.species === species) &&
				(!recapOnly || r.n > 1) &&
				(!needle || r.id.toLowerCase().includes(needle) || r.sites.toLowerCase().includes(needle))
		);
	});
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Explore</p>
		<h1>Sharks</h1>
		<p class="lede">
			Every shark is identified by its PIT tag (2016 onwards) or external COFA dart tag (2013–16).
			Untagged sharks get a season-and-number ID. {num(data.rows.length)} individuals, {num(
				data.rows.filter((r) => r.n > 1).length
			)} caught more than once.
		</p>
	</header>

	<div class="filters card">
		<label
			>Search tag or nursery <input
				type="search"
				bind:value={q}
				placeholder="e.g. 9550000 or Tiki"
			/></label
		>
		<label
			>Species
			<select bind:value={species}>
				<option value="all">All</option>
				<option value="Cm">{speciesName('Cm')}</option>
				<option value="Na">{speciesName('Na')}</option>
				<option value="Nf">{speciesName('Nf')}</option>
			</select>
		</label>
		<label class="cb"
			><input type="checkbox" bind:checked={recapOnly} /> Caught more than once</label
		>
		<span class="muted small">{num(filtered.length)} sharks</span>
	</div>

	<section class="section card">
		<DataTable
			max={300}
			columns={[
				{ key: 'id', label: 'Shark', href: 'href' },
				{ key: 'speciesL', label: 'Species' },
				{ key: 'sex', label: 'Sex' },
				{ key: 'n', label: 'Captures', num: true },
				{ key: 'seasons', label: 'Seasons', num: true },
				{ key: 'firstL', label: 'First seen' },
				{ key: 'lastL', label: 'Last seen' },
				{ key: 'tl0', label: 'First TL', num: true },
				{ key: 'tl1', label: 'Last TL', num: true },
				{ key: 'sites', label: 'Nurseries' }
			]}
			rows={filtered.map((r) => ({
				...r,
				href: `/sharks/${encodeURIComponent(r.id)}`,
				speciesL: speciesName(r.species),
				firstL: date(r.first),
				lastL: date(r.last)
			}))}
		/>
	</section>
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		align-items: flex-end;
	}
	label {
		display: grid;
		gap: 4px;
		font-size: 0.85rem;
		color: var(--ink-2);
	}
	label.cb {
		display: flex;
		align-items: center;
		gap: 6px;
	}
</style>
