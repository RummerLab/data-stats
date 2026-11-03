/**
 * Population analyses from mark–recapture (#43, #44). Exploratory: a nursery is not a closed
 * population (pups are born through the season, move and die), so treat the numbers as a rough
 * scale, not a census.
 */
import { mean } from '#lib/stats';
import type { Capture, Dataset } from '../data';
import { cpueOf, effortSets, fieldCaptures, round } from './common';

/** P(X ≤ k) for X ~ Poisson(λ). */
function poissonCdf(k: number, lambda: number): number {
	if (k < 0) return 0;
	let term = Math.exp(-lambda);
	let sum = term;
	for (let i = 1; i <= k; i++) {
		term *= lambda / i;
		sum += term;
	}
	return Math.min(1, sum);
}

/** Exact 95% interval for a Poisson count (Garwood), by bisection. */
export function poissonCi(k: number): [number, number] {
	const solve = (f: (l: number) => number) => {
		let lo = 0;
		let hi = k * 4 + 20;
		for (let i = 0; i < 100; i++) {
			const mid = (lo + hi) / 2;
			if (f(mid) > 0) lo = mid;
			else hi = mid;
		}
		return (lo + hi) / 2;
	};
	const lower = k === 0 ? 0 : solve((l) => (1 - poissonCdf(k - 1, l) - 0.025 < 0 ? 1 : -1));
	const upper = solve((l) => (poissonCdf(k, l) - 0.025 > 0 ? 1 : -1));
	return [lower, upper];
}

export interface SchnabelRow {
	season: string;
	siteId: string;
	species: string;
	samples: number;
	caught: number;
	distinct: number;
	recaptures: number;
	n: number;
	lo: number;
	hi: number;
	cpue: number | null;
}

/**
 * Schnabel estimate (Chapman form, N = ΣCₜMₜ / (R + 1)) per nursery, season and species: each
 * set is a sample, marks are individuals already caught there that season. Exact Poisson limits
 * on R; estimates are floored at the number of individuals actually caught.
 */
export function schnabel(d: Dataset, minRecaptures = 3): SchnabelRow[] {
	const groups = new Map<string, Capture[]>();
	for (const c of fieldCaptures(d)) {
		if (!c.setId || !c.individualId || !c.siteId || (c.species !== 'Cm' && c.species !== 'Na'))
			continue;
		const k = `${c.season}|${c.siteId}|${c.species}`;
		const l = groups.get(k);
		if (l) l.push(c);
		else groups.set(k, [c]);
	}
	const eff = effortSets(d);
	const out: SchnabelRow[] = [];
	for (const [k, caps] of groups) {
		const [season, siteId, species] = k.split('|');
		const bySet = new Map<number, Capture[]>();
		for (const c of caps) {
			const l = bySet.get(c.setId!);
			if (l) l.push(c);
			else bySet.set(c.setId!, [c]);
		}
		const samples = [...bySet.values()].sort((a, b) =>
			(a[0].date ?? '').localeCompare(b[0].date ?? '')
		);
		const marked = new Set<string>();
		let sumCM = 0;
		let caught = 0;
		let recaptures = 0;
		for (const s of samples) {
			const ids = [...new Set(s.map((c) => c.individualId!))];
			sumCM += ids.length * marked.size;
			recaptures += ids.filter((i) => marked.has(i)).length;
			caught += ids.length;
			for (const i of ids) marked.add(i);
		}
		if (recaptures < minRecaptures || samples.length < 3) continue;
		const [rLo, rHi] = poissonCi(recaptures);
		const distinct = marked.size;
		const floor = (x: number) => Math.max(distinct, Math.round(x));
		const key = species === 'Cm' ? 'cpueCm' : 'cpueNa';
		out.push({
			season,
			siteId,
			species,
			samples: samples.length,
			caught,
			distinct,
			recaptures,
			n: floor(sumCM / (recaptures + 1)),
			lo: floor(sumCM / (rHi + 1)),
			hi: floor(sumCM / (rLo + 1)),
			cpue: round(
				cpueOf(
					eff.filter((s) => s.season === season && s.siteId === siteId),
					key
				)
			)
		});
	}
	return out.sort((a, b) => a.season.localeCompare(b.season) || a.siteId.localeCompare(b.siteId));
}

