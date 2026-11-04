/**
 * Derived database (#2–#8). Every row is rebuilt from the spreadsheets in DATA_DIR plus the
 * environmental snapshots in EXTERNAL_DIR, so there is no upgrade path to protect: after editing
 * this file run `pnpm db:generate` and the next import builds a fresh database.
 *
 * Units: lengths in mm, mass in kg, clock times as minutes after local midnight (Moorea,
 * UTC−10, no DST), dates as `YYYY-MM-DD` local, tide heights in mm above the gauge datum.
 */
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

const source = {
	sourceFile: text('source_file'),
	sourceSheet: text('source_sheet'),
	sourceRow: integer('source_row')
};

export const meta = sqliteTable('meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const sites = sqliteTable('sites', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	code: text('code'),
	island: text('island').notNull(),
	kind: text('kind').notNull(), // nursery | adult | other | lab
	lat: real('lat'),
	lon: real('lon'),
	coordSource: text('coord_source'),
	retired: text('retired'),
	fishingEffort: real('fishing_effort'),
	humanImpact: real('human_impact'),
	artificialisation: real('artificialisation'),
	pressureComposite: real('pressure_composite'),
	pressureTier: text('pressure_tier'),
	directions: text('directions'),
	habitat: text('habitat'),
	aliases: text('aliases') // JSON array of raw spellings seen in the sheets
});

export const sets = sqliteTable(
	'sets',
	{
		id: integer('id').primaryKey(),
		season: text('season').notNull(),
		setNo: integer('set_no'),
		siteId: text('site_id'),
		siteRaw: text('site_raw'),
		date: text('date'),
		weekday: integer('weekday'), // 0 = Sunday
		gear: text('gear'),
		visit: integer('visit'),
		crewRaw: text('crew_raw'),
		crewSize: integer('crew_size'),
		startMin: real('start_min'),
		endMin: real('end_min'),
		durationMin: real('duration_min'),
		nCm: integer('n_cm'),
		nNa: integer('n_na'),
		nNf: integer('n_nf'),
		nTotal: integer('n_total'),
		nLinked: integer('n_linked'),
		cpue: real('cpue'),
		cpueCm: real('cpue_cm'),
		cpueNa: real('cpue_na'),
		cpueSheet: real('cpue_sheet'),
		tideRaw: text('tide_raw'),
		moonRaw: text('moon_raw'),
		weatherRaw: text('weather_raw'),
		cloudCover: real('cloud_cover'),
		waterTemp: real('water_temp'),
		ph: real('ph'),
		doMg: real('do_mg'),
		doPct: real('do_pct'),
		salinity: real('salinity'),
		depthCm: real('depth_cm'),
		notes: text('notes'),
		// Environment joined at import time.
		sunsetMin: real('sunset_min'),
		civilDuskMin: real('civil_dusk_min'),
		moonPhase: real('moon_phase'), // 0 new → 0.5 full → 1 new
		moonIllum: real('moon_illum'),
		moonAltMid: real('moon_alt_mid'),
		tideStartMm: real('tide_start_mm'),
		tideMidMm: real('tide_mid_mm'),
		tideTrend: text('tide_trend'),
		tideRangeMm: real('tide_range_mm'),
		airTemp: real('air_temp'),
		windSpeed: real('wind_speed'),
		windDir: real('wind_dir'),
		gusts: real('gusts'),
		rain24h: real('rain_24h'),
		rainEvening: real('rain_evening'),
		cloudEvening: real('cloud_evening'),
		pressure: real('pressure'),
		sst: real('sst'),
		sstAnom: real('sst_anom'),
		dhw: real('dhw'),
		// Offshore chlorophyll-a of the satellite week holding the set date, mg m⁻³ (#23).
		chl: real('chl'),
		waveHeight: real('wave_height'),
		swellHeight: real('swell_height'),
		oni: real('oni'),
		// Mean in-situ logger temperature at the nursery during the set (#10).
		insituTemp: real('insitu_temp'),
		...source
	},
	(t) => [index('sets_season').on(t.season), index('sets_site').on(t.siteId)]
);

export const setCrew = sqliteTable(
	'set_crew',
	{
		id: integer('id').primaryKey(),
		setId: integer('set_id').notNull(),
		person: text('person').notNull()
	},
	(t) => [index('set_crew_set').on(t.setId), index('set_crew_person').on(t.person)]
);

