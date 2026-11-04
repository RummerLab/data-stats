#!/usr/bin/env node
/**
 * Fetch public environmental data for Moorea into external/ (#15–#20, #22).
 *
 *   node scripts/fetch-external.mjs            # everything since 2013-08-01
 *   node scripts/fetch-external.mjs --only=tide,climate
 *   node scripts/fetch-external.mjs --only=oisst # repair SST in the existing ocean snapshot
 *
 * Sources (all free, no API key):
 * - Open-Meteo Historical Weather API (ERA5 / ERA5-Land reanalysis, CC BY 4.0)
 * - Open-Meteo Marine API with `models=era5_ocean` (waves, swell)
 * - NOAA OISST v2.1 daily SST via NOAA CoastWatch ERDDAP
 * - NOAA Coral Reef Watch 5 km daily heat stress via PacIOOS ERDDAP
 * - NOAA S-NPP VIIRS weekly chlorophyll-a (NOAA STAR / CoastWatch ERDDAP), offshore ring (#23)
 * - UHSLC fast-delivery hourly sea level, Papeete (station 015)
 * - NOAA CPC Oceanic Niño Index and Southern Oscillation Index
 * - NOAA IBTrACS v04r01 South Pacific best tracks (cyclone positions near Moorea, #24)
 * - French Polynesia school holidays (#25): the Ministère de l'Éducation nationale's
 *   "Le calendrier scolaire" open data (Licence Ouverte 2.0) since 2017-18, and the Polynesian
 *   government's archived calendar orders for 2013-14 to 2016-17
 *
 * Output files are small CSVs (hourly series gzipped) committed to the repo, so the app and CI
 * never need network access. No spreadsheet data is read or sent anywhere.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { createGet, refreshJobs, sleep, WEATHER_CHUNK_DELAY_MS } from './external-refresh.mjs';

import { readSeries, validateDaily, chunks, OISST_MAX_LAG_DAYS } from './erddap.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.EXTERNAL_DIR || join(root, 'external');
const START = '2013-08-01';
const LAT = -17.53;
const LON = -149.83;
const TZ = 'Pacific/Tahiti';
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '')
	.slice(7)
	.split(',')
	.filter(Boolean);
const want = (name) => only.length === 0 || only.includes(name);

mkdirSync(OUT, { recursive: true });

const get = createGet();
let writeSnapshot;
const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86_400_000));

const fmt = (v, dp = 2) =>
	v == null || Number.isNaN(v) ? '' : String(Math.round(v * 10 ** dp) / 10 ** dp);

function writeCsv(name, header, rows, gzip = false) {
	const body = [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
	const file = gzip ? `${name}.gz` : name;
	writeSnapshot(file, gzip ? gzipSync(body, { level: 9 }) : body);
	console.log(`[external] staged ${file} (${rows.length} rows)`);
}

async function weather() {
	const end = daysAgo(6);
	const dailyVars = [
		'temperature_2m_max',
		'temperature_2m_min',
		'temperature_2m_mean',
		'precipitation_sum',
		'wind_speed_10m_max',
		'wind_gusts_10m_max',
		'wind_direction_10m_dominant',
		'shortwave_radiation_sum',
		'cloud_cover_mean',
		'pressure_msl_mean',
		'relative_humidity_2m_mean',
		'sunshine_duration'
	];
	const hourlyVars = [
		'temperature_2m',
		'precipitation',
		'cloud_cover',
		'wind_speed_10m',
		'wind_direction_10m',
		'wind_gusts_10m',
		'pressure_msl'
	];
	const daily = [];
	const hourly = [];
	for (const [s, e] of chunks(START, end)) {
		const url =
			`https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}` +
			`&start_date=${s}&end_date=${e}&timezone=${encodeURIComponent(TZ)}` +
			`&daily=${dailyVars.join(',')}&hourly=${hourlyVars.join(',')}`;
		const j = await get(url, { json: true });
		j.daily.time.forEach((t, i) => {
			daily.push([
				t,
				...dailyVars.map((v) =>
					v === 'sunshine_duration' ? fmt(j.daily[v][i] / 3600, 2) : fmt(j.daily[v][i], 2)
				)
			]);
		});
		j.hourly.time.forEach((t, i) => {
			hourly.push([t.slice(0, 13), ...hourlyVars.map((v) => fmt(j.hourly[v][i], 1))]);
		});
		await sleep(WEATHER_CHUNK_DELAY_MS);
	}
	writeCsv(
		'weather-daily.csv',
		[
			'date',
			'tmax',
			'tmin',
			'tmean',
			'precip',
			'wind_max',
			'gust_max',
			'wind_dir',
			'radiation',
			'cloud',
			'pressure',
			'humidity',
			'sunshine_h'
		],
		daily
	);
	writeCsv(
		'weather-hourly.csv',
		['ts', 'temp', 'precip', 'cloud', 'wind', 'wind_dir', 'gust', 'pressure'],
		hourly,
		true
	);
}

async function erddapSeries(base, dataset, vars, lat, lon, start, end, zlev = false, lagDays = 0) {
	return readSeries({
		base,
		dataset,
		vars,
		lat,
		lon,
		chunks: chunks(start, end, lagDays),
		zlev,
		get,
		sleep
	});
}

// OISST uses 0–360° longitude and a surface zlev dimension.
async function fetchOisst(end) {
	const rows = await erddapSeries(
		'https://upwell.pfeg.noaa.gov/erddap',
		'ncdcOisst21Agg',
		['sst'],
		-17.625,
		210.125,
		START,
		end,
		true,
		OISST_MAX_LAG_DAYS
	);
	// The legacy aggregation omits some archived dates. Recover those from NOAA's
	// complete OISST v2.1 final-product mirror, never interpolate or invent values.
	const last = [...rows.keys()].sort().at(-1);
	for (let t = Date.parse(START); t <= Date.parse(last); t += 86400000) {
		const date = new Date(t).toISOString().slice(0, 10);
		if (rows.get(date)?.sst != null) continue;
		const recovered = await readSeries({
			base: 'https://upwell.pfeg.noaa.gov/erddap',
			dataset: 'oisst_rclone',
			vars: ['sst'],
			lat: -17.625,
			lon: 210.125,
			zlev: true,
			chunks: [[date, date]],
			latest: false,
			get,
			sleep
		});
		rows.set(date, recovered.get(date));
	}
	validateDaily(rows, 'sst', START, end);
	return rows;
}

// Repair only SST without refreshing the independent CRW and wave snapshots.
async function oisst() {
	const values = await fetchOisst(daysAgo(2));
	const lines = readFileSync(join(OUT, 'ocean-daily.csv'), 'utf8').trim().split(/\r?\n/);
	const header = lines.shift().split(',');
	const col = header.indexOf('oisst');
	if (col < 0) throw new Error('ocean snapshot has no oisst column');
	const rows = lines.map((line) => {
		const row = line.split(',');
		row[col] = fmt(values.get(row[0])?.sst);
		return row;
	});
	writeCsv('ocean-daily.csv', header, rows);
}

async function ocean() {
	const end = daysAgo(2);
	const oisst = await fetchOisst(end);
	const crw = await erddapSeries(
		'https://pae-paha.pacioos.hawaii.edu/erddap',
		'dhw_5km',
		['CRW_SST', 'CRW_SSTANOMALY', 'CRW_HOTSPOT', 'CRW_DHW', 'CRW_BAA'],
		-17.475,
		-149.825,
		START,
		end
	);
	const waveVars = [
		'wave_height_max',
		'wave_period_max',
		'wave_direction_dominant',
		'swell_wave_height_max'
	];
	const waves = new Map();
	for (const model of ['era5_ocean', 'best_match']) {
		const from = model === 'era5_ocean' ? START : '2021-10-01';
		for (const [s, e] of chunks(from, end)) {
			const url =
				`https://marine-api.open-meteo.com/v1/marine?latitude=${LAT + 0.06}&longitude=${LON}` +
				`&start_date=${s}&end_date=${e}&timezone=${encodeURIComponent(TZ)}` +
				`&daily=${waveVars.join(',')}${model === 'era5_ocean' ? '&models=era5_ocean' : ''}`;
			const j = await get(url, { json: true });
			j.daily.time.forEach((t, i) => {
				const prev = waves.get(t) ?? {};
				for (const v of waveVars) if (prev[v] == null) prev[v] = j.daily[v][i];
				waves.set(t, prev);
			});
			await sleep(1200);
		}
	}
	const dates = [...new Set([...oisst.keys(), ...crw.keys(), ...waves.keys()])].sort();
	writeCsv(
		'ocean-daily.csv',
		[
			'date',
			'oisst',
			'crw_sst',
			'crw_anom',
			'crw_hotspot',
			'crw_dhw',
			'crw_baa',
			'wave_max',
			'wave_period',
			'wave_dir',
			'swell_max'
		],
		dates.map((d) => {
			const o = oisst.get(d) ?? {};
			const c = crw.get(d) ?? {};
			const w = waves.get(d) ?? {};
			return [
				d,
				fmt(o.sst),
				fmt(c.CRW_SST),
				fmt(c.CRW_SSTANOMALY),
				fmt(c.CRW_HOTSPOT),
				fmt(c.CRW_DHW),
				fmt(c.CRW_BAA, 0),
				fmt(w.wave_height_max),
				fmt(w.wave_period_max),
				fmt(w.wave_direction_dominant, 0),
				fmt(w.swell_wave_height_max)
			];
		})
	);
}

async function tide() {
	// UHSLC fast-delivery hourly sea level for Papeete (UHSLC id 015), GMT, millimetres.
	const text = await get('https://uhslc.soest.hawaii.edu/data/csv/fast/hourly/h015.csv');
	const rows = [];
	for (const line of text.split('\n')) {
		const [y, m, d, h, mm] = line.split(',').map(Number);
		if (!y || y < 2013 || mm === -32767 || !Number.isFinite(mm)) continue;
		const local = new Date(Date.UTC(y, m - 1, d, h) - 10 * 3_600_000); // Tahiti = UTC−10, no DST
		if (isoDay(local) < '2013-07-01') continue;
		rows.push([local.toISOString().slice(0, 13), String(mm)]);
	}
	writeCsv('tide-papeete-hourly.csv', ['ts', 'mm'], rows, true);
}

async function climate() {
	const oni = new Map();
	const seasons = [
		'DJF',
		'JFM',
		'FMA',
		'MAM',
		'AMJ',
		'MJJ',
		'JJA',
		'JAS',
		'ASO',
		'SON',
		'OND',
		'NDJ'
	];
	for (const line of (await get('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt')).split(
		'\n'
	)) {
		const [seas, yr, , anom] = line.trim().split(/\s+/);
		const i = seasons.indexOf(seas);
		if (i < 0 || Number(yr) < 2012) continue;
		oni.set(`${yr}-${String(i + 1).padStart(2, '0')}`, Number(anom));
	}
	const soi = new Map();
	const soiText = await get('https://www.cpc.ncep.noaa.gov/data/indices/soi');
	const std = soiText.slice(soiText.indexOf('STANDARDIZED'));
	for (const line of std.split('\n')) {
		const parts = line.trim().split(/\s+/);
		const yr = Number(parts[0]);
		if (!(yr >= 2012) || parts.length < 2) continue;
		parts.slice(1, 13).forEach((v, i) => {
			const n = Number(v);
			if (Number.isFinite(n) && n > -99) soi.set(`${yr}-${String(i + 1).padStart(2, '0')}`, n);
		});
	}
	const yms = [...new Set([...oni.keys(), ...soi.keys()])].sort();
	writeCsv(
		'climate-monthly.csv',
		['ym', 'oni', 'soi'],
		yms.map((ym) => [ym, fmt(oni.get(ym)), fmt(soi.get(ym))])
	);
}

/** Great-circle distance in km. */
function km(lat1, lon1, lat2, lon2) {
	const r = Math.PI / 180;
	const a =
		Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
		Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
	return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Chlorophyll-a offshore of Moorea (#23): NOAA S-NPP VIIRS science-quality weekly composites
 * (4 km, NOAA STAR and CoastWatch), a productivity proxy. Pixels beside small islands are
 * unreliable (land in the pixel, the lagoon floor showing through, haze off the land), so each
 * week is the median of an offshore ring: ocean pixels within 30 km of Moorea's centre and at
 * least 10 km from any land or coast pixel, Tahiti's included. A land or coast pixel is one with
 * no value in more than half of the weeks (coastal pixels get a value now and then, open ocean
 * in about four weeks out of five). Weeks with fewer than 10 cloud-free ring pixels are blank.
 */
async function chlorophyll() {
	const base = 'https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPVIIRSSQchlaWeekly.csv';
	const [cLat, cLon] = [-17.535, -149.835];
	const box = '%5B(0.0)%5D%5B(-17.20):1:(-17.85)%5D%5B(-150.15):1:(-149.50)%5D';
	const cells = new Map(); // "lat|lon" → [lat, lon]
	const weeks = new Map(); // date → Map("lat|lon" → mg m⁻³)
	const all = chunks('2013-07-28', daysAgo(0));
	for (const [s, e] of all) {
		// Science-quality weeks lag by a month or more, so the last chunk ends at `last`, and in
		// January it may have no weeks yet. Any other failure keeps the old file.
		const final = e === all[all.length - 1][1];
		let text;
		try {
			text = await get(
				`${base}?chlor_a%5B(${s}T00:00:00Z):1:(${final ? 'last' : `${e}T23:59:59Z`})%5D${box}`,
				{ retry404: !final }
			);
		} catch (err) {
			if (!final || err.status !== 404) throw err;
			console.warn(`[external] chlorophyll ${s}…: ${err.message}`);
			continue;
		}
		for (const line of text.trim().split('\n').slice(2)) {
			const [time, , lat, lon, chl] = line.split(',');
			const key = `${lat}|${lon}`;
			cells.set(key, [Number(lat), Number(lon)]);
			const week = weeks.get(time.slice(0, 10)) ?? new Map();
			const v = Number(chl);
			if (Number.isFinite(v) && v > 0) week.set(key, v);
			weeks.set(time.slice(0, 10), week);
		}
		await sleep(1000);
	}
	const valid = new Map();
	for (const w of weeks.values()) for (const k of w.keys()) valid.set(k, (valid.get(k) ?? 0) + 1);
	const isLand = (k) => (valid.get(k) ?? 0) < weeks.size / 2;
	const land = [...cells].filter(([k]) => isLand(k)).map(([, c]) => c);
	const ring = new Set(
		[...cells]
			.filter(
				([k, [lat, lon]]) =>
					!isLand(k) &&
					km(lat, lon, cLat, cLon) <= 30 &&
					land.every(([a, b]) => km(lat, lon, a, b) >= 10)
			)
			.map(([k]) => k)
	);
	// The grid or the land mask changing upstream would quietly move the ring: fail instead.
	if (ring.size < 40 || land.length < 5)
		throw new Error(`chlorophyll: ring of ${ring.size} pixels, ${land.length} land pixels`);
	console.log(`[external] chlorophyll ring: ${ring.size} pixels (${land.length} land pixels)`);
	const median = (xs) => {
		const s = [...xs].sort((a, b) => a - b);
		const m = s.length >> 1;
		return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
	};
	const rows = [...weeks.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, w]) => {
			const vals = [...w].filter(([k]) => ring.has(k)).map(([, v]) => v);
			return [date, vals.length >= 10 ? fmt(median(vals), 4) : '', String(vals.length)];
		});
	writeCsv('chlorophyll-weekly.csv', ['date', 'chl', 'pixels'], rows);
}

