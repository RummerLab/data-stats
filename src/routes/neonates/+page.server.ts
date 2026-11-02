import { memo } from '#lib/server/data';
import {
	fieldCaptures,
	firstPerSeason,
	fulton,
	isNeonate,
	round,
	seasonDay
} from '#lib/server/analytics/common';
import { linearFit, mean, pairs, quantile, se } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('neonates', (d) => {
		const first = firstPerSeason(fieldCaptures(d)).filter((c) => c.date);
		const weeks = Array.from({ length: 30 }, (_, i) => i + 6); // weeks from 1 Aug: mid-Sep → Apr
		const openShare = (sp: string) =>
			weeks.map((w) => {
				const inWeek = first.filter(
					(c) => c.species === sp && c.umbilical && Math.floor(seasonDay(c.date!) / 7) === w
				);
				return inWeek.length >= 5
					? round(inWeek.filter((c) => c.umbilical !== 'closed').length / inWeek.length, 3)
					: null;
			});

		// Size through the season: newborns grow, and later pups are bigger.
		const sizeScatter = first
			.filter((c) => c.tlMm && c.tlMm < 900 && (c.species === 'Cm' || c.species === 'Na'))
			.map((c) => ({
				x: seasonDay(c.date!),
				y: c.tlMm!,
				g: c.species,
				label: `${c.individualId}`
			}));
		const fitFor = (sp: string) => {
			const f = linearFit(sizeScatter.filter((p) => p.g === sp).map((p) => [p.x, p.y]));
			if (!f) return null;
			const xs = sizeScatter.filter((p) => p.g === sp).map((p) => p.x);
			const lo = Math.min(...xs);
			const hi = Math.max(...xs);
			return {
				slope: f.slope,
				r2: f.r2,
				n: f.n,
				points: [
					{ x: lo, y: f.intercept + f.slope * lo },
					{ x: hi, y: f.intercept + f.slope * hi }
				]
			};
		};

		// Birth window per season: dates of open-scar captures (quartiles).
		const window = d.seasons.map((season) => {
			const days = first
				.filter((c) => c.season === season && c.umbilical === 'open')
				.map((c) => seasonDay(c.date!));
			return {
				season,
				n: days.length,
				q10: quantile(days, 0.1),
				q50: quantile(days, 0.5),
				q90: quantile(days, 0.9)
			};
		});

		// Newborn size vs sea temperature during gestation (Feb–Sep before the season, ~10-month pregnancy).
		const ocean = new Map(d.ocean.map((o) => [o.date, o.oisst ?? o.crwSst]));
		const gestationSst = (season: string) => {
			const y = Number(season.slice(0, 4));
			const vals: (number | null | undefined)[] = [];
			for (const [date, v] of ocean)
				if (date >= `${y - 1}-12-01` && date <= `${y}-09-30`) vals.push(v);
			return mean(vals);
		};
		const bySeason = d.seasons.map((season) => {
			const neo = first.filter(
				(c) => c.season === season && c.species === 'Cm' && c.umbilical === 'open'
			);
			return {
				season,
				n: neo.length,
				tl: round(mean(neo.map((c) => c.tlMm)), 1),
				tlSe: round(se(neo.map((c) => c.tlMm)), 1),
				k: round(mean(neo.map(fulton)), 3),
				mass: round(mean(neo.map((c) => c.massKg)), 3),
				gSst: round(gestationSst(season), 2)
			};
		});
		const gFit = linearFit(
			pairs(
				bySeason.filter((r) => r.n >= 10),
				(r) => r.gSst,
				(r) => r.tl
			)
		);

		const ageMix = d.seasons.map((season) => {
			const s = first.filter((c) => c.season === season);
			return {
				season,
				neonate: s.filter(isNeonate).length,
				juvenile: s.filter(
					(c) => !isNeonate(c) && (c.ageClass === 'juvenile' || c.umbilical === 'closed')
				).length,
				unknown: s.filter(
					(c) => !isNeonate(c) && c.ageClass !== 'juvenile' && c.umbilical !== 'closed'
				).length
			};
		});

		const usSize = (['open', 'semi', 'closed'] as const).map((u) => ({
			u,
			cm: round(
				mean(first.filter((c) => c.species === 'Cm' && c.umbilical === u).map((c) => c.tlMm)),
				0
			),
			na: round(
				mean(first.filter((c) => c.species === 'Na' && c.umbilical === u).map((c) => c.tlMm)),
				0
			),
			n: first.filter((c) => c.umbilical === u).length
		}));

		return {
			weeks,
			openCm: openShare('Cm'),
			openNa: openShare('Na'),
			sizeScatter,
			fitCm: fitFor('Cm'),
			fitNa: fitFor('Na'),
			window,
			bySeason,
			gFit: gFit
				? { slope: round(gFit.slope, 1), r2: round(gFit.r2, 2), p: gFit.p, n: gFit.n }
				: null,
			ageMix,
			usSize
		};
	});
