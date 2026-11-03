import { describe, expect, it } from 'vitest';
import {
	cleanFile,
	compareSeries,
	envDate,
	hoboDate,
	hourIso,
	normalSerial,
	parseLoggerCsv,
	type LoggerFile
} from './loggers';

// Synthetic exports in each layout seen in the field (values invented).
const enc = (s: string) => new TextEncoder().encode(s);
const iso = (min: number) => hourIso(min / 60);

const HOBO_EN = [
	'﻿"Plot Title: HOBO3"',
	'"#","Date Time, GMT-10:00","Temp, °C (LGR S/N: 123, SEN S/N: 123, LBL: Temp3)","Intensity, Lux (LGR S/N: 123, SEN S/N: 123, LBL: Light3)","End Of File (LGR S/N: 123)"',
	'1,11/26/15 05:00:00 PM,29.953,538.2,',
	'2,11/26/15 05:10:00 PM,29.452,505.9,',
	'3,11/27/15 12:00:00 AM,28.100,0.0,',
	'4,11/27/15 12:05:00 AM,,,Logged'
].join('\r\n');

const HOBO_FR = [
	'﻿"Titre de tracé : HOBO10"',
	'"#","Date Heure, GMT+10:00","Temp., °C (LGR S/N: 456, SEN S/N: 456, LBL: Temp10)","Intensité, Lux (LGR S/N: 456, SEN S/N: 456, LBL: Light10)"',
	'1,11/26/15 05:00:00 PM,29.953,538.2'
].join('\r\n');

const HOBO_TAB = [
	'Plot Title: HOBO7\t\t\t',
	'#\t"Date Time, GMT-10:00"\t"Temp, °C (LGR S/N: 789, SEN S/N: 789, LBL: Temp7)"\t"Intensity, Lux (LGR S/N: 789)"',
	'1\t3/2/2018 19:00\t27.961\t0',
	'2\t3/2/2018 19:10\t27.468\t10.8'
].join('\n');

const ENV_UTC = [
	'------------------------------,--------------------',
	'www.electricblue.eu, Portugal',
	'serial number, 0F1E 2D3C 4B5A 69',
	'custom name, Tiki 1',
	'time zone, UTC+0000',
	'lat, -17.518100',
	'long, -149.912500',
	'time,temp',
	'2021-09-16 03:00:00,29.2',
	'2021-09-16 04:00:00,NA',
	'2021-09-16 05:00:00,28.6'
].join('\n');

const ENV_LOCAL = [
	'---------------------------------',
	'www.electricblue.eu',
	'serial number, 0A1B 2C3D 4E5F 60',
	'custom name, ',
	'time zone, UTC-1000',
	'lat, 17.574035',
	'long, 149.863097',
	'time,temp',
	'2019-11-21 15:00:13,33.5'
].join('\n');

