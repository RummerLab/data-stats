import { memo } from '#lib/server/data';
import {
	activeNurseries,
	cpueOf,
	effortSets,
	fieldCaptures,
	firstPerSeason,
	fulton,
	isNeonate,
	round
} from '#lib/server/analytics/common';
import { mean } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('nurseries', (d) => {
		const caps = fieldCaptures(d);
		const eff = effortSets(d);
		const ids = activeNurseries(d);
		const rows = ids.map((id) => {
			const s = d.siteById.get(id)!;
			const sc = caps.filter((c) => c.siteId === id);
			const first = firstPerSeason(sc);
			const ss = eff.filter((x) => x.siteId === id);
			const ind = new Set(sc.map((c) => c.individualId));
			const recapInd = new Set(sc.filter((c) => (c.captureNo ?? 1) > 1).map((c) => c.individualId));
			return {
				id,
				name: s.name,
				href: `/nurseries/${id}`,
				lat: s.lat,
				lon: s.lon,
				retired: s.retired,
				sets: d.sets.filter((x) => x.siteId === id && x.gear === 'Gillnet').length,
				captures: sc.length,
				cm: sc.filter((c) => c.species === 'Cm').length,
				na: sc.filter((c) => c.species === 'Na').length,
				cpue: round(cpueOf(ss)),
				cpueCm: round(cpueOf(ss, 'cpueCm')),
				cpueNa: round(cpueOf(ss, 'cpueNa')),
				zero: ss.length ? round(ss.filter((x) => !x.nTotal).length / ss.length, 3) : null,
				newborn: first.length ? round(first.filter(isNeonate).length / first.length, 3) : null,
				tlCm: round(mean(first.filter((c) => c.species === 'Cm').map((c) => c.tlMm)), 0),
				kCm: round(mean(first.filter((c) => c.species === 'Cm' && isNeonate(c)).map(fulton)), 3),
				recapRate: ind.size ? round(recapInd.size / ind.size, 3) : null,
				tier: s.pressureTier,
				seasons: new Set(sc.map((c) => c.season)).size
			};
		});
		const heat = ids.map((id) =>
			d.seasons.map((season) =>
				round(cpueOf(eff.filter((s) => s.siteId === id && s.season === season)))
			)
		);
		return { rows, seasons: d.seasons, heat };
	});