/** Tropical cyclone track points within 750 km of Moorea since START (IBTrACS, 3-hourly, UTC). */
async function cyclones() {
	console.log('[external] cyclones (IBTrACS South Pacific)');
	const text = await get(
		'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.SP.list.v04r01.csv'
	);
	const lines = text.split(/\r?\n/);
	const head = lines[0].split(',');
	const col = (name) => head.indexOf(name);
	const [iSid, iName, iTime, iLat, iLon, iWmo, iUsa, iPres] = [
		'SID',
		'NAME',
		'ISO_TIME',
		'LAT',
		'LON',
		'WMO_WIND',
		'USA_WIND',
		'WMO_PRES'
	].map(col);
	const num = (s) => (s == null || s.trim() === '' ? null : Number(s));
	const rows = [];
	// Line 1 is units; data start on line 2.
	for (const line of lines.slice(2)) {
		if (!line) continue;
		const c = line.split(',');
		const time = c[iTime];
		if (!time || time.slice(0, 10) < START) continue;
		const lat = num(c[iLat]);
		const lon = num(c[iLon]);
		if (lat == null || lon == null) continue;
		const d = km(LAT, LON, lat, lon);
		if (d > 750) continue;
		const wind = num(c[iWmo]) ?? num(c[iUsa]);
		rows.push([
			c[iSid],
			(c[iName] || 'UNNAMED').replace(/,/g, ' '),
			time.replace(' ', 'T') + 'Z',
			fmt(lat, 2),
			fmt(lon, 2),
			fmt(wind, 0),
			fmt(num(c[iPres]), 0),
			fmt(d, 0)
		]);
	}
	writeCsv(
		'cyclones.csv',
		['sid', 'name', 'time', 'lat', 'lon', 'wind_kt', 'pres_hpa', 'dist_km'],
		rows
	);
	console.log(`[external] cyclones: ${rows.length} track points`);
}