export const captures = sqliteTable(
	'captures',
	{
		id: integer('id').primaryKey(),
		season: text('season').notNull(),
		species: text('species').notNull(),
		siteId: text('site_id'),
		siteRaw: text('site_raw'),
		setId: integer('set_id'),
		setNo: integer('set_no'),
		date: text('date'),
		sharkNo: text('shark_no'),
		captureNo: integer('capture_no'),
		kind: text('kind').notNull(), // field | lab_release | hook
		tag: text('tag'),
		tags: text('tags'), // JSON array
		individualId: text('individual_id'),
		sex: text('sex'),
		ageClass: text('age_class'),
		umbilical: text('umbilical'), // open | semi | closed
		uss: integer('uss'),
		pclMm: real('pcl_mm'),
		flMm: real('fl_mm'),
		tlMm: real('tl_mm'),
		pecGirthMm: real('pec_girth_mm'),
		dorsGirthMm: real('dors_girth_mm'),
		caudGirthMm: real('caud_girth_mm'),
		massKg: real('mass_kg'),
		clasperL: real('clasper_l'),
		clasperR: real('clasper_r'),
		captureMin: real('capture_min'),
		landingMin: real('landing_min'),
		releaseMin: real('release_min'),
		workupMin: real('workup_min'),
		toLab: integer('to_lab'),
		died: integer('died'),
		blood: integer('blood'),
		dna: integer('dna'),
		usArea: real('us_area'),
		usPerimeter: real('us_perimeter'),
		habitat: text('habitat'),
		tideRaw: text('tide_raw'),
		notes: text('notes'),
		// Gastric lavage (#40): done?, fullness (full | traces | empty), free-text contents.
		lavage: integer('lavage'),
		stomach: text('stomach'),
		stomachContents: text('stomach_contents'),
		// Environment joined at import time.
		minAfterSunset: real('min_after_sunset'),
		minAfterNetIn: real('min_after_net_in'),
		tideMm: real('tide_mm'),
		tideTrend: text('tide_trend'),
		moonIllum: real('moon_illum'),
		moonPhase: real('moon_phase'),
		sst: real('sst'),
		dhw: real('dhw'),
		...source
	},
	(t) => [
		index('captures_season').on(t.season),
		index('captures_site').on(t.siteId),
		index('captures_individual').on(t.individualId)
	]
);

export const individuals = sqliteTable('individuals', {
	id: text('id').primaryKey(),
	species: text('species').notNull(),
	sex: text('sex'),
	firstDate: text('first_date'),
	lastDate: text('last_date'),
	nCaptures: integer('n_captures').notNull(),
	nSeasons: integer('n_seasons').notNull(),
	sites: text('sites'), // JSON array of site ids in capture order
	firstTlMm: real('first_tl_mm'),
	lastTlMm: real('last_tl_mm'),
	tags: text('tags'),
	conflict: text('conflict')
});

export const labSharks = sqliteTable('lab_sharks', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	sharkNo: text('shark_no'),
	tag: text('tag'),
	individualId: text('individual_id'),
	species: text('species'),
	sex: text('sex'),
	siteId: text('site_id'),
	arrivalDate: text('arrival_date'),
	releaseDate: text('release_date'),
	days: real('days'),
	arrTlMm: real('arr_tl_mm'),
	arrFlMm: real('arr_fl_mm'),
	arrMassKg: real('arr_mass_kg'),
	relTlMm: real('rel_tl_mm'),
	relFlMm: real('rel_fl_mm'),
	relMassKg: real('rel_mass_kg'),
	tank: text('tank'),
	project: text('project'),
	died: integer('died'),
	notes: text('notes'),
	...source
});

export const labWq = sqliteTable('lab_wq', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	date: text('date'),
	timeMin: real('time_min'),
	tank: text('tank'),
	temp: real('temp'),
	ph: real('ph'),
	doMg: real('do_mg'),
	doPct: real('do_pct'),
	salinity: real('salinity'),
	recorder: text('recorder'),
	notes: text('notes')
});

export const labFeeding = sqliteTable('lab_feeding', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	date: text('date'),
	tank: text('tank'),
	shark: text('shark'),
	tag: text('tag'),
	foodG: real('food_g'),
	rejectedG: real('rejected_g'),
	pct: real('pct'),
	notes: text('notes')
});

export const fieldWq = sqliteTable('field_wq', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	date: text('date'),
	siteId: text('site_id'),
	timeMin: real('time_min'),
	depthCm: real('depth_cm'),
	salinity: real('salinity'),
	doMg: real('do_mg'),
	doPct: real('do_pct'),
	temp: real('temp'),
	ph: real('ph'),
	source: text('source') // field_wq | set_log | site_salinity
});

