import { memo } from '#lib/server/data';
import {
	cpueOf,
	effortSets,
	fieldCaptures,
	firstPerSeason,
	fulton,
	isNeonate,
	round
} from '#lib/server/analytics/common';
import { linearFit, mean, pairs } from '#lib/stats';
import { trendText } from '#lib/server/analytics/tests';
import type { PageServerLoad } from './$types';

const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Weekly means of daily values (keeps payloads small for 13-year series). */
function weekly<T extends { date: string }>(rows: T[], get: (r: T) => number | null) {
	const m = new Map<number, number[]>();
	for (const r of rows) {
		const v = get(r);
		if (v == null) continue;
		const w = Math.floor(toDay(r.date) / 7);
		const l = m.get(w) ?? [];
		l.push(v);
		m.set(w, l);
	}
	return [...m.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([w, v]) => ({ x: w * 7 + 3, y: round(mean(v), 2) }));
}

export const load: PageServerLoad = () =>
	memo('ocean', (d) => {
		const o = d.ocean;
		const caps = firstPerSeason(fieldCaptures(d));
		const eff = effortSets(d);
		const bands = d.seasons.map((s) => ({
			x0: toDay(`${s.slice(0, 4)}-09-01`),
			x1: toDay(`${s.slice(5)}-02-28`)
		}));

		const seasonRows = d.seasons.map((season) => {
			const y = Number(season.slice(0, 4));
			const sets = d.sets.filter((s) => s.season === season);
			const preSummer = o.filter((r) => r.date >= `${y}-01-01` && r.date <= `${y}-06-30`);
			const neo = caps.filter((c) => c.season === season && c.species === 'Cm' && isNeonate(c));
			return {
				season,
				sst: round(mean(sets.map((s) => s.sst)), 2),
				oni: round(mean(sets.map((s) => s.oni)), 2),
				maxDhwBefore: round(Math.max(0, ...preSummer.map((r) => r.crwDhw ?? 0)), 1),
				cpue: round(cpueOf(eff.filter((s) => s.season === season))),
				k: round(mean(neo.map(fulton)), 3),
				tl: round(mean(neo.map((c) => c.tlMm)), 0),
				n: neo.length
			};
		});
		const fit = (
			fx: (r: (typeof seasonRows)[number]) => number | null,
			fy: (r: (typeof seasonRows)[number]) => number | null
		) => {
			const f = linearFit(pairs(seasonRows, fx, fy));
			return f ? { r2: round(f.r2, 2), p: f.p, n: f.n, slope: f.slope } : null;
		};

		const months = Array.from({ length: 12 }, (_, i) => i + 1);
		const clim = months.map((m) =>
			round(
				mean(o.filter((r) => Number(r.date.slice(5, 7)) === m).map((r) => r.oisst ?? r.crwSst)),
				2
			)
		);
		const events = o.filter((r) => (r.crwDhw ?? 0) >= 4);
		const peak = o.reduce<(typeof o)[number] | null>(
			(a, r) => ((r.crwDhw ?? 0) > (a?.crwDhw ?? -1) ? r : a),
			null
		);

		// Warming: one mean anomaly per complete calendar year, so weekly autocorrelation can't
		// inflate the test.
		const years = [...new Set(o.map((r) => r.date.slice(0, 4)))].sort();
		const annual = years
			.map((y) => o.filter((r) => r.date.startsWith(y) && r.crwAnom != null))
			.map((rs) => (rs.length >= 300 ? mean(rs.map((r) => r.crwAnom)) : null));
		const anomStats = trendText(annual, '°C', 'year');
		return {
			anomStats,
			bands,
			sst: weekly(o, (r) => r.oisst ?? r.crwSst),
			anom: weekly(o, (r) => r.crwAnom),
			dhw: o
				.filter((r) => r.crwDhw != null)
				.filter((_, i) => i % 3 === 0)
				.map((r) => ({ x: toDay(r.date), y: r.crwDhw })),
			waves: weekly(o, (r) => r.waveMax),
			swell: weekly(o, (r) => r.swellMax),
			oni: d.climate
				.filter((c) => c.oni != null)
				.map((c) => ({ x: toDay(`${c.ym}-15`), y: c.oni })),
			soi: d.climate
				.filter((c) => c.soi != null)
				.map((c) => ({ x: toDay(`${c.ym}-15`), y: c.soi })),
			clim,
			seasonRows,
			fitSstCpue: fit(
				(r) => r.sst,
				(r) => r.cpue
			),
			fitOniCpue: fit(
				(r) => r.oni,
				(r) => r.cpue
			),
			fitDhwK: fit(
				(r) => r.maxDhwBefore,
				(r) => r.k
			),
			dhwDays: events.length,
			peak: peak ? { date: peak.date, dhw: peak.crwDhw } : null,
			lastDate: o.length ? o[o.length - 1].date : null
		};
	});
