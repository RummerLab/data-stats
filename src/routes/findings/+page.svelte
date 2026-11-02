<script lang="ts">
	import FindingCard from '#lib/components/FindingCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const groups = [
		{ kind: 'quirk', title: 'Quirks', blurb: 'Odd, surprising and fun.' },
		{
			kind: 'pattern',
			title: 'Patterns',
			blurb: 'What the numbers suggest across thirteen seasons.'
		},
		{ kind: 'record', title: 'Records', blurb: 'The biggest, smallest, fastest and longest.' },
		{ kind: 'people', title: 'People', blurb: 'The crews behind the nets.' }
	];
</script>

<div class="container">
	<header class="page-head">
		<p class="eyebrow">Explore</p>
		<h1>Findings</h1>
		<p class="lede">
			Every finding here is computed from the logs each time the data is imported, so it changes as
			new seasons arrive. Patterns are correlations, not proof: follow each card to the chart and
			the caveats behind it.
		</p>
	</header>
	{#each groups as g (g.kind)}
		{@const items = data.findings.filter((f) => f.kind === g.kind)}
		{#if items.length}
			<section class="section">
				<h2>{g.title}</h2>
				<p>{g.blurb}</p>
				<div class="grid-3">
					{#each items as f (f.id)}<FindingCard finding={f} />{/each}
				</div>
			</section>
		{/if}
	{/each}
</div>