/** Fabens increment model: ΔL = (L∞ − L₁)(1 − e^(−KΔt)), Δt in years. */
const fabensSse = (pairs: { l1: number; dl: number; dt: number }[], linf: number, k: number) =>
	pairs.reduce((s, p) => s + (p.dl - (linf - p.l1) * (1 - Math.exp(-k * p.dt))) ** 2, 0);

const bestK = (pairs: { l1: number; dl: number; dt: number }[], linf: number) => {
	let best = { k: 0, sse: Infinity };
	for (let k = 0.01; k <= 2; k += 0.005) {
		const s = fabensSse(pairs, linf, k);
		if (s < best.sse) best = { k, sse: s };
	}
	return best.k;
};

/**
 * Von Bertalanffy growth for blacktips: K fitted to recapture increments (Fabens), L∞ from the
 * largest adults (mean of the top decile of the adult datasheet) and L₀ from newborns with an
 * open umbilical scar. Juvenile increments alone can't pin down L∞, so it comes from the adults.
 * 95% interval on K from a bootstrap over recapture pairs (fixed seed, deterministic).
 */
export function vonBertalanffy(d: Dataset) {
	const caps = fieldCaptures(d).filter((c) => c.species === 'Cm' && c.individualId && c.tlMm);
	const byInd = new Map<string, Capture[]>();
	for (const c of caps) {
		const l = byInd.get(c.individualId!);
		if (l) l.push(c);
		else byInd.set(c.individualId!, [c]);
	}
	const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86_400_000;
	const pairs: { l1: number; dl: number; dt: number }[] = [];
	for (const l of byInd.values()) {
		l.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
		for (let i = 1; i < l.length; i++) {
			const a = l[i - 1];
			const b = l[i];
			if (!a.date || !b.date) continue;
			const days = day(b.date) - day(a.date);
			// A month or more apart, so measurement error doesn't swamp the growth.
			if (days >= 30) pairs.push({ l1: a.tlMm!, dl: b.tlMm! - a.tlMm!, dt: days / 365.25 });
		}
	}
	const adults = d.adults
		.map((a) => a.tlMm)
		.filter((x): x is number => x != null)
		.sort((a, b) => a - b);
	const newborn = mean(caps.filter((c) => c.umbilical === 'open').map((c) => c.tlMm));
	if (pairs.length < 20 || adults.length < 10 || newborn == null) return null;
	const linf = mean(adults.slice(Math.floor(adults.length * 0.9)))!;
	const k = bestK(pairs, linf);
	let seed = 1;
	const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	const ks: number[] = [];
	for (let b = 0; b < 200; b++) {
		const sample = pairs.map(() => pairs[Math.floor(rand() * pairs.length)]);
		ks.push(bestK(sample, linf));
	}
	ks.sort((a, b) => a - b);
	const kLo = ks[Math.floor(0.025 * ks.length)];
	const kHi = ks[Math.ceil(0.975 * ks.length) - 1];
	const at = (kk: number, t: number) => linf - (linf - newborn) * Math.exp(-kk * t);
	const ages = Array.from({ length: 31 }, (_, i) => i * 0.5);
	const ageAt = (kk: number, len: number) =>
		len >= linf ? null : Math.log((linf - newborn) / (linf - len)) / kk;
	return {
		k: round(k, 3)!,
		kLo: round(kLo, 3)!,
		kHi: round(kHi, 3)!,
		linf: Math.round(linf),
		l0: Math.round(newborn),
		pairs: pairs.length,
		adults: adults.length,
		/** Age (years) at 1 m total length on the fitted curve. */
		ageAt1m: round(ageAt(k, 1000), 1),
		curve: ages.map((t) => ({ x: t, y: Math.round(at(k, t)) })),
		curveLo: ages.map((t) => ({ x: t, y: Math.round(at(kLo, t)) })),
		curveHi: ages.map((t) => ({ x: t, y: Math.round(at(kHi, t)) }))
	};
}
