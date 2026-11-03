/**
 * Opt-in check against the real (private) spreadsheets. Skipped unless REAL_DATA_DIR is set:
 *   REAL_DATA_DIR=data pnpm vitest run src/lib/server/import/realData.test.ts
 * Prints a summary only; never writes to the spreadsheets.
 */
import Database from 'better-sqlite3';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runImport } from './index';

const dir = process.env.REAL_DATA_DIR;

describe.skipIf(!dir)('real data import', () => {
	it('imports every season', () => {
		const out = resolve('cache/real-test.sqlite');
		mkdirSync(resolve('cache'), { recursive: true });
		rmSync(out, { force: true });
		const summary = runImport({ dataDir: resolve(dir!), externalDir: resolve('external') }, out);
		const db = new Database(out, { readonly: true });
		const q = (sql: string) => db.prepare(sql).all();
		console.log(summary);
		console.table(
			q(
				`SELECT season, species, kind, count(*) n, sum(set_id IS NOT NULL) linked, round(avg(tl_mm)) tl, round(avg(mass_kg),2) kg FROM captures GROUP BY 1,2,3`
			)
		);
		console.table(
			q(
				`SELECT season, count(*) sets, round(sum(duration_min)/60) hours, sum(n_total) sharks, round(avg(cpue),2) cpue, sum(sunset_min IS NOT NULL) env, round(avg(tide_mid_mm)) tide, round(avg(sst),2) sst FROM sets GROUP BY 1`
			)
		);
		console.table(q(`SELECT site_id, count(*) n FROM captures GROUP BY 1 ORDER BY 2 DESC`));
		console.table(
			q(`SELECT severity, category, count(*) n FROM data_issues GROUP BY 1,2 ORDER BY 3 DESC`)
		);
		console.table(
			q(
				`SELECT message, sheet, row, value FROM data_issues WHERE category IN ('sites','sheets','identity','files') LIMIT 40`
			)
		);
		console.table(
			q(`SELECT n_captures, n_seasons, count(*) n FROM individuals GROUP BY 1,2 ORDER BY 1,2`)
		);
		console.table(q(`SELECT person, count(*) n FROM set_crew GROUP BY 1 ORDER BY 2 DESC LIMIT 25`));
		console.table(
			q(
				`SELECT 'lab' t, count(*) FROM lab_sharks UNION ALL SELECT 'labwq', count(*) FROM lab_wq UNION ALL SELECT 'feeding', count(*) FROM lab_feeding UNION ALL SELECT 'fieldwq', count(*) FROM field_wq UNION ALL SELECT 'hobo', count(*) FROM hobo UNION ALL SELECT 'blood', count(*) FROM blood UNION ALL SELECT 'adult', count(*) FROM adult_captures UNION ALL SELECT 'effort', count(*) FROM adult_effort UNION ALL SELECT 'notes', count(*) FROM field_notes UNION ALL SELECT 'tideext', count(*) FROM tide_extrema`
			)
		);
		console.table(
			q(
				`SELECT site_id, system, count(*) files, sum(kept) kept, min(start) first, max("end") last FROM logger_files GROUP BY 1,2 ORDER BY 1,2`
			)
		);
		console.table(
			q(
				`SELECT site_id, count(*) days, round(avg(mean),2) mean, round(avg(max),2) max, round(max(max),2) hottest, round(min(min),2) coolest FROM logger_daily GROUP BY 1`
			)
		);
		console.table(
			q(
				`SELECT season, count(insitu_temp) sets_with_logger, round(avg(insitu_temp),2) insitu, round(avg(sst),2) sst FROM sets GROUP BY 1`
			)
		);
		console.table(
			q(`SELECT severity, message, file FROM data_issues WHERE category = 'loggers' LIMIT 60`)
		);
		expect(summary.counts.captures).toBeGreaterThan(3000);
		db.close();
	});
});
