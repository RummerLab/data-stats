import { memo } from '#lib/server/data';
import { boxOf, effortSets, fieldCaptures, round, seasonDay } from '#lib/server/analytics/common';
import { sunTimes } from '#lib/server/astro';
import { histogram, median } from '#lib/stats';
import {
	fitText,
	groupsText,
	rankText,
	trendText,
	twoGroupText
} from '#lib/server/analytics/tests';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('timeofday', (d) => {
		const caps = fieldCaptures(d);
		const sets = effortSets(d);
		const after = (sp: string) =>
			caps
				.filter((c) => c.species === sp && c.minAfterSunset != null)
				.map((c) => c.minAfterSunset!)
				.filter((v) => v > -150 && v < 330);
		const sinceIn = caps
			.map((c) => c.minAfterNetIn)
			.filter((v): v is number => v != null && v >= 0 && v < 330);

		// Catch rate in 20-minute slices since net-in, using only sets still fishing in that slice.
		const slices = Array.from({ length: 12 }, (_, i) => i * 20);
		const hazard = slices.map((t0) => {
			const fishing = sets.filter((s) => (s.durationMin ?? 0) >= t0 + 20);
			const ids = new Set(fishing.map((s) => s.id));
			const n = caps.filter(
				(c) =>
					c.setId != null &&
					ids.has(c.setId) &&
					c.minAfterNetIn != null &&
					c.minAfterNetIn >= t0 &&
					c.minAfterNetIn < t0 + 20
			).length;
			return {
				t0,
				sets: fishing.length,
				rate: fishing.length ? round(n / (fishing.length / 3), 3) : null
			};
		});

		const firstShark = [...new Set(caps.filter((c) => c.setId != null).map((c) => c.setId!))]
			.map((id) =>
				Math.min(
					...caps
						.filter((c) => c.setId === id && c.minAfterNetIn != null && c.minAfterNetIn >= 0)
						.map((c) => c.minAfterNetIn!)
				)
			)
			.filter((v) => Number.isFinite(v) && v < 330);

		const days = Array.from({ length: 30 }, (_, i) => 30 + i * 7);
		const sunset = days.map((day) => {
			const date = new Date(Date.UTC(2021, 7, 1) + day * 86_400_000).toISOString().slice(0, 10);
			const s = sunTimes(date);
			return { x: day, sunset: s.sunset, dusk: s.civilDusk, nautical: s.nauticalDusk };
		});

		const workupBy = d.seasons.map((season) =>
			caps
				.filter(
					(c) => c.season === season && c.workupMin != null && c.workupMin > 0 && c.workupMin < 90
				)
				.map((c) => c.workupMin)
		);
		const starts = sets
			.filter((s) => s.date && s.startMin != null && s.startMin > 14 * 60)
			.map((s) => [seasonDay(s.date!), s.startMin!] as [number, number]);
		const stats = {
			sunset: twoGroupText(
				after('Na'),
				after('Cm'),
				'sicklefin lemons and blacktips',
				'min after sunset'
			),
			hazard: (() => {
				const r = rankText(
					hazard
						.filter((h) => h.rate != null && h.sets >= 30)
						.map((h) => [h.t0, h.rate!] as [number, number])
				);
				return r ? `Catch rate against minutes since net-in (slices with ≥ 30 sets): ${r}` : null;
			})(),
			starts: (() => {
				const f = fitText(starts, 'min per day');
				return f ? `Net-in time against day of the season: ${f}` : null;
			})(),
			workup: [
				groupsText(workupBy, 'seasons'),
				trendText(
					workupBy.map((w) => median(w)),
					'min'
				)
			]
		};
		return {
			stats,
			edges: Array.from({ length: 25 }, (_, i) => -150 + i * 20),
			afterCm: histogram(after('Cm'), -150, 330, 20).map((b) => b.count),
			afterNa: histogram(after('Na'), -150, 330, 20).map((b) => b.count),
			medCm: median(after('Cm')),
			medNa: median(after('Na')),
			sinceEdges: Array.from({ length: 17 }, (_, i) => i * 15),
			sinceHist: histogram(sinceIn, 0, 240, 15).map((b) => b.count),
			hazard,
			firstEdges: Array.from({ length: 13 }, (_, i) => i * 15),
			firstHist: histogram(firstShark, 0, 180, 15).map((b) => b.count),
			firstMedian: median(firstShark),
			sunset,
			starts: sets
				.filter((s) => s.date && s.startMin != null && s.startMin > 14 * 60)
				.map((s) => ({ x: seasonDay(s.date!), y: s.startMin! })),
			workup: d.seasons.map((season) => ({
				name: season.slice(2, 4) + '–' + season.slice(7),
				stats: boxOf(
					caps
						.filter(
							(c) =>
								c.season === season && c.workupMin != null && c.workupMin > 0 && c.workupMin < 90
						)
						.map((c) => c.workupMin)
				)
			})),
			clockEdges: Array.from({ length: 25 }, (_, i) => 16 * 60 + i * 15),
			clock: histogram(
				caps.map((c) => c.captureMin),
				16 * 60,
				22 * 60,
				15
			).map((b) => b.count)
		};
	});
