import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const WEATHER_CHUNK_DELAY_MS = 10_000;

/** HTTP retries include body reads; injected I/O keeps outage tests fast and offline. */
export function createGet({
	fetch: request = globalThis.fetch,
	wait = sleep,
	now = Date.now
} = {}) {
	return async function get(url, { json = false, tries = 5, retry404 = false } = {}) {
		let error;
		for (let i = 0; i < tries; i++) {
			let delay = 2000 * (i + 1) ** 2;
			try {
				const res = await request(url, {
					signal: AbortSignal.timeout(120_000),
					headers: {
						'user-agent': 'physioshark-data-stats (+https://github.com/RummerLab/data-stats)'
					}
				});
				if (res.ok) return await (json ? res.json() : res.text());
				error = new Error(`${res.status} ${url}`);
				error.status = res.status;
				if (res.status === 429) {
					const value = res.headers.get('retry-after');
					const retryAfter =
						value == null
							? 0
							: /^\d+(\.\d+)?$/.test(value.trim())
								? Number(value) * 1000
								: Date.parse(value) - now();
					delay = Math.max(60_000 * (i + 1), Number.isFinite(retryAfter) ? retryAfter : 0);
				}
				await res.body?.cancel();
				if (res.status === 404 && !retry404) throw error;
			} catch (err) {
				error = err;
				if (err.status === 404 && !retry404) throw err;
			}
			if (i + 1 < tries) {
				console.warn(`[external] ${error.message}; retrying in ${delay / 1000}s`);
				await wait(delay);
			}
		}
		throw error;
	};
}

/** Fetch into staging so a failed source never publishes its partially written files. */
export async function refreshJobs(out, jobs, { report = console.log } = {}) {
	const failed = [];
	for (const [name, job] of Object.entries(jobs)) {
		// Keep staging outside external/: interrupted runs must never git-add partial files.
		const stage = mkdtempSync(join(dirname(out), '.external-refresh-'));
		const files = new Set();
		try {
			await job((file, body) => {
				writeFileSync(join(stage, file), body);
				files.add(file);
			});
			for (const file of files) renameSync(join(stage, file), join(out, file));
			report(`[external] ${name}: refreshed (${files.size} files)`);
		} catch (err) {
			failed.push(name);
			report(`[external] ${name}: FAILED — ${err.message ?? err}`);
		} finally {
			rmSync(stage, { recursive: true, force: true });
		}
	}
	return failed;
}
