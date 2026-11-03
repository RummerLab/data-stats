import { memo } from '#lib/server/data';
import { siteName } from '#lib/server/analytics/common';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('sharks', (d) => {
		const rows = d.individuals
			.filter((i) => i.species !== 'Unknown')
			// Only what the table shows: every byte here is sent for ~2,500 sharks (#76).
			.map((i) => ({
				id: i.id,
				species: i.species,
				sex: i.sex,
				n: i.nCaptures,
				seasons: i.nSeasons,
				first: i.firstDate,
				last: i.lastDate,
				sites: (JSON.parse(i.sites ?? '[]') as string[]).map((s) => siteName(d, s)).join(' → '),
				tl0: i.firstTlMm,
				tl1: i.lastTlMm
			}))
			.sort((a, b) => b.n - a.n || (b.last ?? '').localeCompare(a.last ?? ''));
		return { rows };
	});
