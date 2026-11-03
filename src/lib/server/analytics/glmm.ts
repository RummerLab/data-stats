/**
 * Binomial mixed model (#117): logistic regression with crossed random intercepts (nursery and
 * season, say), fitted by maximum likelihood with the Laplace approximation. For given standard
 * deviations the fixed effects and the spherical random effects v (u = σ·v) are found together
 * by penalised IRLS, as lme4's glmer with nAGQ = 0; the standard deviations then maximise the
 * approximate log-likelihood (Nelder–Mead). Random-intercept tests compare the fit with that
 * standard deviation fixed at zero (likelihood ratio, halved p for the boundary).
 */
import { chiSquareP } from '#lib/stats';
import { invertSpd } from './glm';

/** A grouping factor: `index[i]` is observation i's level, 0 … levels − 1. */
export interface Factor {
	levels: number;
	index: number[];
}

export interface GlmmFit {
	n: number;
	beta: number[];
	betaSe: number[];
	/** Random-intercept standard deviation per factor (log-odds scale). */
	sd: number[];
	/** Laplace-approximate log-likelihood. */
	loglik: number;
	/** Conditional modes of the random effects with their standard errors, per factor and level. */
	re: { est: number; se: number }[][];
	converged: boolean;
}

/** Cholesky factor of a symmetric positive-definite matrix, or null. */
function chol(a: number[][]): number[][] | null {
	const n = a.length;
	const l = a.map(() => new Array<number>(n).fill(0));
	for (let i = 0; i < n; i++)
		for (let j = 0; j <= i; j++) {
			let s = a[i][j];
			for (let k = 0; k < j; k++) s -= l[i][k] * l[j][k];
			if (i === j) {
				if (s <= 1e-12 * Math.max(1, Math.abs(a[i][i]))) return null;
				l[i][i] = Math.sqrt(s);
			} else l[i][j] = s / l[j][j];
		}
	return l;
}

function solveChol(l: number[][], b: number[]): number[] {
	const n = b.length;
	const z = new Array<number>(n);
	for (let i = 0; i < n; i++) {
		let s = b[i];
		for (let k = 0; k < i; k++) s -= l[i][k] * z[k];
		z[i] = s / l[i][i];
	}
	const x = new Array<number>(n);
	for (let i = n - 1; i >= 0; i--) {
		let s = z[i];
		for (let k = i + 1; k < n; k++) s -= l[k][i] * x[k];
		x[i] = s / l[i][i];
	}
	return x;
}

const logDet = (l: number[][]) => 2 * l.reduce((a, row, i) => a + Math.log(row[i]), 0);

/** log p(y | η) for 0/1 outcomes, computed stably. */
const bernoulli = (y: number, eta: number) =>
	y ? -Math.log1p(Math.exp(-eta)) : -Math.log1p(Math.exp(eta));

interface Mode {
	beta: number[];
	v: number[];
	A: number[][];
	loglik: number;
	ok: boolean;
}

/** Penalised IRLS for fixed standard deviations: the joint mode of (β, v). */
function mode(
	y: number[],
	X: number[][],
	factors: Factor[],
	sds: number[],
	start?: { beta: number[]; v: number[] }
): Mode | null {
	const n = y.length;
	const p = X[0].length;
	const offs = factors.map((_, f) => factors.slice(0, f).reduce((a, g) => a + g.levels, 0));
	const q = factors.reduce((a, g) => a + g.levels, 0);
	const m = p + q;
	let beta = start?.beta.slice() ?? new Array<number>(p).fill(0);
	let v = start?.v.slice() ?? new Array<number>(q).fill(0);
	const etaOf = (b: number[], vv: number[], i: number) => {
		let e = 0;
		for (let j = 0; j < p; j++) e += X[i][j] * b[j];
		for (let f = 0; f < factors.length; f++) e += sds[f] * vv[offs[f] + factors[f].index[i]];
		return e;
	};
	const penalised = (b: number[], vv: number[]) => {
		let s = 0;
		for (let i = 0; i < n; i++) s += bernoulli(y[i], etaOf(b, vv, i));
		return s - 0.5 * vv.reduce((a, x) => a + x * x, 0);
	};
	let pen = penalised(beta, v);
	let A: number[][] = [];
	for (let iter = 0; iter < 60; iter++) {
		A = Array.from({ length: m }, () => new Array<number>(m).fill(0));
		const g = new Array<number>(m).fill(0);
		const cols = new Array<number>(p + factors.length);
		const vals = new Array<number>(p + factors.length);
		for (let i = 0; i < n; i++) {
			const mu = 1 / (1 + Math.exp(-etaOf(beta, v, i)));
			const w = mu * (1 - mu);
			const r = y[i] - mu;
			for (let j = 0; j < p; j++) [cols[j], vals[j]] = [j, X[i][j]];
			for (let f = 0; f < factors.length; f++)
				[cols[p + f], vals[p + f]] = [p + offs[f] + factors[f].index[i], sds[f]];
			for (let a = 0; a < cols.length; a++) {
				g[cols[a]] += r * vals[a];
				for (let b = 0; b < cols.length; b++) A[cols[a]][cols[b]] += w * vals[a] * vals[b];
			}
		}
		for (let k = 0; k < q; k++) {
			A[p + k][p + k] += 1;
			g[p + k] -= v[k];
		}
		const l = chol(A);
		if (!l) return null;
		const delta = solveChol(l, g);
		let step = 1;
		let next = pen;
		let nb = beta;
		let nv = v;
		for (let h = 0; h < 30; h++) {
			nb = beta.map((x, j) => x + step * delta[j]);
			nv = v.map((x, k) => x + step * delta[p + k]);
			next = penalised(nb, nv);
			if (next >= pen - 1e-10) break;
			step /= 2;
		}
		const done = Math.max(...delta.map(Math.abs)) * step < 1e-8 || Math.abs(next - pen) < 1e-10;
		[beta, v, pen] = [nb, nv, next];
		if (done) break;
	}
	// Laplace: log p(y | mode) − ½|v|² − ½ log det(ΛZᵀWZΛ + I), the random-effect block of A.
	const lv = chol(A.slice(p).map((row) => row.slice(p)));
	if (!lv) return null;
	return { beta, v, A, loglik: pen - 0.5 * logDet(lv), ok: true };
}

