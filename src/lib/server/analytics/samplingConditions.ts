import type { Dataset } from '../data';

/** One nursery/calendar month at a time: no pooling weights or duplicated sampling dates. */
export function samplingConditions(
	d: Pick<Dataset, 'sets' | 'sites' | 'weather' | 'ocean'>,
	siteId?: string | null,
	period?: string | null
) {
	const siteIds = new Set(d.sites.filter((s) => s.kind === 'nursery').map((s) => s.id));
	const sets = d.sets.filter(
		(s) => s.gear === 'Gillnet' && s.date && s.siteId && siteIds.has(s.siteId)
	);
	const sites = d.sites
		.filter((s) => sets.some((r) => r.siteId === s.id))
		.map((s) => ({ id: s.id, name: s.name }))
		.sort((a, b) => a.name.localeCompare(b.name));
	const selectedSite = sites.find((s) => s.id === siteId) ?? sites[0];
	const own = sets.filter((s) => s.siteId === selectedSite?.id);
	const periods = [...new Set(own.map((s) => s.date!.slice(0, 7)))].sort();
	const selectedPeriod = periods.includes(period ?? '') ? period! : periods.at(-1);
	if (!selectedSite || !selectedPeriod)
		return {
			sites,
			periods,
			site: null,
			period: null,
			metrics: [],
			sampleDays: 0,
			calendarDays: 0
		};
	const sampleDates = new Set(
		own.filter((s) => s.date!.startsWith(selectedPeriod)).map((s) => s.date!)
	);
	const [year, month] = selectedPeriod.split('-').map(Number);
	const calendarDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
	const dates = Array.from(
		{ length: calendarDays },
		(_, i) => `${selectedPeriod}-${String(i + 1).padStart(2, '0')}`
	);
	const weather = new Map(d.weather.map((r) => [r.date, r]));
	const ocean = new Map(d.ocean.map((r) => [r.date, r]));
	const variables = [
		{
			key: 'rain',
			label: 'Daily rainfall',
			unit: 'mm',
			get: (date: string) => weather.get(date)?.precip
		},
		{
			key: 'wind',
			label: 'Daily maximum wind',
			unit: 'km/h',
			get: (date: string) => weather.get(date)?.windMax
		},
		{
			key: 'sst',
			label: 'Daily offshore SST (OISST)',
			unit: '°C',
			get: (date: string) => ocean.get(date)?.oisst
		}
	];
	const metrics = variables.map((v) => {
		const all = dates
			.map((date) => ({ date, value: v.get(date) }))
			.filter(
				(r): r is { date: string; value: number } => r.value != null && Number.isFinite(r.value)
			);
		const sampled = all.filter((r) => sampleDates.has(r.date));
		const min = all.length ? Math.min(...all.map((r) => r.value)) : 0;
		const max = all.length ? Math.max(...all.map((r) => r.value)) : 1;
		const lower = min === max ? min - 0.5 : min;
		const upper = min === max ? max + 0.5 : max;
		const edges = Array.from({ length: 11 }, (_, i) => lower + ((upper - lower) * i) / 10);
		const counts = (rs: typeof all) =>
			edges
				.slice(0, -1)
				.map(
					(lo, i) =>
						rs.filter(
							(r) => r.value >= lo && (i === 9 ? r.value <= edges[i + 1] : r.value < edges[i + 1])
						).length
				);
		const a = counts(all),
			s = counts(sampled);
		const rows = a.map((n, i) => ({
			from: edges[i],
			to: edges[i + 1],
			all: n,
			sampled: s[i],
			allPct: all.length ? (100 * n) / all.length : null,
			sampledPct: sampled.length ? (100 * s[i]) / sampled.length : null
		}));
		return {
			key: v.key,
			label: v.label,
			unit: v.unit,
			edges,
			rows,
			all: all.length,
			sampled: sampled.length,
			missingAll: calendarDays - all.length,
			missingSample: sampleDates.size - sampled.length
		};
	});
	return {
		sites,
		periods,
		site: selectedSite,
		period: selectedPeriod,
		metrics,
		sampleDays: sampleDates.size,
		calendarDays
	};
}
