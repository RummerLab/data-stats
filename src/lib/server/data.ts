/**
 * Whole-dataset access. The database is small (a few thousand captures and sets), so pages load
 * it into memory once per import and compute analyses in TypeScript. `memo()` caches derived
 * results until the next import swaps the database.
 */
import { asc } from 'drizzle-orm';
import { dbVersion, getDb, schema } from './db';

export type Site = typeof schema.sites.$inferSelect;
export type SetRow = typeof schema.sets.$inferSelect;
export type Capture = typeof schema.captures.$inferSelect;
export type Individual = typeof schema.individuals.$inferSelect;
export type LabShark = typeof schema.labSharks.$inferSelect;
export type AdultCapture = typeof schema.adultCaptures.$inferSelect;
export type WeatherDay = typeof schema.weatherDaily.$inferSelect;
export type OceanDay = typeof schema.oceanDaily.$inferSelect;
export type DataIssue = typeof schema.dataIssues.$inferSelect;

export interface Dataset {
	version: number;
	meta: Record<string, string>;
	sites: Site[];
	siteById: Map<string, Site>;
	sets: SetRow[];
	setById: Map<number, SetRow>;
	crew: { setId: number; person: string }[];
	captures: Capture[];
	individuals: Individual[];
	labSharks: LabShark[];
	labWq: (typeof schema.labWq.$inferSelect)[];
	feeding: (typeof schema.labFeeding.$inferSelect)[];
	fieldWq: (typeof schema.fieldWq.$inferSelect)[];
	hobo: (typeof schema.hobo.$inferSelect)[];
	blood: (typeof schema.blood.$inferSelect)[];
	mouth: (typeof schema.mouth.$inferSelect)[];
	prey: (typeof schema.prey.$inferSelect)[];
	adults: AdultCapture[];
	adultEffort: (typeof schema.adultEffort.$inferSelect)[];
	adultSamples: (typeof schema.adultSamples.$inferSelect)[];
	notes: (typeof schema.fieldNotes.$inferSelect)[];
	weather: WeatherDay[];
	ocean: OceanDay[];
	climate: (typeof schema.climateMonthly.$inferSelect)[];
	issues: DataIssue[];
	seasons: string[];
}

let cache: Dataset | null = null;
const memos = new Map<string, unknown>();

export function dataset(): Dataset {
	const v = dbVersion();
	if (cache && cache.version === v) return cache;
	const db = getDb();
	const sites = db.select().from(schema.sites).all();
	const sets = db.select().from(schema.sets).orderBy(asc(schema.sets.date)).all();
	const captures = db.select().from(schema.captures).orderBy(asc(schema.captures.date)).all();
	const seasons = [
		...new Set([...sets.map((s) => s.season), ...captures.map((c) => c.season)])
	].sort();
	cache = {
		version: v,
		meta: Object.fromEntries(
			db
				.select()
				.from(schema.meta)
				.all()
				.map((m) => [m.key, m.value])
		),
		sites,
		siteById: new Map(sites.map((s) => [s.id, s])),
		sets,
		setById: new Map(sets.map((s) => [s.id, s])),
		crew: db.select().from(schema.setCrew).all(),
		captures,
		individuals: db.select().from(schema.individuals).all(),
		labSharks: db.select().from(schema.labSharks).all(),
		labWq: db.select().from(schema.labWq).all(),
		feeding: db.select().from(schema.labFeeding).all(),
		fieldWq: db.select().from(schema.fieldWq).all(),
		hobo: db.select().from(schema.hobo).all(),
		blood: db.select().from(schema.blood).all(),
		mouth: db.select().from(schema.mouth).all(),
		prey: db.select().from(schema.prey).all(),
		adults: db.select().from(schema.adultCaptures).all(),
		adultEffort: db.select().from(schema.adultEffort).all(),
		adultSamples: db.select().from(schema.adultSamples).all(),
		notes: db.select().from(schema.fieldNotes).all(),
		weather: db.select().from(schema.weatherDaily).orderBy(asc(schema.weatherDaily.date)).all(),
		ocean: db.select().from(schema.oceanDaily).orderBy(asc(schema.oceanDaily.date)).all(),
		climate: db.select().from(schema.climateMonthly).orderBy(asc(schema.climateMonthly.ym)).all(),
		issues: db.select().from(schema.dataIssues).all(),
		seasons
	};
	memos.clear();
	return cache;
}

/** Cache a derived value until the next import. */
export function memo<T>(key: string, fn: (d: Dataset) => T): T {
	const d = dataset();
	const k = `${d.version}:${key}`;
	if (memos.has(k)) return memos.get(k) as T;
	const v = fn(d);
	memos.set(k, v);
	return v;
}

/** Hourly tide series for a date window (loaded on demand; ~115k rows in total). */
export function tideWindow(from: string, to: string) {
	return getDb()
		.select()
		.from(schema.tideHourly)
		.all()
		.filter((r) => r.ts >= from && r.ts < to);
}

export function tideExtrema() {
	return memo('tideExtrema', () => getDb().select().from(schema.tideExtrema).all());
}

export function tideHourlyAll() {
	return memo('tideHourly', () => getDb().select().from(schema.tideHourly).all());
}

export function weatherHourlyAll() {
	return memo('weatherHourly', () => getDb().select().from(schema.weatherHourly).all());
}

/** Field (nursery gillnet) captures only: excludes hook-and-line adults and lab releases. */
export const isNursery = (c: Capture) => c.kind === 'field';
export const isGillnet = (s: SetRow) => s.gear === 'Gillnet';
