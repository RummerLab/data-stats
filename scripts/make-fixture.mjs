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
		'Notes'
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
			k === 0 && i % 7 === 0 ? 'Synthetic note: ray swimming along the net' : null
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
