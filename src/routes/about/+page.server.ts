import { dataset } from '#lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const d = dataset();
	return {
		importedAt: d.meta.imported_at ?? null,
		external: d.meta.external ? (JSON.parse(d.meta.external) as Record<string, string | null>) : {}
	};
};
