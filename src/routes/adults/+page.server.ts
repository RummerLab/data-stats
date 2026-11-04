import { memo } from '#lib/server/data';
import { round } from '#lib/server/analytics/common';
import { countBy, histogram, linearFit, mean, pairedT, pairs } from '#lib/stats';
import { twoGroupText } from '#lib/server/analytics/tests';
import { num, pValue } from '#lib/format';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('adults', (d) => {
		const a = d.adults;
		const lactFit = linearFit(
			pairs(
				a,
				(x) => x.fightMin,
				(x) => x.lact1
			)
		);
		const fightXs = a.map((x) => x.fightMin).filter((v): v is number => v != null);
		const hook = d.captures.filter((c) => c.kind === 'hook');
		const samples = d.adultSamples;
		const effort = d.adultEffort;
		const firstWait = effort
			.filter((e) => e.baitInMin != null)
			.map((e) => {
				const times = JSON.parse(e.sharkTimes ?? '[]') as number[];
				return times.length ? times[0] - e.baitInMin! : null;
			})
			.filter((v): v is number => v != null && v >= 0);
		// Pregnant females vs other females at the same length: girth residuals from a line fitted
		// to the non-pregnant sharks.
		const girthFit = linearFit(
			a
				.filter((x) => x.tlMm && x.pecGirthMm && x.pregnant !== 'Y')
				.map((x) => [x.tlMm!, x.pecGirthMm!] as [number, number])
		);
		const resid = (x: (typeof a)[number]) =>
			girthFit && x.tlMm && x.pecGirthMm
				? x.pecGirthMm - (girthFit.intercept + girthFit.slope * x.tlMm)
				: null;
		const lactT = pairedT(
			a
				.filter((x) => x.lact1 != null && x.lact2 != null)
				.map((x) => [x.lact1!, x.lact2!] as [number, number])
		);
		const stats = {
			size: twoGroupText(
				a.filter((x) => x.sex === 'F').map((x) => x.tlMm),
				a.filter((x) => x.sex === 'M').map((x) => x.tlMm),
				'females and males',
				'mm for females'
			),
			lact: lactT
				? `Second draw ${lactT.diff >= 0 ? '+' : '−'}${num(Math.abs(lactT.diff), 1)} mmol/L on average, ${lactT.p < 0.05 ? 'a real change' : 'no more than chance'} (paired t-test, ${pValue(lactT.p)}, n = ${num(lactT.df + 1)}).`
				: null,
			girth: girthFit
				? `Girth on length (non-pregnant sharks): R² = ${num(girthFit.r2, 2)}, ${pValue(girthFit.p)}. ${
						twoGroupText(
							a.filter((x) => x.pregnant === 'Y').map(resid),
							a.filter((x) => x.sex === 'F' && x.pregnant !== 'Y').map(resid),
							'pregnant and other females at the same length',
							'mm of girth when pregnant'
						) ?? ''
					}`
				: null
		};
		return {
			stats,
			n: a.length,
			sex: Object.fromEntries(countBy(a, (x) => x.sex)),
			maturity: [...countBy(a, (x) => x.maturity ?? 'Unknown').entries()].map(([k, n]) => ({
				k,
				n
			})),
			pregnant: {
				yes: a.filter((x) => x.pregnant === 'Y').length,
				scanned: a.filter((x) => x.sex === 'F' && x.pregnant != null).length
			},
			codes: [...countBy(a, (x) => x.reproCode).entries()].map(([k, n]) => ({ k, n })),
			edges: Array.from({ length: 13 }, (_, i) => 1000 + i * 50),
			tlF: histogram(
				a.filter((x) => x.sex === 'F').map((x) => x.tlMm),
				1000,
				1650,
				50
			).map((b) => b.count),
			tlM: histogram(
				a.filter((x) => x.sex === 'M').map((x) => x.tlMm),
				1000,
				1650,
				50
			).map((b) => b.count),
			lactPairs: a
				.filter((x) => x.lact1 != null && x.lact2 != null)
				.map((x) => ({
					name: x.name ?? x.sharkId ?? '',
					l1: x.lact1!,
					l2: x.lact2!,
					g1: x.gluc1,
					g2: x.gluc2,
					b1: x.bhb1,
					b2: x.bhb2,
					fight: x.fightMin,
					handling: x.handlingMin
				})),
			fightScatter: a
				.filter((x) => x.fightMin != null && x.lact1 != null)
				.map((x) => ({ x: x.fightMin!, y: x.lact1!, label: x.name ?? '' })),
			lactFit:
				lactFit && fightXs.length
					? {
							slope: round(lactFit.slope, 2),
							r2: round(lactFit.r2, 2),
							p: lactFit.p,
							n: lactFit.n,
							points: [Math.min(...fightXs), Math.max(...fightXs)].map((x) => ({
								x,
								y: lactFit.intercept + lactFit.slope * x
							}))
						}
					: null,
			means: {
				lact1: round(mean(a.map((x) => x.lact1)), 2),
				lact2: round(mean(a.map((x) => x.lact2)), 2),
				gluc1: round(mean(a.map((x) => x.gluc1)), 2),
				gluc2: round(mean(a.map((x) => x.gluc2)), 2),
				bhb1: round(mean(a.map((x) => x.bhb1)), 2),
				bhb2: round(mean(a.map((x) => x.bhb2)), 2),
				fight: round(mean(a.map((x) => x.fightMin)), 1),
				handling: round(mean(a.map((x) => x.handlingMin)), 1)
			},
			girth: a
				.filter((x) => x.tlMm && x.pecGirthMm)
				.map((x) => ({
					x: x.tlMm!,
					y: x.pecGirthMm!,
					g: x.pregnant === 'Y' ? 'Pregnant' : x.sex === 'F' ? 'Female' : 'Male',
					label: x.name ?? ''
				})),
			effort: effort.map((e) => ({
				date: e.date,
				session: e.session,
				soak: e.soakMin,
				n: e.nSharks,
				cpue: e.soakMin ? round((e.nSharks ?? 0) / (e.soakMin / 60), 2) : null,
				comments: e.comments
			})),
			firstWait: round(mean(firstWait), 0),
			hook: hook.map((c) => ({
				date: c.date,
				site: c.siteId,
				species: c.species,
				tl: c.tlMm,
				sex: c.sex
			})),
			samples: [...countBy(samples, (s) => s.island ?? 'Unknown').entries()].map(([k, n]) => ({
				k,
				n
			})),
			sampleSizes: samples.map((s) => s.sizeCm).filter((v): v is number => v != null)
		};
	});
