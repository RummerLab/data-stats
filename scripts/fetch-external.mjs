#!/usr/bin/env node
/**
 * Fetch public environmental data for Moorea into external/ (#15–#20, #22).
 *
 *   node scripts/fetch-external.mjs            # everything since 2013-08-01
 *   node scripts/fetch-external.mjs --only=tide,climate
 *
 * Sources (all free, no API key):
 * - Open-Meteo Historical Weather API (ERA5 / ERA5-Land reanalysis, CC BY 4.0)
 * - Open-Meteo Marine API with `models=era5_ocean` (waves, swell)
 * - NOAA OISST v2.1 daily SST via NOAA CoastWatch ERDDAP
 * - NOAA Coral Reef Watch 5 km daily heat stress via PacIOOS ERDDAP
 * - UHSLC fast-delivery hourly sea level, Papeete (station 015)
 * - NOAA CPC Oceanic Niño Index and Southern Oscillation Index
 *
 * Output files are small CSVs (hourly series gzipped) committed to the repo, so the app and CI
 * never need network access. No spreadsheet data is read or sent anywhere.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.EXTERNAL_DIR || join(root, 'external');
const START = '2013-08-01';
const LAT = -17.53;
const LON = -149.83;
const TZ = 'Pacific/Tahiti';
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const want = (name) => only.length === 0 || only.includes(name);

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86_400_000));

async function get(url, { json = false, tries = 5 } = {}) {
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(url, { headers: { 'user-agent': 'physioshark-data-stats (+https://github.com/RummerLab/data-stats)' } });
			if (res.ok) return json ? res.json() : res.text();
			if (res.status === 404) throw new Error(`404 ${url}`);
			console.warn(`[external] ${res.status} ${url}`);
		} catch (err) {
			if (String(err).includes('404')) throw err;
			console.warn(`[external] ${err.message ?? err}`);
		}
		await sleep(2000 * (i + 1) ** 2);
	}
	throw new Error(`failed: ${url}`);
}

/** Yearly [start, end] chunks between two ISO dates. */
function chunks(start, end) {
	const out = [];
	let y = Number(start.slice(0, 4));
	const endY = Number(end.slice(0, 4));
	for (; y <= endY; y++) {
		const s = y === Number(start.slice(0, 4)) ? start : `${y}-01-01`;
		const e = y === endY ? end : `${y}-12-31`;
		out.push([s, e]);
	}
	return out;
}

const fmt = (v, dp = 2) => (v == null || Number.isNaN(v) ? '' : String(Math.round(v * 10 ** dp) / 10 ** dp));

function writeCsv(name, header, rows, gzip = false) {
	const body = [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
	const path = join(OUT, gzip ? `${name}.gz` : name);
	writeFileSync(path, gzip ? gzipSync(body, { level: 9 }) : body);
	console.log(`[external] wrote ${path} (${rows.length} rows)`);
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
		await sleep(1500);
	}
	writeCsv(
		'weather-daily.csv',
		['date', 'tmax', 'tmin', 'tmean', 'precip', 'wind_max', 'gust_max', 'wind_dir', 'radiation', 'cloud', 'pressure', 'humidity', 'sunshine_h'],
		daily
	);
	writeCsv('weather-hourly.csv', ['ts', 'temp', 'precip', 'cloud', 'wind', 'wind_dir', 'gust', 'pressure'], hourly, true);
}

async function erddapSeries(base, dataset, vars, lat, lon, start, end, zlev = false) {
	const rows = new Map();
	for (const [s, e] of chunks(start, end)) {
		const sel = (v) =>
			`${v}%5B(${s}T12:00:00Z):1:(${e}T12:00:00Z)%5D${zlev ? '%5B(0.0)%5D' : ''}%5B(${lat})%5D%5B(${lon})%5D`;
		const url = `${base}/griddap/${dataset}.csv?${vars.map(sel).join(',')}`;
		let text;
		try {
			text = await get(url);
		} catch (err) {
			console.warn(`[external] ${dataset} ${s}…${e}: ${err.message}`);
			continue;
		}
		const lines = text.trim().split('\n').slice(2);
		const head = text.split('\n')[0].split(',');
		for (const line of lines) {
			const cols = line.split(',');
			const date = cols[0].slice(0, 10);
			const rec = rows.get(date) ?? {};
			for (const v of vars) {
				const val = Number(cols[head.indexOf(v)]);
				rec[v] = Number.isFinite(val) ? val : null;
			}
			rows.set(date, rec);
		}
		await sleep(1000);
	}
	return rows;
}

async function ocean() {
	const end = daysAgo(2);
	const oisst = await erddapSeries(
		'https://coastwatch.pfeg.noaa.gov/erddap',
		'ncdcOisst21Agg_LonPM180',
		['sst'],
		-17.625,
		-149.875,
		START,
		end,
		true
	);
	const crw = await erddapSeries(
		'https://pae-paha.pacioos.hawaii.edu/erddap',
		'dhw_5km',
		['CRW_SST', 'CRW_SSTANOMALY', 'CRW_HOTSPOT', 'CRW_DHW', 'CRW_BAA'],
		-17.475,
		-149.825,
		START,
		end
	);
	const waveVars = ['wave_height_max', 'wave_period_max', 'wave_direction_dominant', 'swell_wave_height_max'];
	const waves = new Map();
	for (const model of ['era5_ocean', 'best_match']) {
		const from = model === 'era5_ocean' ? START : '2021-10-01';
		for (const [s, e] of chunks(from, end)) {
			const url =
				`https://marine-api.open-meteo.com/v1/marine?latitude=${LAT + 0.06}&longitude=${LON}` +
				`&start_date=${s}&end_date=${e}&timezone=${encodeURIComponent(TZ)}` +
				`&daily=${waveVars.join(',')}${model === 'era5_ocean' ? '&models=era5_ocean' : ''}`;
			let j;
			try {
				j = await get(url, { json: true });
			} catch (err) {
				console.warn(`[external] waves ${model} ${s}: ${err.message}`);
				continue;
			}
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
		['date', 'oisst', 'crw_sst', 'crw_anom', 'crw_hotspot', 'crw_dhw', 'crw_baa', 'wave_max', 'wave_period', 'wave_dir', 'swell_max'],
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
	const seasons = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ'];
	for (const line of (await get('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt')).split('\n')) {
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
	writeCsv('climate-monthly.csv', ['ym', 'oni', 'soi'], yms.map((ym) => [ym, fmt(oni.get(ym)), fmt(soi.get(ym))]));
}

const jobs = { weather, ocean, tide, climate };
for (const [name, job] of Object.entries(jobs)) {
	if (!want(name)) continue;
	try {
		await job();
	} catch (err) {
		console.error(`[external] ${name} failed: ${err.message ?? err}`);
		process.exitCode = 1;
	}
}
