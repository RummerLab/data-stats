/** Load the environmental snapshots written by scripts/fetch-external.mjs (#15–#20). */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

export type Row = Record<string, string>;

export function readCsv(dir: string, name: string): Row[] {
	const plain = join(dir, name);
	const gz = `${plain}.gz`;
	let text: string;
	if (existsSync(plain)) text = readFileSync(plain, 'utf8');
	else if (existsSync(gz)) text = gunzipSync(readFileSync(gz)).toString('utf8');
	else return [];
	const lines = text.split(/\r?\n/).filter(Boolean);
	const header = lines[0].split(',');
	return lines.slice(1).map((line) => {
		const cols = line.split(',');
		const r: Row = {};
		header.forEach((h, i) => (r[h] = cols[i] ?? ''));
		return r;
	});
}

export const val = (s: string | undefined): number | null => {
	if (s == null || s === '') return null;
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
};

export const EXTERNAL_FILES = [
	'weather-daily.csv',
	'weather-hourly.csv.gz',
	'ocean-daily.csv',
	'chlorophyll-weekly.csv',
	'tide-papeete-hourly.csv.gz',
	'climate-monthly.csv',
	'cyclones.csv',
	'school-holidays.csv',
	'pressure-bouyoucos2024.csv'
];
