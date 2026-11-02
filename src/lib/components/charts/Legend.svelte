<script lang="ts">
	let {
		items
	}: { items: { label: string; color: string; kind?: 'swatch' | 'line' | 'dot' | 'dash' }[] } =
		$props();
</script>

{#if items.length > 1}
	<ul class="legend" aria-label="Legend">
		{#each items as it (it.label)}
			<li>
				{#if it.kind === 'line' || it.kind === 'dash'}
					<svg width="18" height="10" aria-hidden="true"
						><line
							x1="1"
							x2="17"
							y1="5"
							y2="5"
							stroke={it.color}
							stroke-width="2"
							stroke-linecap="round"
							stroke-dasharray={it.kind === 'dash' ? '4 3' : undefined}
						/></svg
					>
				{:else if it.kind === 'dot'}
					<svg width="10" height="10" aria-hidden="true"
						><circle cx="5" cy="5" r="4" fill={it.color} /></svg
					>
				{:else}
					<span class="swatch" style:background={it.color}></span>
				{/if}
				{it.label}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		list-style: none;
		padding: 0;
		margin: 0 0 8px;
		font-size: 0.8rem;
		color: var(--ink-2);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
</style>
