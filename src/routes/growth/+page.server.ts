import { memo } from '#lib/server/data';
import {
	activeNurseries,
	boxOf,
	fieldCaptures,
	recapturePairs,
	round,
	siteName
} from '#lib/server/analytics/common';
import { vonBertalanffy } from '#lib/server/analytics/population';
import { histogram, linearFit, mean, median, pairedT, pairs } from '#lib/stats';
import { fitText, groupsText, rankText, twoGroupText } from '#lib/server/analytics/tests';
import { num, pValue } from '#lib/format';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('growth', (d) => {
		const ocean = d.ocean.filter((o) => o.oisst != null || o.crwSst != null);
		const sstBetween = (a: string, b: string) =>
			mean(ocean.filter((o) => o.date >= a && o.date <= b).map((o) => o.oisst ?? o.crwSst));
		const pairsAll = recapturePairs(fieldCaptures(d))
			.filter((p) => p.days >= 7 && p.a.tlMm && p.b.tlMm)
			.map((p) => {
				const rate = (p.b.tlMm! - p.a.tlMm!) / p.days;
				const massRate =
					p.a.massKg && p.b.massKg ? ((p.b.massKg - p.a.massKg) * 1000) / p.days : null;
				return {
					id: p.id,
					species: p.species,
					site: p.a.siteId,
					days: p.days,
					rate,
					massRate,
					tl0: p.a.tlMm!,
					sst: sstBetween(p.a.date!, p.b.date!),
					sameSeason: p.a.season === p.b.season
				};
			})
			.filter((g) => g.rate > -1 && g.rate < 3);
		const within = pairsAll.filter((g) => g.sameSeason);

		const gFit = (sp: string, fx: (g: (typeof within)[number]) => number | null) => {
			const f = linearFit(
				pairs(
					within.filter((g) => g.species === sp),
					fx,
					(g) => g.rate
				)
			);
			return f
				? { slope: f.slope, intercept: f.intercept, r2: round(f.r2, 3), p: f.p, n: f.n }
				: null;
		};
		const sstFit = gFit('Cm', (g) => g.sst);
		const sstXs = within.filter((g) => g.species === 'Cm' && g.sst != null).map((g) => g.sst!);

		const lab = d.labSharks
			.filter((l) => l.arrTlMm && l.relTlMm && l.days && l.days >= 7)
			.map((l) => ({
				rate: (l.relTlMm! - l.arrTlMm!) / l.days!,
				massRate:
					l.arrMassKg && l.relMassKg ? ((l.relMassKg - l.arrMassKg) * 1000) / l.days! : null,
				days: l.days!,
				species: l.species
			}))
			.filter((l) => l.rate > -1 && l.rate < 3);

		const nurseries = activeNurseries(d);
		const ofSp = (sp: string) => within.filter((g) => g.species === sp);
		const named = (name: string, text: string | null) => (text ? `${name}: ${text}` : null);
		const spread = (sp: string) => {
			const m = median(ofSp(sp).map((g) => g.rate)) ?? 0;
			return ofSp(sp).map((g) => [g.days, Math.abs(g.rate - m)] as [number, number]);
		};
		const massVsZero = (sp: string, name: string) => {
			const t = pairedT(
				ofSp(sp)
					.filter((g) => g.massRate != null)
					.map((g) => [0, g.massRate!] as [number, number])
			);
			return t
				? `${name}: mean ${t.diff >= 0 ? '+' : '−'}${num(Math.abs(t.diff), 1)} g per day, ${t.p < 0.05 ? 'different from' : 'not different from'} no change (t-test, ${pValue(t.p)}, n = ${num(t.df + 1)}).`
				: null;
		};
		const stats = {
			dist: twoGroupText(
				ofSp('Cm').map((g) => g.rate),
				ofSp('Na').map((g) => g.rate),
				'blacktips and sicklefin lemons',
				'mm per day'
			),
			noise: named(
				'Distance from the median growth rate against days between captures (blacktips)',
				rankText(spread('Cm'))
			),
			size: ['Cm', 'Na'].map((sp) =>
				named(
					sp === 'Cm' ? 'Blacktips' : 'Sicklefin lemons',
					fitText(
						ofSp(sp).map((g) => [g.tl0, g.rate]),
						'mm/day per mm'
					)
				)
			),
			site: groupsText(
				nurseries.map((id) => within.filter((g) => g.site === id).map((g) => g.rate)),
				'nurseries (all species)'
			),
			mass: [massVsZero('Cm', 'Blacktips'), massVsZero('Na', 'Sicklefin lemons')],
			labTl: twoGroupText(
				lab.map((l) => l.rate),
				ofSp('Cm').map((g) => g.rate),
				'lab and field blacktips',
				'mm per day in the lab'
			),
			labMass: twoGroupText(
				lab.map((l) => l.massRate),
				ofSp('Cm').map((g) => g.massRate),
				'lab and field blacktips',
				'g per day in the lab'
			)
		};
		return {
			stats,
			vbgf: vonBertalanffy(d),
			n: within.length,
			medianCm: round(median(within.filter((g) => g.species === 'Cm').map((g) => g.rate)), 2),
			medianNa: round(median(within.filter((g) => g.species === 'Na').map((g) => g.rate)), 2),
			edges: Array.from({ length: 26 }, (_, i) => -0.5 + i * 0.1),
			histCm: histogram(
				within.filter((g) => g.species === 'Cm').map((g) => g.rate),
				-0.5,
				2.0,
				0.1
			).map((b) => b.count),
			histNa: histogram(
				within.filter((g) => g.species === 'Na').map((g) => g.rate),
				-0.5,
				2.0,
				0.1
			).map((b) => b.count),
			scatter: within.map((g) => ({ x: g.days, y: g.rate, g: g.species, label: g.id })),
			sizeScatter: within.map((g) => ({ x: g.tl0, y: g.rate, g: g.species, label: g.id })),
			sstScatter: within
				.filter((g) => g.species === 'Cm' && g.sst != null)
				.map((g) => ({ x: g.sst!, y: g.rate, label: g.id })),
			sstFit:
				sstFit && sstXs.length
					? {
							...sstFit,
							points: [Math.min(...sstXs), Math.max(...sstXs)].map((x) => ({
								x,
								y: sstFit.intercept + sstFit.slope * x
							}))
						}
					: null,
			bySite: nurseries
				.map((id) => ({
					name: siteName(d, id),
					stats: boxOf(within.filter((g) => g.site === id).map((g) => g.rate))
				}))
				.filter((b) => b.stats && b.stats.n >= 5),
			mass: within
				.filter((g) => g.massRate != null)
				.map((g) => ({ x: g.days, y: g.massRate!, g: g.species })),
			labVsField: [
				{
					name: 'Field (recaptures)',
					stats: boxOf(within.filter((g) => g.species === 'Cm').map((g) => g.rate))
				},
				{ name: 'Lab (CRIOBE)', stats: boxOf(lab.map((l) => l.rate)) }
			],
			labMass: [
				{
					name: 'Field',
					stats: boxOf(within.filter((g) => g.species === 'Cm').map((g) => g.massRate))
				},
				{ name: 'Lab', stats: boxOf(lab.map((l) => l.massRate)) }
			],
			acrossSeasons: pairsAll
				.filter((g) => !g.sameSeason)
				.map((g) => ({
					id: g.id,
					species: g.species,
					days: g.days,
					rate: round(g.rate, 3),
					tl0: g.tl0
				}))
		};
	});
