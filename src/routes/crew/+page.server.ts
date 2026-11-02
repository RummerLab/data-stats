import { memo } from '#lib/server/data';
import { cpueOf, effortSets, round } from '#lib/server/analytics/common';
import type { PageServerLoad } from './$types';

const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

export const load: PageServerLoad = () =>
	memo('crew', (d) => {
		const eff = new Set(effortSets(d).map((s) => s.id));
		const byPerson = new Map<string, number[]>();
		for (const c of d.crew) {
			const l = byPerson.get(c.person);
			if (l) l.push(c.setId);
			else byPerson.set(c.person, [c.setId]);
		}
		const overall = cpueOf(effortSets(d));
		const people = [...byPerson.entries()]
			.map(([person, ids]) => {
				const sets = ids.map((id) => d.setById.get(id)!).filter(Boolean);
				const timed = sets.filter((s) => eff.has(s.id));
				const seasons = [...new Set(sets.map((s) => s.season))].sort();
				const dates = sets
					.map((s) => s.date)
					.filter(Boolean)
					.sort() as string[];
				return {
					person,
					sets: sets.length,
					hours: round(
						timed.reduce((a, s) => a + (s.durationMin ?? 0) / 60, 0),
						0
					),
					sharks: sets.reduce((a, s) => a + (s.nTotal ?? 0), 0),
					cpue: timed.length >= 10 ? round(cpueOf(timed)) : null,
					seasons: seasons.length,
					seasonList: seasons,
					first: dates[0] ?? null,
					last: dates[dates.length - 1] ?? null,
					sites: new Set(sets.map((s) => s.siteId)).size
				};
			})
			.sort((a, b) => b.sets - a.sets);

		const pairs = new Map<string, number>();
		const crewOf = new Map<number, string[]>();
		for (const c of d.crew) crewOf.set(c.setId, [...(crewOf.get(c.setId) ?? []), c.person]);
		for (const names of crewOf.values()) {
			const s = [...names].sort();
			for (let i = 0; i < s.length; i++)
				for (let j = i + 1; j < s.length; j++)
					pairs.set(`${s[i]} & ${s[j]}`, (pairs.get(`${s[i]} & ${s[j]}`) ?? 0) + 1);
		}
		const sizes = [1, 2, 3, 4, 5, 6].map((k) => ({
			k: k === 6 ? '6+' : String(k),
			n: d.sets.filter((s) => (k === 6 ? (s.crewSize ?? 0) >= 6 : s.crewSize === k)).length
		}));

		return {
			total: people.length,
			overall: round(overall),
			top: people.slice(0, 30),
			lucky: people
				.filter((p) => p.cpue != null && p.sets >= 25)
				.sort((a, b) => (b.cpue ?? 0) - (a.cpue ?? 0)),
			pairs: [...pairs.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 15)
				.map(([pair, n]) => ({ pair, n })),
			sizes,
			oneTimers: people.filter((p) => p.sets === 1).length,
			timeline: people.slice(0, 25).map((p) => ({
				label: p.person,
				items: p.seasonList.map((season) => {
					const ds = d.crew
						.filter((c) => c.person === p.person)
						.map((c) => d.setById.get(c.setId))
						.filter((s) => s?.season === season && s.date)
						.map((s) => s!.date!)
						.sort();
					return {
						start: toDay(ds[0]),
						end: toDay(ds[ds.length - 1]) + 3,
						tip: `${season}: ${ds.length} sets`
					};
				})
			})),
			all: people.map(({ seasonList: _s, ...p }) => p)
		};
	});
