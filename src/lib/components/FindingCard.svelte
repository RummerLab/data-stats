<script lang="ts">
	let {
		finding
	}: {
		finding: { id: string; kind: string; title: string; value: string; text: string; href: string };
	} = $props();
	const KIND: Record<string, string> = {
		record: 'Record',
		quirk: 'Quirk',
		pattern: 'Pattern',
		people: 'People'
	};
</script>

<a class="card finding" href={finding.href} id={`finding-${finding.id}`}>
	<span class="kind">{KIND[finding.kind] ?? finding.kind}</span>
	<span class="title">{finding.title}</span>
	<span class="value">{finding.value}</span>
	<span class="text">{finding.text}</span>
</a>

<style>
	.finding {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s;
	}
	.finding:hover {
		border-color: var(--accent);
	}
	.kind {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent-ink);
		font-weight: 600;
	}
	.title {
		font-weight: 600;
		color: var(--ink-2);
		font-size: 0.92rem;
	}
	.value {
		font-size: 1.6rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}
	.text {
		color: var(--ink-2);
		font-size: 0.88rem;
		line-height: 1.5;
	}
</style>
