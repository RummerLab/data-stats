/**
 * Canonical sites and the spellings used for them across 13 seasons of logs (#6, #13).
 *
 * Coordinates: nursery logger GPS sheet first, then the uMap layer linked from the README
 * (https://umap.openstreetmap.fr/en/map/shark-nurseries-on-moorea-island-french-polynesia_295561).
 * Variants such as "Tiki2", "Papetoai (Woody)" or "Vaiane (old site)" are folded into their
 * nursery; review in #13 if a variant should become its own site.
 */
export interface SiteDef {
	id: string;
	name: string;
	code?: string;
	island: 'Moorea' | 'Tetiaroa' | 'Tahiti';
	kind: 'nursery' | 'adult' | 'other' | 'lab';
	/** uMap coordinates (fallback when the GPS sheet has none). */
	lat?: number;
	lon?: number;
	retired?: string;
	/** Regexes tested against the lower-cased, accent-stripped raw name. */
	match: RegExp[];
}

export const SITE_DEFS: SiteDef[] = [
	{
		id: 'apaura',
		name: 'Apaura',
		code: 'Ap',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.57405,
		lon: -149.862889,
		match: [/^apaura/, /^aupara/]
	},
	{
		id: 'haapiti',
		name: 'Haapiti',
		code: 'H',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.5542,
		lon: -149.879481,
		match: [/^ha'?apiti/]
	},
	{
		id: 'hitiaa',
		name: 'Hitiaa',
		code: 'Hi',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.5691,
		lon: -149.793019,
		match: [/^hitiaa/]
	},
	{
		id: 'maharepa',
		name: 'Maharepa',
		code: 'Mah',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.4834,
		lon: -149.813861,
		match: [/^maharepa/, /^camille'?s house/]
	},
	{
		id: 'papetoai',
		name: 'Papetoai',
		code: 'P',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.491061,
		lon: -149.88505,
		match: [/^papet'?o'?ai/, /^papetaoi/]
	},
	{
		id: 'pihaena',
		name: 'Pihaena',
		code: 'Pi',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.486111,
		lon: -149.832461,
		match: [/^pi'?h?a'?h?ena/, /^piaena/, /^piahaena/]
	},
	{
		id: 'paorea',
		name: 'Pointe de Paorea',
		code: 'PdP',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.54455,
		lon: -149.778189,
		match: [/paorea/, /paoera/, /^pdp$/, /^p\.? ?paorea/]
	},
	{
		id: 'tiki',
		name: 'Tiki',
		code: 'T',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.518069,
		lon: -149.912489,
		match: [/^tiki(?!.*outside)/]
	},
	{
		id: 'vaiane',
		name: 'Vaiane',
		code: 'Va',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.578161,
		lon: -149.857131,
		match: [/^vaian(a)?e/]
	},
	{
		id: 'vaiare',
		name: 'Vaiare',
		code: 'V',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.526369,
		lon: -149.775681,
		match: [/^vai?r?are(?! ?marina)/, /^vairare/]
	},
	{
		id: 'valorie',
		name: 'Valorie',
		code: 'Val',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.580961,
		lon: -149.798511,
		match: [/^valorie/]
	},
	{
		id: 'tepee',
		name: 'Tepee',
		code: 'Te',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.49039,
		lon: -149.904842,
		match: [/^tepee/]
	},
	{
		id: 'paroa',
		name: 'Pointe de Paroa',
		code: 'Par',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.593508,
		lon: -149.82326,
		match: [/paroa/]
	},
	{
		id: 'mareto',
		name: 'Mareto (public beach)',
		code: 'PP',
		island: 'Moorea',
		kind: 'nursery',
		lat: -17.492109,
		lon: -149.851155,
		match: [/^mareto/, /^plage publi/]
	},
	// Adult / boat / other survey locations.
	{
		id: 'marina-vaiare',
		name: 'Marina Vaiare',
		island: 'Moorea',
		kind: 'other',
		match: [/^marina vaiare/]
	},
	{
		id: 'taotoi',
		name: 'Taotoi (forereef)',
		island: 'Moorea',
		kind: 'adult',
		match: [/^taotoi/]
	},
	{
		id: 'ray-feeding',
		name: 'Ray feeding site',
		island: 'Moorea',
		kind: 'adult',
		match: [/^ray feeding/]
	},
	{
		id: 'tiahura',
		name: 'Tiahura',
		island: 'Moorea',
		kind: 'adult',
		match: [/^tiahura/, /^tiki .*outside/]
	},
	{ id: 'vaipahu', name: 'Vaipahu', island: 'Moorea', kind: 'adult', match: [/^vaipahu/] },
	{ id: 'hilton', name: 'Hilton', island: 'Moorea', kind: 'adult', match: [/^hilton/] },
	{
		id: 'intercontinental',
		name: 'Intercontinental',
		island: 'Moorea',
		kind: 'other',
		match: [/^intercontinental/]
	},
	{
		id: 'chez-stephan',
		name: 'Chez Stephan',
		island: 'Moorea',
		kind: 'adult',
		match: [/^chez stephan/]
	},
	{ id: 'atiha', name: 'Atiha', island: 'Moorea', kind: 'other', match: [/^atiha/] },
	{ id: 'johnys-place', name: "Johny's place", island: 'Moorea', kind: 'other', match: [/^johny/] },
	{
		id: 'motu',
		name: 'Motu (unspecified)',
		island: 'Moorea',
		kind: 'other',
		match: [/^motu$/, /^entre 2 motus/]
	},
	{ id: 'lagoon', name: 'Lagoon (unspecified)', island: 'Moorea', kind: 'other', match: [/^lagoon$/] },
	{ id: 'lab', name: 'CRIOBE lab', island: 'Moorea', kind: 'lab', match: [/^lab$/] },
	{ id: 'tetiaroa', name: 'Tetiaroa', island: 'Tetiaroa', kind: 'other', match: [/tetiaroa|oroatera|tauini|tavini/] },
	{ id: 'tahiti', name: 'Tahiti', island: 'Tahiti', kind: 'other', match: [/^tahiti$/] }
];

const BY_ID = new Map(SITE_DEFS.map((s) => [s.id, s]));

export function siteDef(id: string): SiteDef | undefined {
	return BY_ID.get(id);
}

function key(raw: string): string {
	return raw
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[’`]/g, "'")
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** Resolve a raw site spelling to a canonical site id, or null when unknown. */
export function resolveSite(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const k = key(raw);
	if (!k || /^\d+$/.test(k)) return null;
	for (const def of SITE_DEFS) if (def.match.some((re) => re.test(k))) return def.id;
	return null;
}
