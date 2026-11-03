import { building, version } from '$app/env';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { refresh } from '#lib/server/db';

// Build (or validate) the derived database before the first request.
export const init: ServerInit = () => {
	if (building) return;
	try {
		refresh(true);
	} catch (err) {
		console.error('[import] initial import failed:', err);
	}
};

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const COMPRESSIBLE = /^(text\/|application\/json)/;

/**
 * Compress rendered pages and data (#76): adapter-node only precompresses static assets, and a
 * scatter-heavy page is several hundred KB of HTML that shrinks about tenfold.
 */
async function compress(req: Request, res: Response): Promise<Response> {
	const accept = req.headers.get('accept-encoding') ?? '';
	const enc = /\bbr\b/.test(accept) ? 'br' : /\bgzip\b/.test(accept) ? 'gzip' : null;
	const type = res.headers.get('content-type') ?? '';
	if (!enc || !res.body || res.headers.has('content-encoding') || !COMPRESSIBLE.test(type))
		return res;
	const raw = Buffer.from(await res.arrayBuffer());
	const body =
		enc === 'br'
			? brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
			: gzipSync(raw, { level: 6 });
	const headers = new Headers(res.headers);
	headers.set('content-encoding', enc);
	headers.set('content-length', String(body.length));
	headers.append('vary', 'Accept-Encoding');
	return new Response(body, { status: res.status, statusText: res.statusText, headers });
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	// At most once a minute: re-import if a spreadsheet was added or changed (#8).
	let hash: string | null = null;
	if (!building && pathname !== '/health') {
		try {
			hash = refresh().hash;
		} catch (err) {
			console.error('[import] refresh failed:', err);
		}
	}
	// Pages are a function of the build and the imported data only, so one validator covers
	// both (#76): a browser revalidating an unchanged page gets a 304 without a render.
	const etag =
		hash && event.request.method === 'GET' ? `W/"${version}-${hash.slice(0, 16)}"` : null;
	if (etag && event.request.headers.get('if-none-match') === etag)
		return new Response(null, { status: 304, headers: { etag, 'cache-control': 'no-cache' } });
	let res = await resolve(event);
	if (etag && res.status === 200 && !res.headers.has('cache-control')) {
		res.headers.set('etag', etag);
		res.headers.set('cache-control', 'no-cache');
	}
	if (event.request.method !== 'HEAD') res = await compress(event.request, res);
	for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
	return res;
};
