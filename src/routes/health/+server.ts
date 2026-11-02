import { json } from '@sveltejs/kit';
import { dataset } from '#lib/server/data';
import type { RequestHandler } from './$types';

/** Liveness + data summary for Docker healthchecks and monitoring. */
export const GET: RequestHandler = () => {
	try {
		const d = dataset();
		return json({
			ok: true,
			importedAt: d.meta.imported_at ?? null,
			captures: d.captures.length,
			sets: d.sets.length
		});
	} catch (err) {
		return json({ ok: false, error: (err as Error).message }, { status: 503 });
	}
};
