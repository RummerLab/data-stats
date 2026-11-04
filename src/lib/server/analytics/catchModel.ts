/**
 * Joint model of catches (#54): negative-binomial counts per gillnet set with log(net-hours) as the
 * offset, a smooth for day of the season, nursery and season effects and the environment. The
 * single-variable correlations on /drivers mix these together (sea temperature rises as catches
 * fall through the season); the model estimates each one with the others held fixed. Still
 * observational: it adjusts for what is measured, nothing more.
 */
import { mean, quantile, sd } from '#lib/stats';
import { modelDiagnostics } from './modelDiagnostics';
import type { Dataset, SetRow } from '../data';
import { effortSets, round, seasonDay, seasonDayLabel, siteName } from './common';
import { SET_VARIABLES } from './env';
import { contrast, fitGlm, naturalSpline, type GlmFit } from './glm';

/** Environmental terms, chosen to cover each family once (no near-duplicates like air vs sea). */
const TERMS = [
	'sst',
	'moonIllum',
	'tide',
	'wind',
	'rain24h',
	'cloud',
	'waves',
	'startSunset',
	'crew'
] as const;
/** Nurseries need this many complete sets to get their own effect. */
const MIN_SITE_SETS = 30;
const SPLINE_KNOTS = [0, 0.25, 0.5, 0.75, 1];

type Response = 'all' | 'Cm' | 'Na';

const ci = (c: { est: number; lo: number; hi: number }) => ({
	est: round(Math.exp(c.est), 3)!,
	lo: round(Math.exp(c.lo), 3)!,
	hi: round(Math.exp(c.hi), 3)!
});

/** Effect (sum-to-zero) coding: each level against the average level; the last is −Σ others. */
const effectCode = (levels: string[], v: string) =>
	levels.slice(0, -1).map((l) => (v === levels[levels.length - 1] ? -1 : v === l ? 1 : 0));

function count(s: SetRow, r: Response): number {
	const hours = s.durationMin! / 60;
	const rate = r === 'all' ? s.cpue : r === 'Cm' ? s.cpueCm : s.cpueNa;
	return Math.round((rate ?? 0) * hours);
}

/** A species gets its own nursery effect only where it was caught at least this often. */
const MIN_SITE_CATCH = 10;

