import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSeries } from './erddap.mjs';
const csv = (value) =>
	`time,zlev,latitude,longitude,sst\nUTC,m,degrees_north,degrees_east,degree_C\n2013-08-01T12:00:00Z,0,-17.625,210.125,${value}\n`;
const options = {
	base: 'https://example.test',
	dataset: 'oisst',
	vars: ['sst'],
	lat: -17.625,
	lon: 210.125,
	zlev: true,
	chunks: [
		['2013-08-01', '2013-12-31'],
		['2014-01-01', '2014-02-01']
	],
	sleep: async () => {}
};
test('uses zlev and 0–360 longitude, and parses finite values', async () => {
	let url;
	const rows = await readSeries({
		...options,
		get: async (u) => {
			url = u;
			return csv('25.8');
		}
	});
	assert.equal(rows.get('2013-08-01').sst, 25.8);
	assert.ok(url.includes('%5B(0.0)%5D'));
	assert.ok(url.includes('(210.125)'));
});
test('historical errors fail even for 404', async () => {
	await assert.rejects(
		readSeries({
			...options,
			get: async () => {
				throw new Error('404');
			}
		})
	);
});
test('final outages fail instead of publishing gaps', async () => {
	let n = 0;
	await assert.rejects(
		readSeries({
			...options,
			get: async () => {
				if (n++) throw new Error('503');
				return csv('25');
			}
		})
	);
});
test('final publication lag may be skipped after valid historical data', async () => {
	let n = 0;
	const rows = await readSeries({
		...options,
		get: async () => {
			if (n++) throw new Error('404');
			return csv('25');
		}
	});
	assert.equal(rows.size, 1);
});
for (const value of ['NaN', ''])
	test(`rejects all-missing chunk (${value})`, async () => {
		await assert.rejects(readSeries({ ...options, get: async () => csv(value) }), /no finite/);
	});
test('rejects completely absent series', async () => {
	await assert.rejects(
		readSeries({
			...options,
			chunks: [options.chunks[1]],
			get: async () => {
				throw new Error('404');
			}
		}),
		/no finite/
	);
});

test('daily validation rejects holes and stale tails', async () => {
	const { validateDaily } = await import('./erddap.mjs');
	const rows = new Map([
		['2013-08-01', { sst: 25 }],
		['2013-08-03', { sst: 26 }]
	]);
	assert.throws(() => validateDaily(rows, 'sst', '2013-08-01', '2013-08-04'), /missing daily/);
	assert.throws(() => validateDaily(rows, 'sst', '2013-08-01', '2014-01-01'), /stale/);
	rows.set('2013-08-02', { sst: 25.5 });
	assert.doesNotThrow(() => validateDaily(rows, 'sst', '2013-08-01', '2013-08-04'));
});

test('bounded mirror recovery requests only the missing date', async () => {
	let url;
	await readSeries({
		...options,
		chunks: [['2013-08-01', '2013-08-01']],
		latest: false,
		get: async (u) => {
			url = u;
			return csv('25');
		}
	});
	assert.ok(!url.includes('(last)'));
	assert.ok(url.includes('(2013-08-01T12:00:00Z):1:(2013-08-01T12:00:00Z)'));
});
