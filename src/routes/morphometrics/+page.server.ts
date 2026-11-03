import { memo } from '#lib/server/data';
import { sexModel } from '#lib/server/analytics/sex';
import {
	activeNurseries,
	boxOf,
	fieldCaptures,
	firstPerSeason,
	fulton,
	isNeonate,
	round,
	siteName
} from '#lib/server/analytics/common';
import {
	binomTestHalf,
	histogram,
	linearFit,
	mean,
	pairs,
	powerFit,
	welch,
	wilson
} from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('morphometrics', (d) => {
		const first = firstPerSeason(fieldCaptures(d));
		const sp = (s: string) => first.filter((c) => c.species === s);
		const edges = Array.from({ length: 31 }, (_, i) => 400 + i * 20);
		const lf = (s: string) =>
			histogram(
				sp(s).map((c) => c.tlMm),
				400,
				1000,
				20
			).map((b) => b.count);

		const lw = (s: string) => {
			const xy = pairs(
				sp(s),
				(c) => c.tlMm,
				(c) => c.massKg
			).filter(([x, y]) => x > 350 && x < 1100 && y > 0.2 && y < 6);
			const fit = powerFit(xy);
			const xs = xy.map((p) => p[0]);
			const lo = Math.min(...xs);
			const hi = Math.max(...xs);
			return {
				points: xy,
				fit: fit
					? {
							a: fit.a,
							b: fit.b,
							r2: round(fit.r2, 3),
							n: fit.n,
							curve: Array.from({ length: 30 }, (_, i) => {
								const x = lo + ((hi - lo) * i) / 29;
								return { x, y: fit.a * x ** fit.b };
							})
						}
					: null
			};
		};

		const conv = (
			s: string,
			fx: (c: (typeof first)[number]) => number | null,
			fy: (c: (typeof first)[number]) => number | null,
			label: string
		) => {
			const f = linearFit(pairs(sp(s), fx, fy).filter(([x, y]) => x > 250 && y > 250));
			return f
				? {
						species: s,
						label,
						slope: round(f.slope, 4),
						intercept: round(f.intercept, 1),
						r2: round(f.r2, 3),
						n: f.n
					}
				: null;
		};
		const conversions = [
			conv(
				'Cm',
				(c) => c.flMm,
				(c) => c.tlMm,
				'TL = a + b·FL'
			),
			conv(
				'Na',
				(c) => c.flMm,
				(c) => c.tlMm,
				'TL = a + b·FL'
			),
			conv(
				'Cm',
				(c) => c.pclMm,
				(c) => c.tlMm,
				'TL = a + b·PCL'
			),
			conv(
				'Na',
				(c) => c.pclMm,
				(c) => c.tlMm,
				'TL = a + b·PCL'
			),
			conv(
				'Cm',
				(c) => c.tlMm,
				(c) => c.flMm,
				'FL = a + b·TL'
			),
			conv(
				'Na',
				(c) => c.tlMm,
				(c) => c.flMm,
				'FL = a + b·TL'
			)
		].filter(Boolean);

		const nurseries = activeNurseries(d);
		const neoCm = sp('Cm').filter(isNeonate);
		const kBySite = nurseries
			.map((id) => ({
				name: siteName(d, id),
				stats: boxOf(neoCm.filter((c) => c.siteId === id).map(fulton))
			}))
			.filter((b) => b.stats && b.stats.n >= 8);
		const kBySeason = (s: string) =>
			d.seasons.map((season) =>
				round(
					mean(
						sp(s)
							.filter((c) => c.season === season && isNeonate(c))
							.map(fulton)
					),
					3
				)
			);
		const tlBySeason = (s: string) =>
			d.seasons.map((season) => ({
				name: season.slice(2, 4) + '–' + season.slice(7),
				stats: boxOf(
					sp(s)
						.filter((c) => c.season === season)
						.map((c) => c.tlMm)
				)
			}));

		const sexRatio = (s: string) =>
			d.seasons.map((season) => {
				const ind = sp(s).filter((c) => c.season === season && c.sex);
				const f = ind.filter((c) => c.sex === 'F').length;
				const w = wilson(f, ind.length);
				return {
					season,
					n: ind.length,
					f,
					p: w ? round(w.p, 3) : null,
					lo: w ? round(w.lo, 3) : null,
					hi: w ? round(w.hi, 3) : null
				};
			});
		const overallSex = (['Cm', 'Na'] as const).map((s) => {
			const ind = d.individuals.filter((i) => i.species === s && i.sex);
			const f = ind.filter((i) => i.sex === 'F').length;
			return { species: s, f, m: ind.length - f, p: round(binomTestHalf(f, ind.length), 4) };
		});
		const dimorph = (['Cm', 'Na'] as const).map((s) => {
			const F = sp(s)
				.filter((c) => c.sex === 'F')
				.map((c) => c.tlMm);
			const M = sp(s)
				.filter((c) => c.sex === 'M')
				.map((c) => c.tlMm);
			const w = welch(F, M);
			return {
				species: s,
				F: boxOf(F),
				M: boxOf(M),
				diff: w ? round(w.diff, 1) : null,
				p: w ? w.p : null
			};
		});
		const claspers = sp('Cm')
			.concat(sp('Na'))
			.filter((c) => c.sex === 'M')
			.map((c) => ({ x: c.tlMm, y: c.clasperL ?? c.clasperR, g: c.species }))
			.filter(
				(p): p is { x: number; y: number; g: string } =>
					p.x != null && p.y != null && p.y > 5 && p.y < 200
			);

		return {
			edges,
			lfCm: lf('Cm'),
			lfNa: lf('Na'),
			medianTl: {
				Cm: round(boxOf(sp('Cm').map((c) => c.tlMm))?.median, 0),
				Na: round(boxOf(sp('Na').map((c) => c.tlMm))?.median, 0)
			},
			lwCm: lw('Cm'),
			lwNa: lw('Na'),
			conversions,
			kBySite,
			kSeasons: d.seasons,
			kCm: kBySeason('Cm'),
			kNa: kBySeason('Na'),
			tlCm: tlBySeason('Cm'),
			sexCm: sexRatio('Cm'),
			sexNa: sexRatio('Na'),
			overallSex,
			sexModel: memo('sexModel', sexModel),
			dimorph,
			claspers
		};
	});
