/**
 * Apparent survival within a season from mark–recapture (#42): a Cormack–Jolly–Seber model.
 *
 * Occasions are 14-day blocks of the season at each nursery. A pup is "seen" in a block if it was
 * caught at that nursery in any set that fortnight; its history starts at its first capture there
 * that season. Conditioning on first capture means pups born later in the season don't bias the
 * estimate, unlike the Schnabel abundance, which assumes a closed population.
 *
 * φ is the chance that a pup at the nursery is still alive and still there a fortnight later:
 * deaths and departures look the same, hence "apparent". Capture probability grows with that
 * fortnight's net-hours, p = 1 − exp(−exp(aₙ + β·log hours)), with an intercept per nursery
 * (nets catch differently at each site); a fortnight without a set has p = 0. Sets without
 * recorded times count as a typical set. Maximum likelihood by BFGS, Wald intervals on the logit
 * scale from a numerical Hessian.
 */
import { chiSquareP, median } from '#lib/stats';
import type { Dataset } from '../data';
import { fieldCaptures, seasonDay, siteName } from './common';
import { invertSpd } from './glm';

export const OCCASION_DAYS = 14;

/** One nursery-season: net-hours per occasion (0 = no set that fortnight). */
export interface CjsGroup {
	nursery: number;
	hours: number[];
}

/** Occasions (indices into its group's `hours`) in which a pup was caught, sorted, unique. */
export interface CjsHistory {
	group: number;
	seen: number[];
}

export interface CjsOptions {
	/** One φ per nursery instead of one shared φ. */
	nurseryPhi?: boolean;
	/** A separate φ for the first fortnight after first capture (transients, #42). */
	transience?: boolean;
}

export interface CjsFit {
	/** logit φ (one, or one per nursery), then τ (transience), then aₙ, then β. */
	theta: number[];
	se: (number | null)[];
	cov: number[][] | null;
	loglik: number;
	k: number;
}

const LIMIT = 15;
const clampL = (v: number) => Math.max(-LIMIT, Math.min(LIMIT, v));
const expit = (v: number) => 1 / (1 + Math.exp(-v));
const P_MIN = 1e-9;

function layout(nNursery: number, o: CjsOptions) {
	const nPhi = o.nurseryPhi ? nNursery : 1;
	const tau = o.transience ? nPhi : -1;
	const a0 = nPhi + (o.transience ? 1 : 0);
	return { nPhi, tau, a0, beta: a0 + nNursery, k: a0 + nNursery + 1 };
}

