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
import { mean } from '#lib/stats';
import { groupsText, tableText, trendText } from '#lib/server/analytics/tests';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('seasons', (d) => {
		const caps = fieldCaptures(d);
		const eff = effortSets(d);
		const rows = d.seasons.map((season) => {
			const sc = caps.filter((c) => c.season === season);
			const first = firstPerSeason(sc);
			const sets = d.sets.filter((s) => s.season === season && s.gear === 'Gillnet');
			const ss = eff.filter((s) => s.season === season);
			const people = new Set(
				d.crew.filter((c) => d.setById.get(c.setId)?.season === season).map((c) => c.person)
			);
			const dates = sets
				.map((s) => s.date)
				.filter(Boolean)
				.sort() as string[];
			return {
				season,
				href: `/seasons/${season}`,
				start: dates[0] ?? null,
				end: dates[dates.length - 1] ?? null,
				sets: sets.length,
				hours: round(
					ss.reduce((a, s) => a + (s.durationMin ?? 0) / 60, 0),
					0
				),
				captures: sc.length,
				cm: sc.filter((c) => c.species === 'Cm').length,
				na: sc.filter((c) => c.species === 'Na').length,
				individuals: new Set(sc.map((c) => c.individualId)).size,
				cpue: round(cpueOf(ss)),
				zero: ss.length ? round(ss.filter((s) => !s.nTotal).length / ss.length, 3) : null,
				neonatePct: first.length ? round(first.filter(isNeonate).length / first.length, 3) : null,
				tlCm: round(mean(first.filter((c) => c.species === 'Cm').map((c) => c.tlMm)), 0),
				kCm: round(mean(first.filter((c) => c.species === 'Cm').map(fulton)), 3),
				sst: round(mean(sets.map((s) => s.sst)), 2),
				oni: round(mean(sets.map((s) => s.oni)), 2),
				crew: people.size
			};
		});
		const firstBy = d.seasons.map((season) =>
			firstPerSeason(caps.filter((c) => c.season === season))
		);
		const effBy = d.seasons.map((season) => eff.filter((s) => s.season === season));
		const stats = {
			zero: [
				tableText(
					effBy.map((ss) => [
						ss.filter((s) => !s.nTotal).length,
						ss.filter((s) => s.nTotal).length
					]),
					'seasons'
				),
				trendText(rows.map((r) => r.zero))
			],
			neonates: [
				tableText(
					firstBy.map((f) => [f.filter(isNeonate).length, f.filter((c) => !isNeonate(c)).length]),
					'seasons'
				),
				trendText(rows.map((r) => r.neonatePct))
			],
			tlCm: [
				groupsText(
					firstBy.map((f) => f.filter((c) => c.species === 'Cm').map((c) => c.tlMm)),
					'seasons'
				),
				trendText(
					rows.map((r) => r.tlCm),
					'mm'
				)
			],
			sst: trendText(
				rows.map((r) => r.sst),
				'°C'
			),
			crew: trendText(
				rows.map((r) => r.crew),
				'people'
			)
		};
		return { rows, stats };
	});
