import { memo } from '#lib/server/data';
import { activeNurseries, boxOf, round, siteName } from '#lib/server/analytics/common';
import {
	coverage,
	dailyMaxBySite,
	dielBySeason,
	summary,
	versusSst,
	withGaps
} from '#lib/server/analytics/insitu';
import { cloudWater } from '#lib/server/analytics/cloud';
import { linearFit, mean, pairs } from '#lib/stats';
import { groupsText } from '#lib/server/analytics/tests';
import type { PageServerLoad } from './$types';

const dayNum = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

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
		const nurseryTest = (k: 'temp' | 'ph' | 'doMg' | 'sal', lo: number, hi: number) =>
			groupsText(
				nurseries.map((id) =>
					readings
						.filter((r) => r.siteId === id)
						.map((r) => r[k])
						.filter((v) => v != null && v >= lo && v <= hi)
				),
				'nurseries'
			);
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
		// In-situ loggers (#10): island-wide monthly means against offshore SST on the same days.
		const vs = versusSst(d);
		const months = new Map<string, { logger: number[]; sst: number[] }>();
		for (const p of vs.pairs) {
			const m = months.get(p.date.slice(0, 7)) ?? { logger: [], sst: [] };
			m.logger.push(p.logger);
			m.sst.push(p.sst);
			months.set(p.date.slice(0, 7), m);
		}
		const monthRows = [...months]
			.filter(([, m]) => m.logger.length >= 10)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([ym, m]) => ({
				x: dayNum(`${ym}-15`),
				logger: round(mean(m.logger)),
				sst: round(mean(m.sst))
			}));
		const sum = summary(d);
		const diel = dielBySeason(d);
		const amp = (c: { x: number; y: number | null }[]) => {
			const ps = c.filter((p): p is { x: number; y: number } => p.y != null);
			if (!ps.length) return null;
			const lo = ps.reduce((a, b) => (b.y < a.y ? b : a));
			const hi = ps.reduce((a, b) => (b.y > a.y ? b : a));
			return { range: round(hi.y - lo.y, 1)!, coolest: lo.x, warmest: hi.x };
		};
		const insitu = sum
			? {
					summary: sum,
					monthly: {
						logger: withGaps(monthRows.map((r) => ({ x: r.x, y: r.logger }))),
						sst: withGaps(monthRows.map((r) => ({ x: r.x, y: r.sst })))
					},
					diff: vs.diff,
					nPairs: vs.pairs.length,
					diel,
					dielAmp: { warm: amp(diel.warm), cool: amp(diel.cool) },
					dailyMax: dailyMaxBySite(d),
					cloud: cloudWater(d),
					coverage: coverage(d)
				}
			: null;

		return {
			insitu,
			temp: by('temp', 20, 40),
			ph: by('ph', 7, 9),
			doMg: by('doMg', 1, 15),
			sal: by('sal', 25, 45),
			stats: {
				temp: nurseryTest('temp', 20, 40),
				ph: nurseryTest('ph', 7, 9),
				doMg: nurseryTest('doMg', 1, 15),
				sal: nurseryTest('sal', 25, 45)
			},
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
