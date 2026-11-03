/** Species codes used in the logs, with names and their fixed categorical colour slot. */
export const SPECIES = {
	Cm: {
		code: 'Cm',
		common: 'Blacktip reef shark',
		latin: 'Carcharhinus melanopterus',
		color: 'var(--series-1)'
	},
	Na: {
		code: 'Na',
		common: 'Sicklefin lemon shark',
		latin: 'Negaprion acutidens',
		color: 'var(--series-2)'
	},
	Nf: {
		code: 'Nf',
		common: 'Tawny nurse shark',
		latin: 'Nebrius ferrugineus',
		color: 'var(--series-3)'
	},
	Unknown: { code: 'Unknown', common: 'Unknown', latin: '', color: 'var(--muted)' }
} as const;

export type Species = keyof typeof SPECIES;

export const speciesName = (code: string | null | undefined) =>
	(code && SPECIES[code as Species]?.common) || code || 'Unknown';

export const speciesColor = (code: string | null | undefined) =>
	(code && SPECIES[code as Species]?.color) || 'var(--muted)';

/** Categorical slots in validated order (see docs/dev/BRANDING.md). */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