/** Log-likelihood of the histories, conditional on each pup's first capture. */
export function cjsLogLik(
	theta: number[],
	groups: CjsGroup[],
	histories: CjsHistory[],
	nNursery: number,
	o: CjsOptions = {}
): number {
	const L = layout(nNursery, o);
	const beta = theta[L.beta];
	const tau = L.tau >= 0 ? theta[L.tau] : 0;
	const per = groups.map((g) => {
		const lp = theta[o.nurseryPhi ? g.nursery : 0];
		const phi = expit(clampL(lp));
		const phi1 = expit(clampL(lp + tau));
		const a = theta[L.a0 + g.nursery];
		const p = g.hours.map((h) =>
			h > 0
				? Math.min(
						1 - P_MIN,
						Math.max(P_MIN, 1 - Math.exp(-Math.exp(clampL(a + beta * Math.log(h)))))
					)
				: 0
		);
		// χ[t]: chance of never being caught again after occasion t (χ1 for a pup marked at t).
		const T = p.length;
		const chi = new Array<number>(T).fill(1);
		const chi1 = new Array<number>(T).fill(1);
		for (let t = T - 2; t >= 0; t--) {
			chi[t] = 1 - phi + phi * (1 - p[t + 1]) * chi[t + 1];
			chi1[t] = 1 - phi1 + phi1 * (1 - p[t + 1]) * chi[t + 1];
		}
		return {
			lphi: Math.log(phi),
			lphi1: Math.log(phi1),
			lp: p.map((v) => (v > 0 ? Math.log(v) : -Infinity)),
			lq: p.map((v) => Math.log(1 - v)),
			chi,
			chi1
		};
	});
	let ll = 0;
	for (const h of histories) {
		const g = per[h.group];
		const f = h.seen[0];
		const l = h.seen[h.seen.length - 1];
		let k = 1;
		for (let t = f; t < l; t++) {
			const caught = h.seen[k] === t + 1;
			if (caught) k++;
			ll += (t === f ? g.lphi1 : g.lphi) + (caught ? g.lp[t + 1] : g.lq[t + 1]);
		}
		ll += Math.log(l === f ? g.chi1[l] : g.chi[l]);
	}
	return ll;
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

function gradient(f: (x: number[]) => number, x: number[], h = 1e-5): number[] {
	return x.map((_, i) => {
		const up = x.slice();
		const dn = x.slice();
		up[i] += h;
		dn[i] -= h;
		return (f(up) - f(dn)) / (2 * h);
	});
}

/** BFGS minimisation with a backtracking line search and numerical gradients. */
function minimise(f: (x: number[]) => number, x0: number[]): { x: number[]; fx: number } {
	const n = x0.length;
	const eye = (): number[][] =>
		Array.from({ length: n }, (_, i) => x0.map((__, j) => (i === j ? 1 : 0)));
	let x = x0.slice();
	let fx = f(x);
	let g = gradient(f, x);
	let H = eye();
	for (let it = 0; it < 500; it++) {
		let d = H.map((row) => -dot(row, g));
		let slope = dot(g, d);
		if (!(slope < 0)) {
			H = eye();
			d = g.map((v) => -v);
			slope = dot(g, d);
		}
		let step = 1;
		let xn = x;
		let fn = fx;
		for (let ls = 0; ls < 50; ls++) {
			xn = x.map((v, i) => v + step * d[i]);
			fn = f(xn);
			if (Number.isFinite(fn) && fn <= fx + 1e-4 * step * slope) break;
			step /= 2;
		}
		if (!(fn < fx)) break;
		const gn = gradient(f, xn);
		const s = xn.map((v, i) => v - x[i]);
		const y = gn.map((v, i) => v - g[i]);
		const sy = dot(s, y);
		if (sy > 1e-12) {
			const rho = 1 / sy;
			const Hy = H.map((row) => dot(row, y));
			const yHy = dot(y, Hy);
			H = H.map((row, i) =>
				row.map(
					(v, j) => v - rho * (s[i] * Hy[j] + Hy[i] * s[j]) + (rho * rho * yHy + rho) * s[i] * s[j]
				)
			);
		}
		const small = fx - fn < 1e-10 * (1 + Math.abs(fx));
		x = xn;
		fx = fn;
		g = gn;
		if (small && Math.max(...g.map(Math.abs)) < 1e-3) break;
	}
	return { x, fx };
}

/** Numerical Hessian of f at x (central differences). */
function hessian(f: (x: number[]) => number, x: number[], h = 1e-4): number[][] {
	const n = x.length;
	const at = (i: number, di: number, j: number, dj: number) => {
		const y = x.slice();
		y[i] += di;
		y[j] += dj;
		return f(y);
	};
	const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
	for (let i = 0; i < n; i++)
		for (let j = 0; j <= i; j++) {
			const v =
				(at(i, h, j, h) - at(i, h, j, -h) - at(i, -h, j, h) + at(i, -h, j, -h)) / (4 * h * h);
			out[i][j] = v;
			out[j][i] = v;
		}
	return out;
}

/** Fit a CJS model; `withSe` adds Wald standard errors (skipped for the comparison models). */
export function fitCjs(
	groups: CjsGroup[],
	histories: CjsHistory[],
	nNursery: number,
	o: CjsOptions = {},
	withSe = true
): CjsFit | null {
	const L = layout(nNursery, o);
	const x0 = new Array<number>(L.k).fill(0);
	for (let i = 0; i < L.nPhi; i++) x0[i] = 1.5;
	for (let i = 0; i < nNursery; i++) x0[L.a0 + i] = -3;
	x0[L.beta] = 1;
	const f = (t: number[]) => -cjsLogLik(t, groups, histories, nNursery, o);
	if (!Number.isFinite(f(x0))) return null;
	const { x, fx } = minimise(f, x0);
	const cov = withSe ? invertSpd(hessian(f, x)) : null;
	// A logit at the edge (φ ≈ 0 or 1) has no usable Wald interval.
	const se = x.map((v, i) =>
		cov && Math.abs(v) < LIMIT - 3 && cov[i][i] > 0 ? Math.sqrt(cov[i][i]) : null
	);
	return { theta: x, se, cov, loglik: -fx, k: L.k };
}

export interface Est {
	est: number;
	lo: number | null;
	hi: number | null;
}

const phiEst = (lp: number, se: number | null, power = 1): Est => ({
	est: expit(lp) ** power,
	lo: se == null ? null : expit(lp - 1.96 * se) ** power,
	hi: se == null ? null : expit(lp + 1.96 * se) ** power
});

/** Days a pup stays on average (alive and at the nursery) when it stays a fortnight with chance φ. */
const residence = (phi: number) =>
	phi >= 1 ? null : phi <= 0 ? 0 : -OCCASION_DAYS / Math.log(phi);

export interface LrTest {
	lr: number;
	df: number;
	p: number;
}

export interface SurvivalResult {
	species: 'Cm' | 'Na';
	histories: number;
	recaptured: number;
	nurseries: {
		siteId: string;
		name: string;
		histories: number;
		recaptured: number;
		phi: Est;
		month: Est;
	}[];
	/** Shared φ per fortnight, and the share still there 30 days later. */
	phi: Est;
	month: Est;
	residenceDays: number | null;
	/** Likelihood-ratio test: does φ differ between nurseries? */
	nurseryTest: LrTest | null;
	/** φ in the first fortnight after first capture vs later fortnights, and its LR test. */
	transience: (LrTest & { first: Est; later: Est }) | null;
	/** Chance of catching a pup that is there, in a fortnight with one typical set. */
	pTypicalSet: number | null;
}

/** Nurseries need this many pups seen again (a later fortnight, same season) to get a φ. */
const MIN_RECAPTURED = 10;

export function survival(d: Dataset, species: 'Cm' | 'Na'): SurvivalResult | null {
	const block = (date: string) => Math.floor(seasonDay(date) / OCCASION_DAYS);
	const nets = d.sets.filter((s) => s.gear === 'Gillnet' && s.date && s.siteId);
	const typical =
		median(nets.map((s) => (s.durationMin != null && s.durationMin > 0 ? s.durationMin : null))) ??
		150;
	const hoursOf = (s: (typeof nets)[number]) =>
		(s.durationMin != null && s.durationMin > 0 ? s.durationMin : typical) / 60;

	// Blocks caught per pup, per nursery-season.
	const caught = new Map<string, Map<string, Set<number>>>();
	for (const c of fieldCaptures(d)) {
		if (c.species !== species || !c.date || !c.individualId || !c.siteId) continue;
		if (d.siteById.get(c.siteId)?.kind !== 'nursery') continue;
		const k = `${c.season}|${c.siteId}`;
		const m = caught.get(k) ?? new Map<string, Set<number>>();
		const s = m.get(c.individualId) ?? new Set<number>();
		s.add(block(c.date));
		m.set(c.individualId, s);
		caught.set(k, m);
	}
	const recapturedAt = new Map<string, number>();
	const historiesAt = new Map<string, number>();
	for (const [k, m] of caught) {
		const site = k.split('|')[1];
		historiesAt.set(site, (historiesAt.get(site) ?? 0) + m.size);
		const re = [...m.values()].filter((s) => s.size > 1).length;
		recapturedAt.set(site, (recapturedAt.get(site) ?? 0) + re);
	}
	const sites = [...recapturedAt.entries()]
		.filter(([, n]) => n >= MIN_RECAPTURED)
		.sort((a, b) => b[1] - a[1])
		.map(([s]) => s);
	if (!sites.length) return null;
	const siteIdx = new Map(sites.map((s, i) => [s, i]));

	const groups: CjsGroup[] = [];
	const histories: CjsHistory[] = [];
	for (const [k, m] of caught) {
		const [season, site] = k.split('|');
		const n = siteIdx.get(site);
		if (n == null) continue;
		const effort = new Map<number, number>();
		for (const s of nets)
			if (s.season === season && s.siteId === site)
				effort.set(block(s.date!), (effort.get(block(s.date!)) ?? 0) + hoursOf(s));
		// A catch in a fortnight with no set on record still means the net was out.
		for (const bs of m.values())
			for (const b of bs) if (!effort.get(b)) effort.set(b, typical / 60);
		const first = Math.min(...effort.keys());
		const last = Math.max(...effort.keys());
		const hours = Array.from({ length: last - first + 1 }, (_, i) => effort.get(first + i) ?? 0);
		const g = groups.length;
		groups.push({ nursery: n, hours });
		for (const bs of m.values())
			histories.push({ group: g, seen: [...bs].map((b) => b - first).sort((a, b) => a - b) });
	}
	const recaptured = histories.filter((h) => h.seen.length > 1).length;
	if (recaptured < 20) return null;

	const K = sites.length;
	const shared = fitCjs(groups, histories, K);
	if (!shared) return null;
	const byNursery = K > 1 ? fitCjs(groups, histories, K, { nurseryPhi: true }) : null;
	const trans = fitCjs(groups, histories, K, { transience: true });
	const lrTest = (full: CjsFit | null, df: number): LrTest | null => {
		if (!full) return null;
		const lr = Math.max(0, 2 * (full.loglik - shared.loglik));
		return { lr, df, p: chiSquareP(lr, df) };
	};
	const transTest = lrTest(trans, 1);

	const beta = shared.theta[shared.k - 1];
	const pSet = (a: number) => 1 - Math.exp(-Math.exp(a + beta * Math.log(typical / 60)));
	const pTypicalSet = median(sites.map((_, i) => pSet(shared.theta[1 + i])));
	const perMonth = 30 / OCCASION_DAYS;
	return {
		species,
		histories: histories.length,
		recaptured,
		nurseries: sites.map((s, i) => {
			const lp = byNursery ? byNursery.theta[i] : shared.theta[0];
			const se = byNursery ? byNursery.se[i] : shared.se[0];
			return {
				siteId: s,
				name: siteName(d, s),
				histories: historiesAt.get(s) ?? 0,
				recaptured: recapturedAt.get(s) ?? 0,
				phi: phiEst(lp, se),
				month: phiEst(lp, se, perMonth)
			};
		}),
		phi: phiEst(shared.theta[0], shared.se[0]),
		month: phiEst(shared.theta[0], shared.se[0], perMonth),
		residenceDays: residence(expit(shared.theta[0])),
		nurseryTest: lrTest(byNursery, K - 1),
		transience:
			trans && transTest
				? {
						...transTest,
						first: phiEst(
							trans.theta[0] + trans.theta[1],
							trans.cov && trans.se[0] != null && trans.se[1] != null
								? Math.sqrt(trans.cov[0][0] + trans.cov[1][1] + 2 * trans.cov[0][1])
								: null
						),
						later: phiEst(trans.theta[0], trans.se[0])
					}
				: null,
		pTypicalSet
	};
}
