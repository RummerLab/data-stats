import { memo, tideExtrema, tideHourlyAll } from '#lib/server/data';
import { binnedMean, cpueOf, effortSets, fieldCaptures, round } from '#lib/server/analytics/common';
import { countBy, histogram, mean } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('tides', (d) => {
		const hourly = tideHourlyAll();
		const overall = mean(hourly.map((h) => h.mm)) ?? 0;
		const grid = Array.from({ length: 12 }, () => Array.from({ length: 24 }, () => [] as number[]));
		for (const h of hourly)
			grid[Number(h.ts.slice(5, 7)) - 1][Number(h.ts.slice(11, 13))].push(h.mm - overall);
		const heat = grid.map((row) => row.map((v) => round(mean(v), 0)));
		const daily = Array.from({ length: 24 }, (_, hr) =>
			round(mean(grid.flatMap((row) => row[hr])), 1)
		);

		const ext = tideExtrema();
		const highs = ext
			.filter((e) => e.kind === 'H')
			.map((e) => Number(e.ts.slice(11, 13)) + Number(e.ts.slice(14, 16)) / 60);
		const lows = ext
			.filter((e) => e.kind === 'L')
			.map((e) => Number(e.ts.slice(11, 13)) + Number(e.ts.slice(14, 16)) / 60);
		const range = mean(
			[...new Set(ext.map((e) => e.ts.slice(0, 10)))].map((day) => {
				const es = ext.filter((e) => e.ts.startsWith(day)).map((e) => e.mm);
				return es.length >= 2 ? Math.max(...es) - Math.min(...es) : null;
			})
		);

		// An example fortnight: the most recent full November.
		const lastYear = hourly.length ? Number(hourly[hourly.length - 1].ts.slice(0, 4)) : 2025;
		const exYear = hourly.some((h) => h.ts.startsWith(`${lastYear}-11-28`))
			? lastYear
			: lastYear - 1;
		const example = hourly
			.filter((h) => h.ts >= `${exYear}-11-01` && h.ts < `${exYear}-11-15`)
			.map((h) => ({ x: Date.parse(`${h.ts}:00:00Z`) / 86_400_000, y: h.mm - overall }));

		const caps = fieldCaptures(d).filter((c) => c.tideMm != null);
		const sets = effortSets(d);
		const trendCounts = (sp: string) => {
			const m = countBy(
				caps.filter((c) => c.species === sp),
				(c) => c.tideTrend
			);
			return ['rising', 'slack', 'falling'].map((k) => m.get(k) ?? 0);
		};
		// Availability: share of evening hours (17–21 h) the tide is rising/slack/falling.
		const evening = hourly.filter((h) => {
			const hr = Number(h.ts.slice(11, 13));
			return hr >= 17 && hr <= 21;
		});
		const byTs = new Map(hourly.map((h) => [h.ts, h.mm]));
		const avail = { rising: 0, slack: 0, falling: 0 };
		for (const h of evening) {
			const t = Date.parse(`${h.ts}:00:00Z`);
			const next = byTs.get(new Date(t + 3_600_000).toISOString().slice(0, 13));
			if (next == null) continue;
			avail[next > h.mm + 2 ? 'rising' : next < h.mm - 2 ? 'falling' : 'slack']++;
		}
		const totalAvail = avail.rising + avail.slack + avail.falling || 1;

		return {
			heat,
			daily,
			highsEdges: Array.from({ length: 25 }, (_, i) => i),
			highsHist: histogram(highs, 0, 24, 1).map((b) => b.count),
			lowsHist: histogram(lows, 0, 24, 1).map((b) => b.count),
			range: round(range, 0),
			example,
			exYear,
			trendCm: trendCounts('Cm'),
			trendNa: trendCounts('Na'),
			avail: [avail.rising / totalAvail, avail.slack / totalAvail, avail.falling / totalAvail],
			capTide: histogram(
				caps.map((c) => c.tideMm! - overall),
				-300,
				300,
				25
			).map((b) => b.count),
			capEdges: Array.from({ length: 25 }, (_, i) => -300 + i * 25),
			cpueTrend: ['rising', 'slack', 'falling'].map((k) => ({
				k,
				cpue: round(cpueOf(sets.filter((s) => s.tideTrend === k))),
				n: sets.filter((s) => s.tideTrend === k).length
			})),
			cpueHeight: binnedMean(
				sets,
				(s) => (s.tideMidMm == null ? null : s.tideMidMm - overall),
				(s) => s.cpue,
				[-400, -150, -75, 0, 75, 150, 400],
				(a, b) => `${round(a, 0)}–${round(b, 0)}`
			),
			fieldTide: ['low', 'high', 'incoming', 'outgoing', 'flooding', 'ebbing']
				.map((k) => {
					const ss = sets.filter(
						(s) => s.tideRaw && new RegExp(`^${k}`, 'i').test(s.tideRaw.trim())
					);
					return { k, n: ss.length, cpue: round(cpueOf(ss)) };
				})
				.filter((x) => x.n >= 10)
		};
	});
