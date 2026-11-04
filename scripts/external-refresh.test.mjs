import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createGet, refreshJobs } from './external-refresh.mjs';

for (const [header, expected] of [
	[null, 60_000],
	['5', 60_000],
	['120', 120_000],
	['Wed, 04 Nov 2026 00:02:00 GMT', 120_000],
	['invalid', 60_000]
]) {
	test(`429 recovers after Retry-After ${header}`, async () => {
		const waits = [];
		let calls = 0;
		const get = createGet({
			now: () => Date.parse('2026-11-04T00:00:00Z'),
			wait: async (ms) => waits.push(ms),
			fetch: async () =>
				calls++ === 0
					? new Response('', { status: 429, headers: header ? { 'Retry-After': header } : {} })
					: Response.json({ daily: { time: ['2026-11-01'] } })
		});
		assert.deepEqual(await get('https://example.test/weather', { json: true }), {
			daily: { time: ['2026-11-01'] }
		});
		assert.deepEqual(waits, [expected]);
		assert.equal(calls, 2);
	});
}

test('persistent 429 has bounded attempts and increasing backoff', async () => {
	const waits = [];
	let calls = 0;
	const get = createGet({
		wait: async (ms) => waits.push(ms),
		fetch: async () => {
			calls++;
			return new Response('', { status: 429 });
		}
	});
	await assert.rejects(get('https://example.test/weather', { tries: 3 }), { status: 429 });
	assert.equal(calls, 3);
	assert.deepEqual(waits, [60_000, 120_000]);
});

test('historical 404 retries, final 404 remains immediate', async () => {
	let calls = 0;
	const get = createGet({
		wait: async () => {},
		fetch: async () => (++calls % 2 ? new Response('', { status: 404 }) : new Response('recovered'))
	});
	assert.equal(await get('https://example.test/history', { retry404: true }), 'recovered');
	assert.equal(calls, 2);
	await assert.rejects(get('https://example.test/final'), { status: 404 });
	assert.equal(calls, 3);
});

test('failed response body reads retry within the attempt limit', async () => {
	let calls = 0;
	const get = createGet({
		wait: async () => {},
		fetch: async () =>
			++calls === 1
				? {
						ok: true,
						text: async () => {
							throw new Error('body timeout');
						}
					}
				: new Response('complete')
	});
	assert.equal(await get('https://example.test/body'), 'complete');
	assert.equal(calls, 2);
});

test('failed source retains all old files while other sources publish and report', async () => {
	const out = mkdtempSync(join(tmpdir(), 'external-refresh-'));
	const reports = [];
	try {
		writeFileSync(join(out, 'weather-daily.csv'), 'old daily');
		writeFileSync(join(out, 'weather-hourly.csv.gz'), 'old hourly');
		writeFileSync(join(out, 'climate.csv'), 'old climate');
		const failed = await refreshJobs(
			out,
			{
				weather: async (write) => {
					write('weather-daily.csv', 'new daily');
					write('weather-hourly.csv.gz', 'new hourly');
					throw new Error('source down');
				},
				climate: async (write) => write('climate.csv', 'new climate'),
				tide: async (write) => write('tide.csv', 'new tide')
			},
			{ report: (line) => reports.push(line) }
		);
		assert.deepEqual(failed, ['weather']);
		assert.equal(readFileSync(join(out, 'weather-daily.csv'), 'utf8'), 'old daily');
		assert.equal(readFileSync(join(out, 'weather-hourly.csv.gz'), 'utf8'), 'old hourly');
		assert.equal(readFileSync(join(out, 'climate.csv'), 'utf8'), 'new climate');
		assert.equal(readFileSync(join(out, 'tide.csv'), 'utf8'), 'new tide');
		assert.ok(reports.some((line) => line.includes('weather: FAILED')));
		assert.deepEqual(readdirSync(out).sort(), [
			'climate.csv',
			'tide.csv',
			'weather-daily.csv',
			'weather-hourly.csv.gz'
		]);
	} finally {
		rmSync(out, { recursive: true, force: true });
	}
});

test('CLI reports a failed weather source and publishes tide data with a failing exit status', async () => {
	const { spawnSync } = await import('node:child_process');
	const { gunzipSync } = await import('node:zlib');
	const out = mkdtempSync(join(tmpdir(), 'external-cli-'));
	try {
		writeFileSync(join(out, 'weather-daily.csv'), 'old weather');
		const mock = `globalThis.fetch = async (url) => {
			if (url.includes('archive-api.open-meteo.com')) return new Response('', { status: 404 });
			if (url.includes('/h015.csv')) return new Response('2026,11,1,12,1000');
			throw new Error('Unexpected request: ' + url);
		};`;
		const summary = join(out, 'summary.md');
		const result = spawnSync(
			process.execPath,
			[
				'--import',
				`data:text/javascript,${encodeURIComponent(mock)}`,
				'scripts/fetch-external.mjs',
				'--only=weather,tide'
			],
			{ encoding: 'utf8', env: { ...process.env, EXTERNAL_DIR: out, GITHUB_STEP_SUMMARY: summary } }
		);
		assert.equal(result.status, 1, result.stderr);
		assert.match(result.stdout, /weather: FAILED/);
		assert.match(result.stdout, /tide: refreshed/);
		assert.equal(readFileSync(join(out, 'weather-daily.csv'), 'utf8'), 'old weather');
		assert.match(
			gunzipSync(readFileSync(join(out, 'tide-papeete-hourly.csv.gz'))).toString(),
			/2026-11-01T02,1000/
		);
		assert.match(readFileSync(summary, 'utf8'), /weather: FAILED/);
		assert.match(readFileSync(summary, 'utf8'), /tide: refreshed/);
	} finally {
		rmSync(out, { recursive: true, force: true });
	}
});
