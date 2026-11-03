<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Heatmap from './charts/Heatmap.svelte';
	import type { thermalCalendar } from '#lib/server/analytics/thermalCalendar';
	let { sites }: { sites: ReturnType<typeof thermalCalendar> } = $props();
	let selected = $state('');
	const site = $derived(sites.find((s) => s.id === selected) ?? sites[0]);
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
</script>

<section class="section">
	<h2>Nursery temperature through the year</h2>
	<p class="muted small">
		Historical month-by-hour averages, pooled across logged years. Each cell needs at least ten
		observed days. Years and months have unequal coverage; this is neither a live forecast nor a
		comparison of nursery safety. Existing logger exclusions apply, and very shallow loggers may be
		exposed at low tide.
	</p>
	{#if site}
		<label
			>Nursery <select value={site.id} onchange={(e) => (selected = e.currentTarget.value)}
				>{#each sites as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select
			></label
		>
		<ChartCard
			title={`Month and hour: ${site.name}`}
			subtitle="Mean °C · Moorea local time (UTC−10) · fixed 15–40 °C scale across nurseries"
			note="Grey cells have fewer than ten contributing days or no data. A day contributes one site-hour average regardless of the number of sensors. Pooled means cannot establish peak temperatures or hours above a stress threshold."
			table={{
				columns: [
					{ key: 'month', label: 'Month', num: true },
					{ key: 'hour', label: 'Local hour', num: true },
					{ key: 'temperature', label: 'Mean °C', num: true },
					{ key: 'days', label: 'Contributing days', num: true }
				],
				rows: site.rows
			}}
		>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (The horizontally scrollable region must be keyboard reachable.) -->
			<div class="scroll" role="region" aria-label="Scrollable temperature calendar" tabindex="0">
				<div class="calendar">
					<Heatmap
						xLabels={Array.from({ length: 24 }, (_, h) => String(h))}
						yLabels={months}
						values={site.values}
						domain={[15, 40]}
						format={(v) => `${v.toFixed(1)} °C`}
						xTitle="Local hour"
						yTitle="Month"
					/>
				</div>
			</div>
			<div class="ramp" aria-label="Colour scale: 15 to 40 degrees Celsius, light to dark">
				<span>15 °C</span>{#each [1, 2, 3, 4, 5, 6, 7] as k (k)}<i
						style:background={`var(--seq-${k})`}
					></i>{/each}<span>40 °C</span>
			</div>
		</ChartCard>
	{:else}<p>No nursery logger observations available.</p>{/if}
</section>

<style>
	.ramp {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.8rem;
		color: var(--ink-2);
	}
	.ramp i {
		width: 24px;
		height: 12px;
	}
	label {
		display: block;
		margin-bottom: 1rem;
	}
	.scroll {
		overflow-x: auto;
	}
	.calendar {
		min-width: 620px;
	}
</style>
