import { memo } from '#lib/server/data';
import { siteName } from '#lib/server/analytics/common';
import type { PageServerLoad } from './$types';

const STOP = new Set(
	'the a an and of to in on at for was were is it with from by as but be this that no not or had has have there their they one two net shark sharks caught after before then very also its into out up so we our de la le et des les en du un une est au par sur pas il'.split(
		' '
	)
);

export const load: PageServerLoad = () =>
	memo('notes', (d) => {
		const notes = d.notes
			.map((n) => ({
				season: n.season,
				date: n.date,
				site: siteName(d, n.siteId),
				kind: n.kind,
				species: n.species,
				text: n.text
			}))
			.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
		const words = new Map<string, number>();
		for (const n of notes)
			for (const w of n.text
				.toLowerCase()
				.normalize('NFD')
				.replace(/[̀-ͯ]/g, '')
				.match(/[a-z]{4,}/g) ?? [])
				if (!STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1);
		return {
			notes,
			seasons: d.seasons,
			words: [...words.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 25)
				.map(([w, n]) => ({ w, n }))
		};
	});
