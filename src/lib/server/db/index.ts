/**
 * The derived SQLite cache (#8). On first use (and at most once a minute afterwards) the
 * fingerprint of DATA_DIR + external/ is compared with the one stored in the database; when it
 * differs a fresh database is built next to the old one and swapped in.
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { importHash, runImport, type ImportOptions } from '../import';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

const CHECK_INTERVAL_MS = 60_000;
const RETRY_AFTER_FAILURE_MS = 10 * 60_000;

export function paths() {
	const cwd = process.cwd();
	return {
		dataDir: resolve(cwd, process.env.DATA_DIR || 'data'),
		externalDir: resolve(cwd, process.env.EXTERNAL_DIR || 'external'),
		dbPath:
			process.env.DATABASE_PATH === ':memory:'
				? ':memory:'
				: resolve(cwd, process.env.DATABASE_PATH || 'cache/physioshark.sqlite')
	};
}

interface Conn {
	sqlite: Database.Database;
	db: DB;
	hash: string;
	path: string;
	version: number;
}

/** Kept on globalThis so dev hot-reloads reuse (and can close) the open connection. */
interface Holder {
	conn: Conn | null;
	lastCheck: number;
	failed: { hash: string; at: number } | null;
	version: number;
}
const g = globalThis as typeof globalThis & { __physioshark?: Holder };
const holder: Holder = (g.__physioshark ??= { conn: null, lastCheck: 0, failed: null, version: 0 });

function storedHash(sqlite: Database.Database): string | null {
	try {
		const row = sqlite.prepare(`SELECT value FROM meta WHERE key = 'hash'`).get() as
			{ value: string } | undefined;
		return row?.value ?? null;
	} catch {
		return null;
	}
}

function open(path: string): Conn {
	const sqlite = new Database(path, { readonly: path !== ':memory:' });
	return {
		sqlite,
		db: drizzle(sqlite, { schema }),
		hash: storedHash(sqlite) ?? '',
		path,
		version: ++holder.version
	};
}

function closeCurrent() {
	try {
		holder.conn?.sqlite.close();
	} catch {
		/* already closed */
	}
	holder.conn = null;
}

/** Remove leftovers from earlier builds that could not be swapped in. */
function sweep(dbPath: string, keep: string | null) {
	const dir = dirname(dbPath);
	if (!existsSync(dir)) return;
	for (const f of readdirSync(dir)) {
		const p = join(dir, f);
		if (f.startsWith(`${basename(dbPath)}.building-`) && p !== keep) rmSync(p, { force: true });
	}
}

function rebuild(opts: ImportOptions, dbPath: string, hash: string) {
	const t0 = Date.now();
	if (dbPath === ':memory:') {
		// Tests: import into a temp file, then copy it into memory.
		const tmp = resolve(process.cwd(), `cache/test-${process.pid}-${Date.now()}.sqlite`);
		mkdirSync(dirname(tmp), { recursive: true });
		runImport(opts, tmp, hash);
		const mem = new Database(':memory:');
		mem.exec(`ATTACH DATABASE '${tmp.replace(/'/g, "''")}' AS src`);
		for (const { name, sql } of mem
			.prepare(
				`SELECT name, sql FROM src.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
			)
			.all() as { name: string; sql: string }[]) {
			mem.exec(sql);
			mem.exec(`INSERT INTO main."${name}" SELECT * FROM src."${name}"`);
		}
		mem.exec('DETACH DATABASE src');
		rmSync(tmp, { force: true });
		closeCurrent();
		holder.conn = {
			sqlite: mem,
			db: drizzle(mem, { schema }),
			hash,
			path: ':memory:',
			version: ++holder.version
		};
		return;
	}
	mkdirSync(dirname(dbPath), { recursive: true });
	const tmp = `${dbPath}.building-${process.pid}-${Date.now()}`;
	const summary = runImport(opts, tmp, hash);
	closeCurrent();
	let finalPath = dbPath;
	try {
		renameSync(tmp, dbPath);
	} catch (err) {
		// Windows refuses to replace a file another handle still has open: serve the new file
		// from its build path and retry the swap on the next rebuild.
		console.warn(
			`[import] could not replace ${dbPath} (${(err as NodeJS.ErrnoException).code}); serving ${tmp}`
		);
		finalPath = tmp;
	}
	holder.conn = open(finalPath);
	sweep(dbPath, finalPath);
	console.log(
		`[import] rebuilt in ${Date.now() - t0} ms: ${JSON.stringify(summary.counts)}, ${summary.issues} data notes`
	);
}

/** Ensure the cache matches the current spreadsheets; rebuild when stale. */
export function refresh(force = false): Conn {
	const now = Date.now();
	if (holder.conn && !force && now - holder.lastCheck < CHECK_INTERVAL_MS) return holder.conn;
	holder.lastCheck = now;
	const { dataDir, externalDir, dbPath } = paths();
	const opts = { dataDir, externalDir };
	const hash = importHash(opts);
	if (!holder.conn && dbPath !== ':memory:' && existsSync(dbPath)) {
		try {
			holder.conn = open(dbPath);
		} catch (err) {
			console.warn(`[import] could not open ${dbPath}: ${(err as Error).message}`);
		}
	}
	if (holder.conn && holder.conn.hash === hash) return holder.conn;
	if (
		holder.conn &&
		holder.failed?.hash === hash &&
		now - holder.failed.at < RETRY_AFTER_FAILURE_MS
	)
		return holder.conn;
	try {
		rebuild(opts, dbPath, hash);
		holder.failed = null;
	} catch (err) {
		holder.failed = { hash, at: now };
		console.error('[import] failed:', err);
		if (!holder.conn) throw err;
	}
	return holder.conn!;
}

export function getDb(): DB {
	return refresh().db;
}

/** Changes whenever a new database is swapped in; analytics caches key on it. */
export function dbVersion(): number {
	return refresh().version;
}

export { schema };
