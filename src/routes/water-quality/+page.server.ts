import { memo } from '#lib/server/data';
import { activeNurseries, boxOf, round, siteName } from '#lib/server/analytics/common';
import { linearFit, pairs } from '#lib/stats';
import type { PageServerLoad } from './$types';

const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export const load: PageServerLoad = () =>
	memo('wq', (d) => {
		const nurseries = activeNurseries(d);
		// Readings from set logs plus the dedicated field WQ / site salinity sheets.
		const readings = [
			...d.sets.map((s) => ({
				siteId: s.siteId,
				temp: s.waterTemp,
				ph: s.ph,
				doMg: s.doMg,
				sal: s.salinity,
				sst: s.sst
			})),
			...d.fieldWq.map((f) => ({
				siteId: f.siteId,
				temp: f.temp,
				ph: f.ph,
				doMg: f.doMg,
				sal: f.salinity,
				sst: null
			}))
		];
		const by = (k: 'temp' | 'ph' | 'doMg' | 'sal', lo: number, hi: number) =>
			nurseries
				.map((id) => ({
					name: siteName(d, id),
					stats: boxOf(
						readings
							.filter((r) => r.siteId === id)
							.map((r) => r[k])
							.filter((v) => v != null && v >= lo && v <= hi)
					)
				}))
				.filter((b) => b.stats && b.stats.n >= 3);
		const tv = d.sets.filter(
			(s) => s.waterTemp != null && s.sst != null && s.waterTemp > 20 && s.waterTemp < 40
		);
		const fit = linearFit(
			pairs(
				tv,
				(s) => s.sst,
				(s) => s.waterTemp
			)
		);
		const hobo = d.hobo
			.filter((h) => h.deployed)
			.map((h) => ({
				label: `${siteName(d, h.siteId)} · ${h.logger}`,
				start: toDay(h.deployed!),
				end: toDay(h.retrieved ?? h.deployed!) + 7,
				tip: `${h.deployed} → ${h.retrieved ?? '?'} · ${h.status ?? ''}`,
				season: h.season
			}));
		const rows = new Map<
			string,
			{ label: string; items: { start: number; end: number; tip: string; color: string }[] }
		>();
		for (const h of hobo) {
			const r = rows.get(h.label) ?? { label: h.label, items: [] };
			r.items.push({
				start: h.start,
				end: Math.max(h.end, h.start + 7),
				tip: h.tip,
				color: 'var(--series-3)'
			});
			rows.set(h.label, r);
		}
		return {
			temp: by('temp', 20, 40),
			ph: by('ph', 7, 9),
			doMg: by('doMg', 1, 15),
			sal: by('sal', 25, 45),
			tempVsSst: tv.map((s) => ({
				x: s.sst!,
				y: s.waterTemp!,
				label: `${siteName(d, s.siteId)} ${s.date}`
			})),
			fit: fit
				? {
						slope: round(fit.slope, 2),
						r2: round(fit.r2, 2),
						n: fit.n,
						diff: round(tv.reduce((a, s) => a + s.waterTemp! - s.sst!, 0) / tv.length, 2)
					}
				: null,
			hobo: [...rows.values()].sort((a, b) => a.label.localeCompare(b.label)),
			nReadings: readings.filter((r) => r.temp != null || r.ph != null || r.sal != null).length
		};
	});
