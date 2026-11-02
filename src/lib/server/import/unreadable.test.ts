import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { importHash, listWorkbooks } from '.';

// A folder the app can't list (EACCES in Docker) must not throw (#83). A file passed as the data
// folder fails readdir the same way (ENOTDIR) on every OS, including Windows CI.
describe('unreadable DATA_DIR', () => {
	const dir = mkdtempSync(join(tmpdir(), 'physioshark-'));
	const notADir = join(dir, 'data');
	writeFileSync(notADir, 'not a folder');
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	it('skips the path and reports it', () => {
		const errors: string[] = [];
		expect(listWorkbooks(notADir, (p, err) => errors.push(`${p}:${err.code}`))).toEqual([]);
		expect(errors).toEqual([`${notADir}:ENOTDIR`]);
	});

	it('still fingerprints, and differently from an empty folder', () => {
		const empty = join(dir, 'empty');
		const opts = { dataDir: notADir, externalDir: join(dir, 'none') };
		expect(() => importHash(opts)).not.toThrow();
		expect(importHash(opts)).not.toBe(importHash({ ...opts, dataDir: empty }));
	});
});