describe('logger CSV parsing', () => {
	it('reads English HOBO exports as local time and skips event rows', () => {
		const f = parseLoggerCsv(
			enc(HOBO_EN),
			'x/HOBO 3/HOBO3b_Nov15 - Apr16_Haapiti.csv'
		) as LoggerFile;
		expect(f.system).toBe('HOBO');
		expect(f.logger).toBe('3b');
		expect(f.hoboNo).toBe(3);
		expect(f.serial).toBe('123');
		expect(f.siteHint).toBe('Haapiti');
		expect(f.v).toEqual([29.953, 29.452, 28.1]);
		expect(iso(f.t[0])).toBe('2015-11-26T17:00');
		expect(iso(f.t[2])).toBe('2015-11-27T00:00');
		expect(f.tzLabel).toBe('-10:00');
	});

	it('reads French and tab-separated HOBO exports', () => {
		const fr = parseLoggerCsv(enc(HOBO_FR), 'HOBO10_Nov15 - Apr16.csv') as LoggerFile;
		expect(fr.logger).toBe('10');
		expect(fr.tzLabel).toBe('+10:00');
		expect(iso(fr.t[0])).toBe('2015-11-26T17:00');
		const tab = parseLoggerCsv(enc(HOBO_TAB), 'HOBO7_Oct18 - Feb19.csv') as LoggerFile;
		expect(tab.v).toEqual([27.961, 27.468]);
		expect(iso(tab.t[1])).toBe('2018-03-02T19:10');
	});

	it('converts EnvLogger UTC exports to Moorea time and drops NA', () => {
		const f = parseLoggerCsv(enc(ENV_UTC), 'a/0F1E 2D3C 4B5A 69-20211220 101500.csv') as LoggerFile;
		expect(f.system).toBe('EnvLogger');
		expect(f.serial).toBe('0F1E 2D3C 4B5A 69');
		expect(f.siteHint).toBe('Tiki 1');
		expect(f.v).toEqual([29.2, 28.6]);
		expect(iso(f.t[0])).toBe('2021-09-15T17:00');
		expect(f.lat).toBeCloseTo(-17.5181, 4);
	});

	it('keeps UTC-1000 times, restores missing minus signs and falls back to the file name', () => {
		const f = parseLoggerCsv(
			enc(ENV_LOCAL),
			'b/PIAENA_2_0A1B 2C3D 4E5F 60-20200130 121738.csv'
		) as LoggerFile;
		expect(iso(f.t[0])).toBe('2019-11-21T15:00');
		expect(f.lat).toBeCloseTo(-17.574, 3);
		expect(f.lon).toBeCloseTo(-149.863, 3);
		expect(f.siteHint).toBe('PIAENA');
	});

	it('skips app logs, empty downloads and unknown CSVs', () => {
		expect(parseLoggerCsv(enc('time, action, id\n2022-11-03,TAP LOGGER,x'), 'log.csv')).toEqual({
			skip: 'app-log'
		});
		expect(parseLoggerCsv(enc(ENV_UTC.split('time,temp')[0] + 'time,temp\n'), 'e.csv')).toEqual({
			skip: 'empty'
		});
		expect(parseLoggerCsv(enc('a,b\n1,2'), 'other.csv')).toEqual({ skip: 'unknown' });
	});

	it('parses dates and serials', () => {
		expect(hoboDate('12/01/16 12:30:00 PM')).toBe(Date.UTC(2016, 11, 1, 12, 30) / 60_000);
		expect(hoboDate('13/01/16 12:30')).toBeNull();
		expect(envDate('2022-11-03 05:00:00', -600)).toBe(Date.UTC(2022, 10, 3, 5) / 60_000);
		expect(normalSerial('O472-EF00-482F-OE')).toBe('0472 EF00 482F 0E');
		expect(normalSerial('nope')).toBeNull();
	});
});

describe('logger cleaning', () => {
	const file = (t: number[], v: number[]): LoggerFile => ({
		file: 'f.csv',
		system: 'EnvLogger',
		logger: 'S',
		hoboNo: null,
		serial: 'S',
		siteHint: null,
		lat: null,
		lon: null,
		t,
		v,
		tzLabel: null
	});

	it('trims deployment edges, drops implausible and duplicate readings', () => {
		const t = Array.from({ length: 10 }, (_, i) => i * 60);
		const v = [40.5, 30, 28, 45, 28, 28, 28, 28, 29, 41];
		const seen = new Map<string, Set<number>>();
		const a = cleanFile(file(t, v), seen);
		// 2 h trimmed at each end, one reading above the plausible range.
		expect(a.stats).toEqual({ kept: 5, trimmed: 4, implausible: 1, duplicate: 0 });
		const b = cleanFile(file(t, v), seen);
		expect(b.stats.kept).toBe(0);
		expect(b.stats.duplicate).toBe(5);
	});
});

describe('cross-checking a logger against the lagoon', () => {
	// 20 synthetic days: a daily cycle peaking at 14:00 plus a slow drift.
	const series = (shift: number, f: (h: number) => number) =>
		new Map(Array.from({ length: 480 }, (_, h) => [h + shift, f(h)]));
	const lagoon = (h: number) => 28 + 1.5 * Math.sin(((h % 24) - 8) * (Math.PI / 12)) + h / 400;

	it('finds no offset for a logger in step with the reference', () => {
		const cmp = compareSeries(series(0, lagoon), series(0, lagoon))!;
		expect(cmp.lag).toBe(0);
		expect(cmp.r0).toBeCloseTo(1, 6);
	});

	it('finds a clock that runs 5 h late', () => {
		const cmp = compareSeries(series(-5, lagoon), series(0, lagoon))!;
		expect(cmp.lag).toBe(5);
		expect(cmp.r).toBeGreaterThan(cmp.r0 + 0.05);
	});

	it('scores a logger that ignores the daily cycle poorly', () => {
		const flat = (h: number) => 30 + ((h * 7919) % 13) / 10;
		const cmp = compareSeries(series(0, flat), series(0, lagoon))!;
		expect(cmp.r).toBeLessThan(0.5);
	});

	it('needs ten days of overlap', () => {
		expect(compareSeries(series(0, lagoon), series(300, lagoon))).toBeNull();
	});
});