/** Nelder–Mead maximisation inside [0, hi] in every coordinate. */
function maximise(f: (x: number[]) => number, x0: number[], hi = 5): number[] {
	const k = x0.length;
	const clamp = (x: number[]) => x.map((v) => Math.min(hi, Math.max(0, v)));
	let pts = [clamp(x0), ...x0.map((_, i) => clamp(x0.map((v, j) => (i === j ? v + 0.4 : v))))];
	let vals = pts.map(f);
	for (let it = 0; it < 200; it++) {
		const order = vals.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);
		pts = order.map((i) => pts[i]);
		vals = order.map((i) => vals[i]);
		if (Math.abs(vals[0] - vals[k]) < 1e-7) break;
		const c = x0.map((_, j) => pts.slice(0, k).reduce((a, q) => a + q[j], 0) / k);
		const at = (t: number) => clamp(c.map((v, j) => v + t * (pts[k][j] - v)));
		const r = at(-1);
		const fr = f(r);
		if (fr > vals[0]) {
			const e = at(-2);
			const fe = f(e);
			[pts[k], vals[k]] = fe > fr ? [e, fe] : [r, fr];
		} else if (fr > vals[k - 1]) [pts[k], vals[k]] = [r, fr];
		else {
			const ct = at(fr > vals[k] ? -0.5 : 0.5);
			const fc = f(ct);
			if (fc > Math.max(fr, vals[k])) [pts[k], vals[k]] = [ct, fc];
			else
				for (let i = 1; i <= k; i++) {
					pts[i] = clamp(pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])));
					vals[i] = f(pts[i]);
				}
		}
	}
	return pts[vals.indexOf(Math.max(...vals))];
}

/**
 * Fit y ~ X + (1 | factor₁) + (1 | factor₂) … for 0/1 outcomes. `fixedSd[f]` pins a standard
 * deviation (0 drops that random effect, for tests).
 */
export function fitBinomialGlmm(
	y: number[],
	X: number[][],
	factors: Factor[],
	fixedSd: (number | null)[] = []
): GlmmFit | null {
	if (!y.length || !X.length) return null;
	const free = factors.map((_, f) => fixedSd[f] == null);
	const full = (x: number[]) => {
		let k = 0;
		return factors.map((_, f) => (free[f] ? x[k++] : fixedSd[f]!));
	};
	let warm: { beta: number[]; v: number[] } | undefined;
	const objective = (x: number[]) => {
		const md = mode(y, X, factors, full(x), warm);
		if (!md) return -Infinity;
		warm = { beta: md.beta, v: md.v };
		return md.loglik;
	};
	const x0 = factors.filter((_, f) => free[f]).map(() => 0.5);
	const best = x0.length ? maximise(objective, x0) : [];
	const sds = full(best);
	const md = mode(y, X, factors, sds, warm);
	if (!md) return null;
	const inv = invertSpd(md.A);
	const p = X[0].length;
	let off = p;
	const re = factors.map((g, f) => {
		const out = Array.from({ length: g.levels }, (_, l) => ({
			est: sds[f] * md.v[off - p + l],
			se: inv ? sds[f] * Math.sqrt(Math.max(0, inv[off + l][off + l])) : NaN
		}));
		off += g.levels;
		return out;
	});
	return {
		n: y.length,
		beta: md.beta,
		betaSe: md.beta.map((_, j) => (inv ? Math.sqrt(Math.max(0, inv[j][j])) : NaN)),
		sd: sds,
		loglik: md.loglik,
		re,
		converged: md.ok
	};
}

/** Likelihood-ratio test of one random intercept (σ = 0 on the boundary: halved χ²₁ p). */
export function testRandomEffect(
	fit: GlmmFit,
	y: number[],
	X: number[][],
	factors: Factor[],
	f: number
) {
	const fixed = factors.map((_, k) => (k === f ? 0 : null));
	const reduced = fitBinomialGlmm(y, X, factors, fixed);
	if (!reduced) return null;
	const lr = Math.max(0, 2 * (fit.loglik - reduced.loglik));
	return { lr, p: lr > 1e-6 ? 0.5 * chiSquareP(lr, 1) : 1 };
}