/**
 * French Polynesia school holidays before 2017-18, transcribed from the Council of Ministers'
 * orders (arrêtés) for collèges and lycées, archived from education.pf by the Wayback Machine:
 * https://web.archive.org/web/2017/http://education.pf/des.pf.old/fichiers_des/Calendriers/
 * Dates are the first and last day off; the orders say "from <last school day> after classes
 * to <last day off>". Lone Saturdays without morning classes (2 and 9 May 2015) are left out.
 */
const ARCHIVED_SCHOOL_HOLIDAYS = [
	// 2013-14: arrêté 332/CM of 17 March 2011, amended by 0270/CM of 28 February 2013 (September
	// and summer); the other breaks are read from the amended calendar published with it.
	['2013-2014', 'September break', '2013-09-15', '2013-09-29', 'arrêté 0270/CM 2013'],
	['2013-2014', 'November break', '2013-11-01', '2013-11-10', 'arrêté 0270/CM 2013'],
	['2013-2014', 'Christmas break', '2013-12-15', '2014-01-12', 'arrêté 0270/CM 2013'],
	['2013-2014', 'February break', '2014-02-16', '2014-02-23', 'arrêté 0270/CM 2013'],
	['2013-2014', 'Easter break', '2014-03-30', '2014-04-13', 'arrêté 0270/CM 2013'],
	['2013-2014', 'Summer holidays', '2014-06-29', '2014-08-12', 'arrêté 0270/CM 2013'],
	// 2014-15: arrêté 0399/CM of 12 March 2014.
	['2014-2015', 'September break', '2014-09-21', '2014-09-28', 'arrêté 0399/CM 2014'],
	['2014-2015', 'November break', '2014-11-01', '2014-11-11', 'arrêté 0399/CM 2014'],
	['2014-2015', 'Christmas break', '2014-12-14', '2015-01-11', 'arrêté 0399/CM 2014'],
	['2014-2015', 'February break', '2015-02-15', '2015-02-22', 'arrêté 0399/CM 2014'],
	['2014-2015', 'Easter break', '2015-03-29', '2015-04-12', 'arrêté 0399/CM 2014'],
	['2014-2015', 'May break', '2015-05-14', '2015-05-17', 'arrêté 0399/CM 2014'],
	['2014-2015', 'Summer holidays', '2015-06-26', '2015-08-11', 'arrêté 0399/CM 2014'],
	// 2015-16: arrêté 0401/CM of 12 March 2014.
	['2015-2016', 'September break', '2015-09-20', '2015-09-27', 'arrêté 0401/CM 2014'],
	['2015-2016', 'November break', '2015-11-01', '2015-11-08', 'arrêté 0401/CM 2014'],
	['2015-2016', 'Christmas break', '2015-12-13', '2016-01-10', 'arrêté 0401/CM 2014'],
	['2015-2016', 'February break', '2016-02-14', '2016-02-21', 'arrêté 0401/CM 2014'],
	['2015-2016', 'Easter break', '2016-03-25', '2016-04-10', 'arrêté 0401/CM 2014'],
	['2015-2016', 'May break', '2016-05-05', '2016-05-08', 'arrêté 0401/CM 2014'],
	['2015-2016', 'Summer holidays', '2016-06-23', '2016-08-09', 'arrêté 0401/CM 2014'],
	// 2016-17: arrêté 0403/CM of 12 March 2014.
	['2016-2017', 'September break', '2016-09-18', '2016-09-25', 'arrêté 0403/CM 2014'],
	['2016-2017', 'November break', '2016-10-30', '2016-11-06', 'arrêté 0403/CM 2014'],
	['2016-2017', 'November break', '2016-11-11', '2016-11-13', 'arrêté 0403/CM 2014'],
	['2016-2017', 'Christmas break', '2016-12-11', '2017-01-08', 'arrêté 0403/CM 2014'],
	['2016-2017', 'February break', '2017-02-12', '2017-02-19', 'arrêté 0403/CM 2014'],
	['2016-2017', 'Easter break', '2017-03-26', '2017-04-09', 'arrêté 0403/CM 2014'],
	['2016-2017', 'Easter break', '2017-04-14', '2017-04-17', 'arrêté 0403/CM 2014'],
	['2016-2017', 'May break', '2017-05-25', '2017-05-28', 'arrêté 0403/CM 2014'],
	['2016-2017', 'Summer holidays', '2017-06-22', '2017-08-08', 'arrêté 0403/CM 2014']
];