export const hobo = sqliteTable('hobo', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	siteId: text('site_id'),
	siteRaw: text('site_raw'),
	logger: text('logger'),
	deployed: text('deployed'),
	retrieved: text('retrieved'),
	status: text('status'),
	notes: text('notes')
});

/** One row per raw logger CSV (HOBO or EnvLogger) found under DATA_DIR (#10). */
export const loggerFiles = sqliteTable('logger_files', {
	id: integer('id').primaryKey(),
	file: text('file').notNull(),
	system: text('system').notNull(), // HOBO | EnvLogger
	logger: text('logger').notNull(), // HOBO label ("12b") or EnvLogger serial
	serial: text('serial'),
	siteId: text('site_id'),
	siteBasis: text('site_basis'), // download GPS | register | logger name | file name | HOBO log
	start: text('start'), // YYYY-MM-DDTHH:MM local, first kept sample
	end: text('end'),
	samples: integer('samples').notNull(),
	kept: integer('kept').notNull(),
	lat: real('lat'),
	lon: real('lon'),
	excluded: text('excluded') // why the readings were left out, e.g. not tracking the lagoon
});

/** Daily in-situ water temperature per nursery, from site-hourly means (days with ≥ 18 h). */
export const loggerDaily = sqliteTable(
	'logger_daily',
	{
		id: integer('id').primaryKey(),
		siteId: text('site_id').notNull(),
		date: text('date').notNull(),
		mean: real('mean').notNull(),
		min: real('min').notNull(),
		max: real('max').notNull(),
		hours: integer('hours').notNull(),
		loggers: integer('loggers').notNull()
	},
	(t) => [index('logger_daily_site').on(t.siteId)]
);

/** Mean temperature by nursery, calendar month and local hour: the daily cycle. */
export const loggerDiel = sqliteTable('logger_diel', {
	id: integer('id').primaryKey(),
	siteId: text('site_id').notNull(),
	month: integer('month').notNull(),
	hour: integer('hour').notNull(),
	temp: real('temp').notNull(),
	n: integer('n').notNull()
});

export const blood = sqliteTable('blood', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	siteId: text('site_id'),
	date: text('date'),
	species: text('species'),
	experiment: text('experiment'),
	sharkNo: text('shark_no'),
	hct: real('hct'),
	hb: real('hb'),
	cholesterol: real('cholesterol'),
	ffa: real('ffa'),
	triglycerides: real('triglycerides')
});

export const mouth = sqliteTable('mouth', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	sharkNo: text('shark_no'),
	siteId: text('site_id'),
	tag: text('tag'),
	species: text('species'),
	sex: text('sex'),
	mol: real('mol'),
	mow: real('mow')
});

export const prey = sqliteTable('prey', {
	id: integer('id').primaryKey(),
	season: text('season').notNull(),
	date: text('date'),
	location: text('location'),
	name: text('name'),
	size: text('size'),
	notes: text('notes')
});

export const adultCaptures = sqliteTable('adult_captures', {
	id: integer('id').primaryKey(),
	sharkId: text('shark_id'),
	date: text('date'),
	name: text('name'),
	hookedMin: real('hooked_min'),
	boatMin: real('boat_min'),
	releasedMin: real('released_min'),
	fightMin: real('fight_min'),
	handlingMin: real('handling_min'),
	lat: real('lat'),
	lon: real('lon'),
	site: text('site'),
	sex: text('sex'),
	maturity: text('maturity'),
	reproCode: text('repro_code'),
	pclMm: real('pcl_mm'),
	flMm: real('fl_mm'),
	tlMm: real('tl_mm'),
	pecGirthMm: real('pec_girth_mm'),
	dorsGirthMm: real('dors_girth_mm'),
	caudGirthMm: real('caud_girth_mm'),
	clasperInner: real('clasper_inner'),
	clasperOuter: real('clasper_outer'),
	sperm: text('sperm'),
	ultrasound: text('ultrasound'),
	pregnant: text('pregnant'),
	blood1Min: real('blood1_min'),
	lact1: real('lact1'),
	gluc1: real('gluc1'),
	bhb1: real('bhb1'),
	blood2Min: real('blood2_min'),
	lact2: real('lact2'),
	gluc2: real('gluc2'),
	bhb2: real('bhb2'),
	tagged: text('tagged'),
	bait: text('bait'),
	comments: text('comments'),
	...source
});

