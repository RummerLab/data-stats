import type { Dataset } from '../data';

/** A month-hour needs ten observed days. n counts site-hours, not sensor samples. */
export const MIN_THERMAL_DAYS = 10;
export function thermalCalendar(d: Pick<Dataset, 'loggerDiel' | 'sites'>) {
	return d.sites
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
			return {
				id: s.id,
				name: s.name,
				rows: rows.flat(),
				values: rows.map((rs) => rs.map((r) => r.temperature))
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}