const SCHOOL_BREAK_NAMES = {
	'Vacances de Septembre': 'September break',
	'Vacances de Novembre': 'November break',
	'Vacances de Noël': 'Christmas break',
	'Vacances de Février': 'February break',
	'Vacances de Pâques': 'Easter break',
	'Vacances de Mai': 'May break',
	'Grandes Vacances': 'Summer holidays'
};

/**
 * Known slips in the national dataset: [school year, break, field, wrong date, right date]. The
 * 2023 November break "starts" on 28 September, inside the September break; every other year it
 * starts on the Saturday about two weeks before classes resume in November.
 */
const SCHOOL_ERRATA = [['2023-2024', 'November break', 'start', '2023-09-28', '2023-10-28']];

/** Local calendar date in Paris (the dataset's timestamps are Paris midnights in UTC). */
const parisDay = (ts) => new Date(ts).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/** School holidays since 2013-14: archived orders, then the Ministry's open data (Etalab 2.0). */
async function school() {
	console.log('[external] school holidays (archived orders + data.education.gouv.fr)');
	// The export endpoint returns every match (records/ stops at 100).
	const results = await get(
		'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/exports/json?' +
			new URLSearchParams({ where: 'location="Polynésie"', order_by: 'start_date' }),
		{ json: true }
	);
	// Pupils only: a day counts when pupils at either level are off. Teachers' dates are dropped.
	const merged = new Map();
	for (const r of results) {
		if (/^enseignants/i.test(r.population ?? '')) continue;
		const name = SCHOOL_BREAK_NAMES[r.description];
		// e.g. "Début des Grandes Vacances", a start-only marker for a year not yet fully set.
		if (!name) {
			console.warn(`[external] school holidays: skipped "${r.description}" ${r.annee_scolaire}`);
			continue;
		}
		const key = `${r.annee_scolaire}|${name}`;
		const start = parisDay(r.start_date);
		// end_date is the day classes resume.
		const end = isoDay(new Date(Date.parse(`${parisDay(r.end_date)}T00:00:00Z`) - 86_400_000));
		const m = merged.get(key);
		if (m) {
			m[2] = start < m[2] ? start : m[2];
			m[3] = end > m[3] ? end : m[3];
		} else merged.set(key, [r.annee_scolaire, name, start, end, 'data.education.gouv.fr']);
	}
	for (const [year, name, field, wrong, right] of SCHOOL_ERRATA) {
		const m = merged.get(`${year}|${name}`);
		const i = field === 'start' ? 2 : 3;
		if (m?.[i] === wrong) m[i] = right;
	}
	const firstYear = '2017-2018';
	const rows = [
		...ARCHIVED_SCHOOL_HOLIDAYS,
		...[...merged.values()].filter((r) => r[0] >= firstYear)
	].sort((a, b) => a[2].localeCompare(b[2]));
	// Breaks must not overlap or run backwards: a typo upstream would otherwise go unnoticed.
	for (let i = 0; i < rows.length; i++) {
		const [year, name, start, end] = rows[i];
		if (end < start || (i > 0 && start <= rows[i - 1][3]))
			throw new Error(`school holidays: ${year} ${name} ${start}–${end} overlaps or is reversed`);
	}
	writeCsv('school-holidays.csv', ['school_year', 'name', 'start', 'end', 'source'], rows);
}

const jobs = {
	weather,
	...(only.includes('oisst') ? { oisst } : {}),
	ocean,
	chlorophyll,
	tide,
	climate,
	cyclones,
	school
};
const selected = Object.fromEntries(
	Object.entries(jobs)
		.filter(([name]) => want(name))
		.map(([name, job]) => [
			name,
			async (write) => {
				writeSnapshot = write;
				await job();
			}
		])
);
const failed = await refreshJobs(OUT, selected);
if (process.env.GITHUB_STEP_SUMMARY) {
	appendFileSync(
		process.env.GITHUB_STEP_SUMMARY,
		`## Environmental refresh\n\n${Object.keys(selected)
			.map(
				(name) =>
					`- ${name}: ${failed.includes(name) ? 'FAILED — retained previous snapshot; see fetch log' : 'refreshed'}`
			)
			.join('\n')}\n`
	);
}
if (failed.length) process.exitCode = 1;
