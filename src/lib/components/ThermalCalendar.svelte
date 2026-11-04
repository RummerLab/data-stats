<script lang="ts">
	import ChartCard from './ChartCard.svelte';
	import Heatmap from './charts/Heatmap.svelte';
	import { MONTH_NAMES, monthYear, num } from '#lib/format';
	import type { thermalCalendar } from '#lib/server/analytics/thermalCalendar';
	let { calendar }: { calendar: ReturnType<typeof thermalCalendar> } = $props();
	let selected = $state('');
	const site = $derived(calendar.sites.find((s) => s.id === selected) ?? calendar.sites[0]);
	const [lo, hi] = $derived(calendar.domain);
</script>

<section class="section">
	<h2>Nursery temperature through the year</h2>
	<p class="muted small">
		Mean logger temperature for each month and hour of the day, pooled over every year a nursery was
		logged. A cell needs at least ten logged days. Nurseries were logged in different years and for
		different lengths of time (under each chart), so years and months don't count equally. These are
		long-run averages, not a forecast, and not a ranking of nurseries. Downloads left out above stay
		out here, and a very shallow logger may be out of the water at low tide.
	</p>
	{#if site}
		<label
			>Nursery <select value={site.id} onchange={(e) => (selected = e.currentTarget.value)}
				>{#each calendar.sites as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select
			></label
		>
		<ChartCard
			title={`Month and hour: ${site.name}`}
			subtitle={`Mean °C, Moorea local time (UTC−10). Every nursery uses the same ${lo}–${hi} °C colour scale.${site.first && site.last ? ` Logged on ${num(site.days)} days, ${monthYear(site.first)} to ${monthYear(site.last)}.` : ''}`}
			note="Dashed cells have fewer than ten logged days. Each day adds one nursery-wide hourly mean however many loggers were in the water. Long-run means can't show peak temperatures or hours above a stress threshold."
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
						yLabels={MONTH_NAMES}
						values={site.values}
						domain={calendar.domain}
						format={(v) => `${v.toFixed(1)} °C`}
						xTitle="Local hour"
						yTitle="Month"
					/>
				</div>
			</div>
			<div class="ramp">
				<span>{lo} °C</span>{#each [1, 2, 3, 4, 5, 6, 7] as k (k)}<i
						aria-hidden="true"
						style:background={`var(--seq-${k})`}
					></i>{/each}<span>{hi} °C</span>
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