export function catchModel(d: Dataset) {
	const vars = TERMS.map((k) => SET_VARIABLES.find((v) => v.key === k)!);
	const complete = effortSets(d).filter(
		(s) => s.cpue != null && s.date && s.siteId && vars.every((v) => v.get(s) != null)
	);
	const perSite = new Map<string, number>();
	for (const s of complete) perSite.set(s.siteId!, (perSite.get(s.siteId!) ?? 0) + 1);
	const sites = [...perSite]
		.filter(([, n]) => n >= MIN_SITE_SETS)
		.map(([id]) => id)
		.sort();
	const base = complete.filter((s) => sites.includes(s.siteId!));
	const seasons = [...new Set(base.map((s) => s.season))].sort();
	if (base.length < 200 || sites.length < 2 || seasons.length < 2) return null;

	// Scales and spline knots come from the full model so every species shares the same units.
	const scale = vars.map((v) => {
		const xs = base.map((s) => v.get(s)!);
		return { mean: mean(xs)!, sd: sd(xs) || 1 };
	});
	const baseDays = base.map((s) => seasonDay(s.date!));
	const knots = SPLINE_KNOTS.map((q) => quantile(baseDays, q)!);
	const spline = naturalSpline(knots);
	const nSpline = knots.length - 1;
	const dayGrid: number[] = [];
	for (let x = Math.ceil(knots[0] / 7) * 7; x <= knots[knots.length - 1]; x += 7) dayGrid.push(x);

	// Column layout: intercept | environment (per SD) | day spline | nursery | season.
	const iEnv = 1;
	const iDay = iEnv + vars.length;
	const fitFor = (r: Response) => {
		const caught = new Map<string, number>();
		for (const s of base) caught.set(s.siteId!, (caught.get(s.siteId!) ?? 0) + count(s, r));
		const own = sites.filter((id) => r === 'all' || (caught.get(id) ?? 0) >= MIN_SITE_CATCH);
		const rows = base.filter((s) => own.includes(s.siteId!));
		const ownSeasons = seasons.filter((x) => rows.some((s) => s.season === x));
		const days = rows.map((s) => seasonDay(s.date!));
		const meanBasis = new Array<number>(nSpline).fill(0);
		for (const day of days) spline(day).forEach((v, j) => (meanBasis[j] += v / days.length));
		const iSite = iDay + nSpline;
		const iSeason = iSite + own.length - 1;
		const p = iSeason + ownSeasons.length - 1;
		const X = rows.map((s, i) => [
			1,
			...vars.map((v, j) => (v.get(s)! - scale[j].mean) / scale[j].sd),
			...spline(days[i]),
			...effectCode(own, s.siteId!),
			...effectCode(ownSeasons, s.season)
		]);
		const y = rows.map((s) => count(s, r));
		const offset = rows.map((s) => Math.log(s.durationMin! / 60));
		const fit = own.length >= 2 ? fitGlm(X, y, offset) : null;
		const unit = (j: number) => Array.from({ length: p }, (_, k) => (k === j ? 1 : 0));
		const level = (start: number, n: number, i: number) =>
			Array.from({ length: p }, (_, k) =>
				k < start || k >= start + n - 1 ? 0 : i === n - 1 ? -1 : k - start === i ? 1 : 0
			);
		const effect = (g: number[]) => {
			const c = contrast(fit!, g);
			return { ...ci(c), p: c.p };
		};
		return {
			fit,
			rows,
			offset,
			y,
			X,
			summary: fit && {
				n: fit.n,
				sharks: y.reduce((a, b) => a + b, 0),
				theta: round(fit.theta, 2),
				devExplained: round(1 - fit.deviance / fit.nullDeviance, 3),
				env: vars.map((_, j) => effect(unit(iEnv + j))),
				sites: sites.map((id) => {
					const i = own.indexOf(id);
					return i < 0 ? null : effect(level(iSite, own.length, i));
				}),
				seasons: seasons.map((x) => {
					const i = ownSeasons.indexOf(x);
					return i < 0 ? null : effect(level(iSeason, ownSeasons.length, i));
				}),
				// Day-of-season curve relative to the season average.
				day: dayGrid.map((x) => {
					const b = spline(x);
					const g = Array.from({ length: p }, (_, k) =>
						k >= iDay && k < iDay + nSpline ? b[k - iDay] - meanBasis[k - iDay] : 0
					);
					return { x, ...ci(contrast(fit, g)) };
				})
			}
		};
	};
	const all = fitFor('all');
	const cm = fitFor('Cm');
	const na = fitFor('Na');
	if (!all.summary) return null;

	// The SST question from #54: how much of the raw SST link is really the time of season?
	const sstJ = vars.findIndex((v) => v.key === 'sst');
	const sstC = all.rows.map((s) => vars[sstJ].get(s)! - scale[sstJ].mean);
	const days = all.rows.map((s) => seasonDay(s.date!));
	const perDegree = (fit: GlmFit | null, j: number, per = 1) => {
		if (!fit) return null;
		const c = contrast(
			fit,
			Array.from({ length: fit.beta.length }, (_, k) => (k === j ? 1 / per : 0))
		);
		return { ...ci(c), p: c.p };
	};
	const sst = [
		{
			label: 'Sea temperature alone',
			v: perDegree(
				fitGlm(
					sstC.map((x) => [1, x]),
					all.y,
					all.offset
				),
				1
			)
		},
		{
			label: '+ day of the season',
			v: perDegree(
				fitGlm(
					sstC.map((x, i) => [1, x, ...spline(days[i])]),
					all.y,
					all.offset
				),
				1
			)
		},
		{
			label: '+ nursery, season and conditions',
			v: perDegree(all.fit, iEnv + sstJ, scale[sstJ].sd)
		}
	];
	const poisson = fitGlm(all.X, all.y, all.offset, 'poisson');

	return {
		n: all.rows.length,
		diagnostics: [all, cm, na].map((m, i) => ({
			name: ['All sharks', 'Blacktip reef sharks', 'Sicklefin lemon sharks'][i],
			data: modelDiagnostics(m.fit, m.rows, m.X, m.y, m.offset)
		})),
		dropped: effortSets(d).filter((s) => s.cpue != null).length - all.rows.length,
		knots: knots.map((k) => seasonDayLabel(Math.round(k))),
		terms: vars.map((v, j) => ({
			key: v.key,
			label: v.label,
			unit: v.unit,
			sd: round(scale[j].sd, v.dp + 1)!,
			dp: v.dp
		})),
		sites: sites.map((id) => ({ id, name: siteName(d, id), n: perSite.get(id)! })),
		seasons,
		days: dayGrid.map((x) => ({ x, label: seasonDayLabel(x) })),
		all: all.summary,
		cm: cm.summary,
		na: na.summary,
		sst,
		aicNb: round(all.fit?.aic, 1),
		aicPoisson: round(poisson?.aic, 1)
	};
}