export const adultEffort = sqliteTable('adult_effort', {
	id: integer('id').primaryKey(),
	date: text('date'),
	session: text('session'),
	baitInMin: real('bait_in_min'),
	baitOutMin: real('bait_out_min'),
	soakMin: real('soak_min'),
	sharkTimes: text('shark_times'), // JSON array of minutes
	nSharks: integer('n_sharks'),
	comments: text('comments')
});

export const adultSamples = sqliteTable('adult_samples', {
	id: integer('id').primaryKey(),
	sample: text('sample'),
	sizeCm: real('size_cm'),
	sex: text('sex'),
	island: text('island'),
	location: text('location'),
	year: integer('year'),
	notes: text('notes')
});

export const fieldNotes = sqliteTable('field_notes', {
	id: integer('id').primaryKey(),
	season: text('season'),
	date: text('date'),
	siteId: text('site_id'),
	kind: text('kind').notNull(), // set | capture | lab | adult | hobo | prey
	refId: integer('ref_id'),
	species: text('species'),
	text: text('text').notNull()
});

export const weatherDaily = sqliteTable('weather_daily', {
	date: text('date').primaryKey(),
	tmax: real('tmax'),
	tmin: real('tmin'),
	tmean: real('tmean'),
	precip: real('precip'),
	windMax: real('wind_max'),
	gustMax: real('gust_max'),
	windDir: real('wind_dir'),
	radiation: real('radiation'),
	cloud: real('cloud'),
	pressure: real('pressure'),
	humidity: real('humidity'),
	sunshineH: real('sunshine_h')
});

export const weatherHourly = sqliteTable('weather_hourly', {
	ts: text('ts').primaryKey(), // YYYY-MM-DDTHH local
	temp: real('temp'),
	precip: real('precip'),
	cloud: real('cloud'),
	wind: real('wind'),
	windDir: real('wind_dir'),
	gust: real('gust'),
	pressure: real('pressure')
});

export const oceanDaily = sqliteTable('ocean_daily', {
	date: text('date').primaryKey(),
	oisst: real('oisst'),
	crwSst: real('crw_sst'),
	crwAnom: real('crw_anom'),
	crwHotspot: real('crw_hotspot'),
	crwDhw: real('crw_dhw'),
	crwBaa: real('crw_baa'),
	waveMax: real('wave_max'),
	wavePeriod: real('wave_period'),
	waveDir: real('wave_dir'),
	swellMax: real('swell_max')
});

/** Weekly offshore chlorophyll-a around Moorea, NOAA VIIRS (#23). `date` is the week's centre. */
export const chlorophyllWeekly = sqliteTable('chlorophyll_weekly', {
	date: text('date').primaryKey(),
	chl: real('chl'), // median of the offshore ring, mg m⁻³
	pixels: integer('pixels').notNull() // cloud-free ring pixels that week
});

export const tideHourly = sqliteTable('tide_hourly', {
	ts: text('ts').primaryKey(),
	mm: real('mm').notNull()
});

export const tideExtrema = sqliteTable('tide_extrema', {
	ts: text('ts').primaryKey(), // YYYY-MM-DDTHH:MM local
	kind: text('kind').notNull(), // H | L
	mm: real('mm').notNull()
});

/** Tropical cyclone track points within 750 km of Moorea (IBTrACS, UTC, #24). */
export const cyclonePoints = sqliteTable('cyclone_points', {
	id: integer('id').primaryKey(),
	sid: text('sid').notNull(),
	name: text('name').notNull(),
	ts: text('ts').notNull(), // ISO UTC
	lat: real('lat').notNull(),
	lon: real('lon').notNull(),
	windKt: real('wind_kt'),
	presHpa: real('pres_hpa'),
	distKm: real('dist_km').notNull()
});

/** French Polynesia school holidays: first and last day off, local dates (#25). */
export const schoolHolidays = sqliteTable('school_holidays', {
	id: integer('id').primaryKey(),
	schoolYear: text('school_year').notNull(), // 2017-2018
	name: text('name').notNull(), // Christmas break…
	start: text('start').notNull(),
	end: text('end').notNull(),
	source: text('source').notNull()
});

export const climateMonthly = sqliteTable('climate_monthly', {
	ym: text('ym').primaryKey(), // YYYY-MM
	oni: real('oni'),
	soi: real('soi')
});

export const dataIssues = sqliteTable('data_issues', {
	id: integer('id').primaryKey(),
	severity: text('severity').notNull(), // error | warning | info
	category: text('category').notNull(),
	message: text('message').notNull(),
	file: text('file'),
	sheet: text('sheet'),
	row: integer('row'),
	column: text('column'),
	value: text('value')
});
