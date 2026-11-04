#!/usr/bin/env node
/**
 * Generate SYNTHETIC workbooks for tests, CI and the Docker smoke test (#63).
 * Every value is invented (deterministic pseudo-random); nothing comes from the real data.
 *
 *   node scripts/make-fixture.mjs   # writes samples/fixture/*.xlsx
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'samples', 'fixture');
mkdirSync(OUT, { recursive: true });

let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = (i) => {
	let s = '';
	for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
	return s;
};
const serial = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25_569;
/** Cell helpers: D = date, T = time (minutes), otherwise number or string. */
const D = (iso) => ({ d: serial(iso) });
const T = (min) => ({ t: min / 1440 });

function sheetXml(rows) {
	const body = rows
		.map((row, r) => {
			const cells = row
				.map((v, c) => {
					if (v == null) return '';
					const ref = `${col(c)}${r + 1}`;
					if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
					if (typeof v === 'object' && 'd' in v) return `<c r="${ref}" s="1"><v>${v.d}</v></c>`;
					if (typeof v === 'object' && 't' in v) return `<c r="${ref}" s="2"><v>${v.t}</v></c>`;
					return `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
				})
				.join('');
			return `<row r="${r + 1}">${cells}</row>`;
		})
		.join('');
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function workbook(file, sheets) {
	const names = Object.keys(sheets);
	const files = {
		'[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
		'_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
		'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
		'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
		'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="h:mm"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`
	};
	names.forEach((n, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(sheets[n])));
	const zipped = zipSync(
		Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))
	);
	writeFileSync(join(OUT, file), zipped);
	console.log(`[fixture] ${file}`);
}

// --- one synthetic season ---------------------------------------------------------------------
const SITES = ['Haapiti', 'Tiki', 'Vaiane', 'Papetoai', 'Maharepa'];
const CREW = ['Alex', 'Sam', 'Robin', 'Charlie', 'Jo'];
const setRows = [
	[
		'Set',
		'Site',
		'Visit',
		'Date',
		'Team',
		'Net In ',
		'Net Out ',
		'Time in ',
		'#Cm ',
		'#Na',
		'#Sharks',
		'CPUE Cm',
		'CPUE Na',
		'Tide ',
		'Notes'
	]
];
const cm = [
	[
		'Site ',
		'Set ',
		'Visit ',
		'Date ',
		'Shark No.',
		'Capture No.',
		'Tag No.',
		'Spp',
		'Age',
		'Sex ',
		'DNA Sample',
		'PCL (mm)',
		'FL (mm)',
		'TL (mm)',
		'Pec. Girth (mm)',
		'Dors. Girth (mm)',
		'Caud. Girth (mm)',
		'Mass (kg)',
		'Capture Time',
		'Release Time',
		'US',
		'Photo ',
		'Notes',
		'Gastic lavage',
		'Stomach content ',
		'Stomach sample type '
	]
];
const na = [cm[0].slice()];
const tags = [];
let shark = { Cm: 0, Na: 0 };
const visits = {};
for (let i = 0; i < 40; i++) {
	const site = SITES[i % SITES.length];
	visits[site] = (visits[site] ?? 0) + 1;
	const day = new Date(Date.UTC(2021, 8, 20) + i * 3 * 86_400_000).toISOString().slice(0, 10);
	const start = 17 * 60 + Math.floor(rand() * 30);
	const end = start + 150 + Math.floor(rand() * 40);
	let nCm = 0;
	let nNa = 0;
	const catches = Math.floor(rand() * 5);
	for (let k = 0; k < catches; k++) {
		const sp = site === 'Vaiane' && rand() < 0.6 ? 'Na' : 'Cm';
		const recap = tags.length > 5 && rand() < 0.15;
		const tag = recap ? pick(tags).tag : String(955000009000000 + tags.length);
		const tl = Math.round(sp === 'Cm' ? 540 + rand() * 90 : 620 + rand() * 90);
		const fl = Math.round(tl * 0.82);
		const mass = Math.round(3.2e-9 * tl ** 3.1 * (0.9 + rand() * 0.2) * 1000) / 1000;
		const open = i < 25 && rand() < 0.6;
		if (!recap) tags.push({ tag, sp });
		const species = recap ? tags.find((t) => t.tag === tag).sp : sp;
		const row = [
			site,
			i + 1,
			visits[site],
			D(day),
			++shark[species],
			recap ? 2 : 1,
			tag,
			species,
			open ? 'Neonate' : 'Juvenile',
			rand() < 0.5 ? 'F' : 'M',
			'Yes',
			Math.round(fl * 0.88),
			fl,
			tl,
			Math.round(tl * 0.36),
			Math.round(tl * 0.33),
			Math.round(tl * 0.12),
			mass,
			T(start + 20 + k * 25),
			T(start + 30 + k * 25),
			open ? 'Open' : 'Closed',
			'Yes',
			k === 0 && i % 7 === 0 ? 'Synthetic note: ray swimming along the net' : null,
			// Gastric lavage on every other blacktip (deterministic, so other values don't shift).
			...(species === 'Cm' && shark.Cm % 2 === 0
				? [
						'yes',
						['empty', 'traces of food', 'full'][shark.Cm % 3],
						shark.Cm % 3 === 2 ? 'small fish' : 'na'
					]
				: ['no', 'no sample', 'na'])
		];
		(species === 'Cm' ? cm : na).push(row);
		if (species === 'Cm') nCm++;
		else nNa++;
	}
	setRows.push([
		i + 1,
		site,
		visits[site],
		D(day),
		`${pick(CREW)}, ${pick(CREW)}`,
		T(start),
		T(end),
		T(end - start),
		nCm,
		nNa,
		nCm + nNa,
		null,
		null,
		pick(['Flooding', 'Ebbing']),
		i === 3 ? 'skunked' : null
	]);
}
workbook('Physioshark_Shark Log 2021-2022.xlsx', {
	'Set Log': setRows,
	'Cm Log Juv': cm,
	'Na Log Juv': na
});

workbook('Physioshark Moorea nursery location GPS.xlsx', {
	Sheet1: [
		['SITE', 'GPS Temp Logger #1', 'GPS Temp Logger #2', 'Latitude', 'Longitude'],
		['Haapiti', '', '', ` 17°33'15.12"S`, `149°52'46.13"W`],
		['Tiki', '', '', ` 17°31'5.05"S`, `149°54'44.96"W`],
		['Vaiane', '', '', ` 17°34'41.38"S`, `149°51'25.67"W`]
	]
});

// Temperature loggers (#10): one HOBO export (site in the file name, local time) and one
// EnvLogger export (UTC, placed by its download GPS). Invented serials and readings.
const LOG_DIR = join(OUT, 'loggers');
mkdirSync(LOG_DIR, { recursive: true });
const start = Date.UTC(2021, 8, 15, 17); // 15 Sep 2021 17:00 local
const hours = 24 * 96;
/** Smooth daily cycle, coolest near 06:00 and warmest near 14:00 local, plus a little noise. */
const tempAt = (localHour, base) =>
	Math.round(
		(base + 1.4 * Math.sin(((localHour - 8) / 24) * 2 * Math.PI) + (rand() - 0.5) * 0.3) * 1000
	) / 1000;
const pad = (n) => String(n).padStart(2, '0');
const hoboStamp = (ms) => {
	const d = new Date(ms);
	const h = d.getUTCHours();
	return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${String(d.getUTCFullYear()).slice(2)} ${pad(h % 12 || 12)}:00:00 ${h < 12 ? 'AM' : 'PM'}`;
};
const hobo = [
	'﻿"Plot Title: HOBO7"',
	'"#","Date Time, GMT-10:00","Temp, °C (LGR S/N: 90000007, SEN S/N: 90000007, LBL: Temp7)","Intensity, Lux (LGR S/N: 90000007, SEN S/N: 90000007, LBL: Light7)"'
];
for (let i = 0; i < hours; i++) {
	const ms = start + i * 3_600_000;
	const h = new Date(ms).getUTCHours();
	const lux = h >= 6 && h <= 18 ? Math.round(Math.sin(((h - 6) / 12) * Math.PI) * 20000) : 0;
	hobo.push(`${i + 1},${hoboStamp(ms)},${tempAt(h, 28.6)},${lux}`);
}
mkdirSync(join(LOG_DIR, 'HOBO 7'), { recursive: true });
writeFileSync(
	join(LOG_DIR, 'HOBO 7', 'HOBO7_Sep21 - Dec21_Haapiti.csv'),
	hobo.join('\r\n') + '\r\n'
);

const env = [
	'------------------------------,--------------------',
	'www.electricblue.eu, Portugal',
	'------------------------------,--------------------',
	'EnvLogger version, T2.4',
	'serial number, 0F1E 2D3C 4B5A 69',
	'custom name, Tiki 1',
	'temperature, degrees Celsius',
	'time zone, UTC+0000',
	'sampling resolution, 0.1',
	`samples, ${hours}`,
	'lat, -17.518100',
	'long, -149.912500',
	'accuracy (m), 4.7',
	'------------------------------,--------------------',
	'time,temp'
];
for (let i = 0; i < hours; i++) {
	const local = start + i * 3_600_000;
	const utc = new Date(local + 10 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
	const h = new Date(local).getUTCHours();
	env.push(`${utc},${i === 100 ? 'NA' : i === 200 ? '45.0' : tempAt(h, 28.2).toFixed(1)}`);
}
mkdirSync(join(LOG_DIR, '2021-12-20'), { recursive: true });
writeFileSync(
	join(LOG_DIR, '2021-12-20', '0F1E 2D3C 4B5A 69-20211220 101500.csv'),
	env.join('\n') + '\n'
);

// --- a second, larger synthetic season (#153) -------------------------------------------------
// The catch model needs at least 200 complete sets over two seasons, from nurseries with at least
// 30 sets each, and its species models need two nurseries with at least 10 of that species. One
// set a night for 200 nights covers all five sites 40 times; lemons turn up at Vaiane and Haapiti.
// Its own random stream, so the 2021-22 workbook and the loggers above stay exactly as they were.
{
	let seed2 = 153;
	const rand2 = () => (seed2 = (seed2 * 1103515245 + 12345) % 2147483648) / 2147483648;
	const pick2 = (xs) => xs[Math.floor(rand2() * xs.length)];
	const sets2 = [setRows[0].slice()];
	const cm2 = [cm[0].slice()];
	const na2 = [cm[0].slice()];
	const tags2 = [];
	const count = { Cm: 0, Na: 0 };
	const visits2 = {};
	const LEMONS = { Vaiane: 0.6, Haapiti: 0.4 };
	for (let i = 0; i < 200; i++) {
		const site = SITES[i % SITES.length];
		visits2[site] = (visits2[site] ?? 0) + 1;
		const day = new Date(Date.UTC(2022, 8, 1) + i * 86_400_000).toISOString().slice(0, 10);
		const start = 17 * 60 + Math.floor(rand2() * 40);
		const end = start + 140 + Math.floor(rand2() * 60);
		// Clumped like real catches (mostly quiet nights, a few busy ones, so θ stays finite), and
		// busy nights get rarer as the season goes on, so the day-of-season curve has a trend.
		const busy = rand2() < (i < 100 ? 0.3 : 0.15);
		const catches = busy ? 3 + Math.floor(rand2() * 7) : Math.floor(rand2() * 3);
		let nCm = 0;
		let nNa = 0;
		for (let k = 0; k < catches; k++) {
			const sp = rand2() < (LEMONS[site] ?? 0) ? 'Na' : 'Cm';
			// Recaptures keep their species and sex and grow about 0.3 mm a day, so this season adds
			// no identity conflicts to the Data quality page (2021-22 keeps its handful).
			const recap = tags2.length > 10 && rand2() < 0.15;
			const prev = recap ? pick2(tags2) : null;
			const species = prev ? prev.sp : sp;
			const tl = prev
				? prev.tl + Math.round(0.3 * (i - prev.i))
				: Math.round(species === 'Cm' ? 540 + rand2() * 90 : 620 + rand2() * 90);
			const sex = prev ? prev.sex : rand2() < 0.5 ? 'F' : 'M';
			const tag = prev ? prev.tag : String(955000009100000 + tags2.length);
			if (prev) Object.assign(prev, { tl, i });
			else tags2.push({ tag, sp, sex, tl, i });
			const fl = Math.round(tl * 0.82);
			const mass = Math.round(3.2e-9 * tl ** 3.1 * (0.9 + rand2() * 0.2) * 1000) / 1000;
			const open = i < 120 && rand2() < 0.5;
			(species === 'Cm' ? cm2 : na2).push([
				site,
				i + 1,
				visits2[site],
				D(day),
				++count[species],
				recap ? 2 : 1,
				tag,
				species,
				open ? 'Neonate' : 'Juvenile',
				sex,
				'Yes',
				Math.round(fl * 0.88),
				fl,
				tl,
				Math.round(tl * 0.36),
				Math.round(tl * 0.33),
				Math.round(tl * 0.12),
				mass,
				T(start + 20 + k * 25),
				T(start + 30 + k * 25),
				open ? 'Open' : 'Closed',
				'Yes',
				null,
				'no',
				'no sample',
				'na'
			]);
			if (species === 'Cm') nCm++;
			else nNa++;
		}
		sets2.push([
			i + 1,
			site,
			visits2[site],
			D(day),
			`${pick2(CREW)}, ${pick2(CREW)}, ${pick2(CREW)}`,
			T(start),
			T(end),
			T(end - start),
			nCm,
			nNa,
			nCm + nNa,
			null,
			null,
			pick2(['Flooding', 'Ebbing']),
			null
		]);
	}
	workbook('Physioshark_Shark Log 2022-2023.xlsx', {
		'Set Log': sets2,
		'Cm Log Juv': cm2,
		'Na Log Juv': na2
	});
}
