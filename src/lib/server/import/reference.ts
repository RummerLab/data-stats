/**
 * Reference workbooks (#5, #6): nursery logger GPS, the anthropogenic pressure ranking digitised
 * from Bouyoucos et al. (2024) and the 2025-26 adult blacktip capture datasheet.
 */
import { cell, mapColumns, type Matcher } from './columns';
import type { IssueLog } from './issues';
import { dateOf, dmsToDecimal, durationOf, int, num, sexOf, str, text, timeOf } from './normalize';
import { resolveSite } from './sites';
import type { Workbook } from './xlsx';

const eq = (...names: string[]): Matcher => (k: string) => names.includes(k);

export interface SiteGps {
	siteId: string;
	lat: number;
	lon: number;
	retired: string | null;
}

export function parseNurseryGps(wb: Workbook, log: IssueLog, file: string): SiteGps[] {
	const sheet = wb.sheets[0];
	const out: SiteGps[] = [];
	for (const { r, cells } of sheet.rows.slice(1)) {
		const raw = str(cells[0]);
		const siteId = resolveSite(raw);
		if (!siteId) {
			if (raw) log.add('warning', 'sites', `GPS sheet: unknown site "${raw}"`, { file, sheet: sheet.name, row: r });
			continue;
		}
		const lat = dmsToDecimal(cells[3], true);
		const lon = dmsToDecimal(cells[4], true);
		if (lat == null || lon == null) continue;
		const retired = raw?.match(/\(([^)]*(retired|no longer)[^)]*)\)/i)?.[1] ?? null;
		out.push({ siteId, lat: -Math.abs(lat), lon: -Math.abs(lon), retired });
	}
	return out;
}

export interface SitePressure {
	siteId: string;
	fishingEffort: number | null;
	humanImpact: number | null;
	artificialisation: number | null;
	composite: number | null;
	tier: string | null;
}

export function parsePressure(wb: Workbook, log: IssueLog, file: string): SitePressure[] {
	const sheet = wb.sheets.find((s) => /composite/i.test(s.name));
	if (!sheet) return [];
	const headerRow = sheet.rows.find((r) => str(r.cells[0])?.toLowerCase() === 'site');
	if (!headerRow) return [];
	const c = mapColumns(headerRow.cells, {
		site: [eq('site')],
		fishing: [eq('fishing effort')],
		human: [eq('direct human impact')],
		artif: [/^artificialisation/],
		composite: [/^composite 0/],
		tier: [eq('composite tier')]
	});
	const out: SitePressure[] = [];
	for (const { r, cells } of sheet.rows.filter((x) => x.r > headerRow.r)) {
		const raw = str(cell(cells, c.site));
		const siteId = resolveSite(raw);
		if (!siteId) {
			if (raw) log.add('warning', 'sites', `Pressure sheet: unknown site "${raw}"`, { file, sheet: sheet.name, row: r });
			continue;
		}
		out.push({
			siteId,
			fishingEffort: num(cell(cells, c.fishing)),
			humanImpact: num(cell(cells, c.human)),
			artificialisation: num(cell(cells, c.artif)),
			composite: num(cell(cells, c.composite)),
			tier: str(cell(cells, c.tier))
		});
	}
	return out;
}

export interface AdultCapture {
	sharkId: string | null;
	date: string | null;
	name: string | null;
	hookedMin: number | null;
	boatMin: number | null;
	releasedMin: number | null;
	fightMin: number | null;
	handlingMin: number | null;
	lat: number | null;
	lon: number | null;
	site: string | null;
	sex: 'M' | 'F' | null;
	maturity: string | null;
	reproCode: string | null;
	pclMm: number | null;
	flMm: number | null;
	tlMm: number | null;
	pecGirthMm: number | null;
	dorsGirthMm: number | null;
	caudGirthMm: number | null;
	clasperInner: number | null;
	clasperOuter: number | null;
	sperm: string | null;
	ultrasound: string | null;
	pregnant: string | null;
	blood1Min: number | null;
	lact1: number | null;
	gluc1: number | null;
	bhb1: number | null;
	blood2Min: number | null;
	lact2: number | null;
	gluc2: number | null;
	bhb2: number | null;
	tagged: string | null;
	bait: string | null;
	comments: string | null;
	ref: { file: string; sheet: string; row: number };
}

export interface AdultEffort {
	date: string | null;
	session: string | null;
	baitInMin: number | null;
	baitOutMin: number | null;
	soakMin: number | null;
	sharkTimes: number[];
	nSharks: number | null;
	comments: string | null;
}

const yn = (v: unknown) => {
	const s = str(v as never)?.toUpperCase();
	return s === 'Y' || s === 'YES' ? 'Y' : s === 'N' || s === 'NO' ? 'N' : null;
};

