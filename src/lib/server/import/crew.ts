/**
 * Crew / team strings → people (#14). Spellings below are folded together; anything listed in
 * GROUPS is an organisation or a group rather than a person and is left out of leaderboards.
 * These are best guesses from the logs: correct them here (and in #14) if two names are
 * different people or one person is split.
 */
const ALIASES: Record<string, string> = {
	tuiterai: 'Tui',
	shubba: 'Shuba',
	guillame: 'Guillaume',
	godrum: 'Gudrun',
	isabelle: 'Isabel',
	isabella: 'Isabel',
	jose: 'José',
	aure: 'Aurélie',
	aurelie: 'Aurélie',
	'carl meyer': 'Carl Meyer',
	lauric: 'Lauric',
	loric: 'Lauric'
};

const GROUPS = new Set(['everyone', 'upf', 'criobe', 'family', 'kid', 'b', 'nao (no crew)']);

function titleCase(s: string) {
	return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Split a crew cell into normalised person names (deduplicated, order kept). */
export function parseCrew(raw: string | null): string[] {
	if (!raw) return [];
	const out: string[] = [];
	for (let part of raw.split(/[,;&+/\n]|\s+and\s+|\s+et\s+/i)) {
		part = part.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
		if (!part) continue;
		const lower = part
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
		if (GROUPS.has(lower)) continue;
		let name = ALIASES[lower];
		if (!name) {
			// "TUI" / "CATHY" → "Tui" / "Cathy"; keep short initialisms like "MGX".
			const allCaps = part === part.toUpperCase() && /\p{L}/u.test(part);
			name = allCaps && (part.length > 3 || part === 'TUI') ? titleCase(part) : part;
			if (part === part.toLowerCase()) name = titleCase(part);
		}
		if (!out.includes(name)) out.push(name);
	}
	return out;
}
