import { dataset } from '#lib/server/data';
import type { LayoutServerLoad } from './$types';

/** Hostnames that load GA4 (Physioshark stream G-VZF5DR37YH). */
const GA_HOSTS = new Set(['data.physioshark.org', 'physioshark.org']);

export const load: LayoutServerLoad = ({ url }) => {
	const d = dataset();
	return {
		importedAt: d.meta.imported_at ?? null,
		hasData: d.captures.length > 0,
		seasonRange: d.seasons.length ? [d.seasons[0], d.seasons[d.seasons.length - 1]] : null,
		external: d.meta.external ? (JSON.parse(d.meta.external) as Record<string, string | null>) : {},
		version: d.meta.importer_version ?? '',
		ga: GA_HOSTS.has(url.hostname)
	};
};
