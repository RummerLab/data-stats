/**
 * Sex ratio by nursery and season (#117): a binomial mixed model of female (1) vs male (0) for
 * each individually identified shark, counted once at its first capture, with crossed random
 * intercepts for the nursery and the season of that capture. The intercept is the share of
 * females at a typical nursery in a typical season; the random-effect SDs say how much nurseries
 * and seasons vary around it.
 */
import { type Dataset } from '../data';
import { fieldCaptures, round, siteName } from './common';
import { fitBinomialGlmm, testRandomEffect } from './glmm';

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const share = (eta: number, se: number) => ({
	est: round(logistic(eta), 3)!,
	lo: round(logistic(eta - 1.96 * se), 3)!,
	hi: round(logistic(eta + 1.96 * se), 3)!
});

export function sexModel(d: Dataset) {
	const firstOf = new Map<string, ReturnType<typeof fieldCaptures>[number]>();
	for (const c of [...fieldCaptures(d)].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')))
		if (c.individualId && !firstOf.has(c.individualId)) firstOf.set(c.individualId, c);
	return (['Cm', 'Na'] as const).map((species) => {
		const rows = d.individuals
			.filter((i) => i.species === species && (i.sex === 'F' || i.sex === 'M'))
			.map((i) => ({ female: i.sex === 'F' ? 1 : 0, first: firstOf.get(i.id) }))
			.filter((r) => r.first?.siteId && r.first.season);
		const sites = [...new Set(rows.map((r) => r.first!.siteId!))].sort();
		const seasons = [...new Set(rows.map((r) => r.first!.season))].sort();
		if (rows.length < 50 || sites.length < 3 || seasons.length < 3) return { species, fit: null };
		const y = rows.map((r) => r.female);
		const X = rows.map(() => [1]);
		const factors = [
			{ levels: sites.length, index: rows.map((r) => sites.indexOf(r.first!.siteId!)) },
			{ levels: seasons.length, index: rows.map((r) => seasons.indexOf(r.first!.season)) }
		];
		const fit = fitBinomialGlmm(y, X, factors);
		if (!fit) return { species, fit: null };
		const [nurseryTest, seasonTest] = [0, 1].map((f) => testRandomEffect(fit, y, X, factors, f));
		const b0 = fit.beta[0];
		const levels = (ids: string[], f: number, name: (id: string) => string) =>
			ids.map((id, l) => {
				const mine = rows.filter((_, i) => factors[f].index[i] === l);
				return {
					id,
					name: name(id),
					n: mine.length,
					females: mine.filter((r) => r.female).length,
					// Conditional interval: the level's own uncertainty around the typical share.
					...share(b0 + fit.re[f][l].est, fit.re[f][l].se)
				};
			});
		return {
			species,
			fit: {
				n: fit.n,
				females: y.filter(Boolean).length,
				typical: share(b0, fit.betaSe[0]),
				nurserySd: round(fit.sd[0], 2),
				seasonSd: round(fit.sd[1], 2),
				nurseryP: nurseryTest ? round(nurseryTest.p, 4) : null,
				seasonP: seasonTest ? round(seasonTest.p, 4) : null,
				nurseries: levels(sites, 0, (id) => siteName(d, id)).sort((a, b) => b.est - a.est),
				seasons: levels(seasons, 1, (s) => s)
			}
		};
	});
}