export function parseAdults(
	wb: Workbook,
	file: string
): { captures: AdultCapture[]; effort: AdultEffort[] } {
	const captures: AdultCapture[] = [];
	const cap = wb.sheets.find((s) => /capture/i.test(s.name));
	if (cap) {
		const h = cap.rows[0].cells;
		const c = mapColumns(h, {
			id: [eq('shark id')],
			date: [eq('date')],
			name: [eq('shark name')],
			hooked: [eq('time hooked')],
			boat: [eq('time at boat')],
			released: [eq('time released')],
			duration: [/^duration/],
			lat: [eq('lat')],
			lon: [eq('long', 'lon')],
			site: [eq('site name')],
			sex: [eq('sex')],
			maturity: [eq('maturity')],
			code: [/^maturity repro code/],
			pcl: [/^length pc/],
			fl: [/^length fl/],
			tl: [/^length tl/],
			pec: [/^girth pec/],
			dors: [/^girth dorsal/],
			caud: [/^girth caudal/],
			rci: [/^right clasper inner/],
			rco: [/^right clasper outer/],
			sperm: [/^sperm/],
			us: [/^ultrasound/],
			preg: [/^pregnant/],
			b1: [/^blood time 1st/],
			l1: [/^lact 1st/],
			g1: [/^gluc 1st/],
			h1: [/^b hb 1st/],
			b2: [/^blood time 2nd/],
			l2: [/^lact 2nd/],
			g2: [/^gluc 2nd/],
			h2: [/^b hb 2nd/],
			finmount: [/^wc finmount serial/],
			bat: [/^bat id/],
			floy: [/^floy/],
			bait: [eq('bait')],
			comments: [eq('comments')]
		});
		const cm = (v: number | null) => (v == null ? null : Math.round(v * 10 * 10) / 10);
		for (const { r, cells } of cap.rows.slice(1)) {
			const date = dateOf(cell(cells, c.date));
			if (!date) continue;
			const hooked = timeOf(cell(cells, c.hooked));
			const boat = timeOf(cell(cells, c.boat));
			const released = timeOf(cell(cells, c.released));
			const tags = [cell(cells, c.finmount), cell(cells, c.bat), cell(cells, c.floy)]
				.map((v) => str(v))
				.filter((v) => v && !/^n\/?a$/i.test(v));
			captures.push({
				sharkId: str(cell(cells, c.id)),
				date,
				name: str(cell(cells, c.name)),
				hookedMin: hooked,
				boatMin: boat,
				releasedMin: released,
				fightMin: hooked != null && boat != null ? boat - hooked : null,
				handlingMin: boat != null && released != null ? released - boat : durationOf(cell(cells, c.duration)),
				lat: num(cell(cells, c.lat)),
				lon: num(cell(cells, c.lon)),
				site: str(cell(cells, c.site)),
				sex: sexOf(cell(cells, c.sex)),
				maturity: str(cell(cells, c.maturity)),
				reproCode: str(cell(cells, c.code)),
				pclMm: cm(num(cell(cells, c.pcl))),
				flMm: cm(num(cell(cells, c.fl))),
				tlMm: cm(num(cell(cells, c.tl))),
				pecGirthMm: cm(num(cell(cells, c.pec))),
				dorsGirthMm: cm(num(cell(cells, c.dors))),
				caudGirthMm: cm(num(cell(cells, c.caud))),
				clasperInner: num(cell(cells, c.rci)),
				clasperOuter: num(cell(cells, c.rco)),
				sperm: yn(cell(cells, c.sperm)),
				ultrasound: yn(cell(cells, c.us)),
				pregnant: yn(cell(cells, c.preg)),
				blood1Min: timeOf(cell(cells, c.b1)),
				lact1: num(cell(cells, c.l1)),
				gluc1: num(cell(cells, c.g1)),
				bhb1: num(cell(cells, c.h1)),
				blood2Min: timeOf(cell(cells, c.b2)),
				lact2: num(cell(cells, c.l2)),
				gluc2: num(cell(cells, c.g2)),
				bhb2: num(cell(cells, c.h2)),
				tagged: tags.length ? tags.join(', ') : null,
				bait: text(cell(cells, c.bait)),
				comments: text(cell(cells, c.comments)),
				ref: { file, sheet: cap.name, row: r }
			});
		}
	}

	const effort: AdultEffort[] = [];
	const eff = wb.sheets.find((s) => /effort/i.test(s.name));
	if (eff) {
		const h = eff.rows[0].cells;
		const c = mapColumns(h, {
			date: [eq('date')],
			session: [eq('session')],
			inn: [/^time hook bait in/],
			out: [/^time hook bait out/],
			total: [/^total no sharks/],
			comments: [eq('comments')]
		});
		const sharkCols = h.map((x, i) => (/shark on/i.test(String(x ?? '')) ? i : -1)).filter((i) => i >= 0);
		for (const { cells } of eff.rows.slice(1)) {
			const date = dateOf(cell(cells, c.date));
			if (!date) continue;
			const inn = timeOf(cell(cells, c.inn));
			const out = timeOf(cell(cells, c.out));
			const times = sharkCols.map((i) => timeOf(cells[i])).filter((v): v is number => v != null);
			effort.push({
				date,
				session: str(cell(cells, c.session)),
				baitInMin: inn,
				baitOutMin: out,
				soakMin: inn != null && out != null ? out - inn : null,
				sharkTimes: times,
				nSharks: int(cell(cells, c.total)) ?? times.length,
				comments: text(cell(cells, c.comments))
			});
		}
	}
	return { captures, effort };
}
