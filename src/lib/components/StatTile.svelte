<script lang="ts">
	let { label, value, sub, href }: { label: string; value: string; sub?: string; href?: string } =
		$props();
</script>

<svelte:element this={href ? 'a' : 'div'} {href} class="card tile" class:link={!!href}>
	<span class="label">{label}</span>
	<span class="value">{value}</span>
	{#if sub}<span class="sub">{sub}</span>{/if}
</svelte:element>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
		color: inherit;
		padding: 16px 18px;
	}
	.link:hover {
		border-color: var(--accent);
	}
	.label {
		font-size: 0.8rem;
		color: var(--ink-2);
		font-weight: 500;
	}
	.value {
		font-size: 1.9rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		color: var(--ink);
		line-height: 1.15;
	}
	.sub {
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
