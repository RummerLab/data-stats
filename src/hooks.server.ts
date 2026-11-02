import { building } from '$app/env';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
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

export const handle: Handle = async ({ event, resolve }) => {
	// At most once a minute: re-import if a spreadsheet was added or changed (#8).
	if (!building && event.url.pathname !== '/health') {
		try {
			refresh();
		} catch (err) {
			console.error('[import] refresh failed:', err);
		}
	}
	const res = await resolve(event);
	for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
	return res;
};
