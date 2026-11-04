import { NAV } from '#lib/nav';
import { activeNurseries } from '#lib/server/analytics/common';
import { dataset } from '#lib/server/data';
import type { RequestHandler } from './$types';

const DEFAULT_ORIGIN = 'https://data.physioshark.org';

/** Prefer the public site URL so reverse-proxy localhost origins never leak into the sitemap. */
function siteOrigin(url: URL): string {
	for (const raw of [process.env.PUBLIC_SITE_URL, process.env.ORIGIN]) {
		if (!raw) continue;
		try {
			return new URL(raw).origin;
		} catch {
			/* ignore invalid */
		}
	}
	if (url.hostname === 'data.physioshark.org' || url.hostname === 'physioshark.org') {
		return url.origin;
	}
	return DEFAULT_ORIGIN;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export const GET: RequestHandler = ({ url }) => {
	const origin = siteOrigin(url);
	const d = dataset();
	const lastmod = d.meta.imported_at?.slice(0, 10) || undefined;

	const paths = new Set<string>(NAV.flatMap((g) => g.items.map((i) => i.href)));
	for (const season of d.seasons) paths.add(`/seasons/${encodeURIComponent(season)}`);
	for (const id of activeNurseries(d)) paths.add(`/nurseries/${encodeURIComponent(id)}`);

	const urls = [...paths]
		.sort((a, b) => a.localeCompare(b))
		.map((path) => {
			const loc = `${origin}${path === '/' ? '/' : path}`;
			const last = lastmod ? `\n\t\t<lastmod>${lastmod}</lastmod>` : '';
			return `\t<url>\n\t\t<loc>${escapeXml(loc)}</loc>${last}\n\t</url>`;
		})
		.join('\n');

	const body =
		`<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
