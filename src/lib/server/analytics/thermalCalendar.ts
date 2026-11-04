import type { Dataset } from '../data';

/** A month-hour needs ten observed days. n counts site-hours, not sensor samples. */
export const MIN_THERMAL_DAYS = 10;

/**
 * Month × hour mean temperature per nursery (#127), from `logger_diel`. One colour domain for
 * every nursery so they compare, taken from the supported cells (whole degrees): the 15–40 °C
 * plausibility window would squeeze the lagoon's few degrees into two colour steps.
 */
export function thermalCalendar(d: Pick<Dataset, 'loggerDiel' | 'loggerDaily' | 'sites'>) {
	const sites = d.sites
		.filter((s) => d.loggerDiel.some((r) => r.siteId === s.id))
		.map((s) => {
			const records = new Map(
				d.loggerDiel.filter((r) => r.siteId === s.id).map((r) => [`${r.month}|${r.hour}`, r])
			);
			const rows = Array.from({ length: 12 }, (_, m) =>
				Array.from({ length: 24 }, (_, hour) => {
					const r = records.get(`${m + 1}|${hour}`);
					return {
						month: m + 1,
						hour,
						days: r?.n ?? 0,
						temperature: r && r.n >= MIN_THERMAL_DAYS && Number.isFinite(r.temp) ? r.temp : null
					};
				})
			);
			const days = d.loggerDaily.filter((r) => r.siteId === s.id).map((r) => r.date);
			days.sort();
			return {
				id: s.id,
				name: s.name,
				days: days.length,
				first: days[0] ?? null,
				last: days.at(-1) ?? null,
				rows: rows.flat(),
				values: rows.map((rs) => rs.map((r) => r.temperature))
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
	const cells = sites
		.flatMap((s) => s.rows.map((r) => r.temperature))
		.filter((v): v is number => v != null);
	const domain: [number, number] = cells.length
		? [Math.floor(Math.min(...cells)), Math.ceil(Math.max(...cells))]
		: [15, 40];
	if (domain[0] === domain[1]) domain[1] += 1;
	return { domain, sites };
}
