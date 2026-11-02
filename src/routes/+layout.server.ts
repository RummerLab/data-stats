import { dataset } from '#lib/server/data';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const d = dataset();
	return {
		importedAt: d.meta.imported_at ?? null,
		hasData: d.captures.length > 0,
		seasonRange: d.seasons.length ? [d.seasons[0], d.seasons[d.seasons.length - 1]] : null,
		external: d.meta.external ? (JSON.parse(d.meta.external) as Record<string, string | null>) : {},
		version: d.meta.importer_version ?? ''
	};
};
