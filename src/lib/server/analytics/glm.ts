/**
 * Negative-binomial (NB2) and Poisson regression with a log link and an offset (#54): IRLS for
 * the coefficients, θ by maximum likelihood, alternating until both settle. Dense and small: a
 * few dozen columns and a couple of thousand rows.
 */
import { logGamma, normalP } from '#lib/stats';

export interface GlmFit {
	beta: number[];
	/** Covariance of β (inverse Fisher information). */
	cov: number[][];
	/** NB dispersion: Var = μ + μ²/θ. Infinity for Poisson. */
	theta: number;
	loglik: number;
	aic: number;
	deviance: number;
	nullDeviance: number;
	n: number;
	converged: boolean;
}

/** Inverse of a symmetric positive-definite matrix by Cholesky; null if singular. */
export function invertSpd(a: number[][]): number[][] | null {
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
	// inv(L), then inv(A) = inv(L)ᵀ inv(L).
	const li = l.map(() => new Array<number>(n).fill(0));
	for (let i = 0; i < n; i++) {
		li[i][i] = 1 / l[i][i];
		for (let j = 0; j < i; j++) {
			let s = 0;
			for (let k = j; k < i; k++) s -= l[i][k] * li[k][j];
			li[i][j] = s / l[i][i];
		}
	}
	const out = l.map(() => new Array<number>(n).fill(0));
	for (let i = 0; i < n; i++)
		for (let j = 0; j <= i; j++) {
			let s = 0;
			for (let k = i; k < n; k++) s += li[k][i] * li[k][j];
			out[i][j] = s;
			out[j][i] = s;
		}
	return out;
}

function logLik(y: number[], mu: number[], theta: number): number {
	let ll = 0;
	for (let i = 0; i < y.length; i++) {
		const m = Math.max(mu[i], 1e-12);
		if (!Number.isFinite(theta)) ll += y[i] * Math.log(m) - m - logGamma(y[i] + 1);
		else
			ll +=
				logGamma(y[i] + theta) -
				logGamma(theta) -
				logGamma(y[i] + 1) +
				theta * Math.log(theta / (theta + m)) +
				y[i] * Math.log(m / (theta + m));
	}
	return ll;
}

function deviance(y: number[], mu: number[], theta: number): number {
	let d = 0;
	for (let i = 0; i < y.length; i++) {
		const m = Math.max(mu[i], 1e-12);
		const t = y[i] > 0 ? y[i] * Math.log(y[i] / m) : 0;
		d += Number.isFinite(theta)
			? 2 * (t - (y[i] + theta) * Math.log((y[i] + theta) / (m + theta)))
			: 2 * (t - (y[i] - m));
	}
	return d;
}

/** θ maximising the NB likelihood for fixed μ (golden section on log θ). */
function bestTheta(y: number[], mu: number[]): number {
	let a = Math.log(0.01);
	let b = Math.log(1e4);
	const g = (Math.sqrt(5) - 1) / 2;
	const f = (lt: number) => -logLik(y, mu, Math.exp(lt));
	let c = b - g * (b - a);
	let d = a + g * (b - a);
	let fc = f(c);
	let fd = f(d);
	for (let i = 0; i < 80 && b - a > 1e-6; i++) {
		if (fc < fd) {
			b = d;
			d = c;
			fd = fc;
			c = b - g * (b - a);
			fc = f(c);
		} else {
			a = c;
			c = d;
			fc = fd;
			d = a + g * (b - a);
			fd = f(d);
		}
	}
	return Math.exp((a + b) / 2);
}

/** IRLS for β at fixed θ, starting from μ. */
function irls(X: number[][], y: number[], offset: number[], theta: number, mu0: number[]) {
	const n = y.length;
	const p = X[0].length;
	let mu = mu0.slice();
	let beta = new Array<number>(p).fill(0);
	let cov: number[][] | null = null;
	let dev = Infinity;
	let converged = false;
	for (let it = 0; it < 100; it++) {
		const xtwx = Array.from({ length: p }, () => new Array<number>(p).fill(0));
		const xtwz = new Array<number>(p).fill(0);
		for (let i = 0; i < n; i++) {
			const m = Math.max(mu[i], 1e-10);
			const w = Number.isFinite(theta) ? m / (1 + m / theta) : m;
			const z = Math.log(m) - offset[i] + (y[i] - m) / m;
			const xi = X[i];
			for (let j = 0; j < p; j++) {
				const wx = w * xi[j];
				xtwz[j] += wx * z;
				for (let k = 0; k <= j; k++) xtwx[j][k] += wx * xi[k];
			}
		}
		for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) xtwx[k][j] = xtwx[j][k];
		cov = invertSpd(xtwx);
		if (!cov) return null;
		beta = cov.map((row) => row.reduce((s, v, k) => s + v * xtwz[k], 0));
		mu = X.map((xi, i) =>
			Math.exp(Math.min(30, xi.reduce((s, v, k) => s + v * beta[k], 0) + offset[i]))
		);
		const d = deviance(y, mu, theta);
		if (Math.abs(d - dev) < 1e-8 * (Math.abs(d) + 0.1)) {
			dev = d;
			converged = true;
			break;
		}
		dev = d;
	}
	return { beta, cov: cov!, mu, dev, converged };
}

/**
 * Fit log(μ) = Xβ + offset. `family: 'nb'` estimates θ; 'poisson' fixes θ = ∞. X should carry its
 * own intercept column. Returns null when the design is singular.
 */
export function fitGlm(
	X: number[][],
	y: number[],
	offset: number[],
	family: 'nb' | 'poisson' = 'nb'
): GlmFit | null {
	const n = y.length;
	if (!n || !X[0]?.length) return null;
	const rate = y.reduce((a, b) => a + b, 0) / offset.reduce((a, o) => a + Math.exp(o), 0);
	let mu = offset.map((o, i) => (y[i] + Math.max(rate * Math.exp(o), 0.1)) / 2);
	let theta = family === 'nb' ? 1 : Infinity;
	let fit = irls(X, y, offset, theta, mu);
	if (!fit) return null;
	let converged = fit.converged;
	if (family === 'nb') {
		converged = false;
		for (let outer = 0; outer < 50; outer++) {
			const t = bestTheta(y, fit.mu);
			const next = irls(X, y, offset, t, fit.mu);
			if (!next) return null;
			const done = Math.abs(Math.log(t / theta)) < 1e-6 && Math.abs(next.dev - fit.dev) < 1e-6;
			theta = t;
			fit = next;
			if (done) {
				converged = next.converged;
				break;
			}
		}
	}
	mu = fit.mu;
	const ll = logLik(y, mu, theta);
	const p = X[0].length + (family === 'nb' ? 1 : 0);
	// Null deviance: intercept + offset only, same θ.
	const nullMu = offset.map((o) => rate * Math.exp(o));
	return {
		beta: fit.beta,
		cov: fit.cov,
		theta,
		loglik: ll,
		aic: -2 * ll + 2 * p,
		deviance: fit.dev,
		nullDeviance: deviance(y, nullMu, theta),
		n,
		converged
	};
}

/** Wald estimate, 95% interval and p for a linear combination gᵀβ (on the log scale). */
export function contrast(fit: GlmFit, g: number[]) {
	const est = g.reduce((s, v, i) => s + v * fit.beta[i], 0);
	let v = 0;
	for (let i = 0; i < g.length; i++)
		if (g[i]) for (let j = 0; j < g.length; j++) if (g[j]) v += g[i] * fit.cov[i][j] * g[j];
	const se = Math.sqrt(Math.max(0, v));
	return { est, se, lo: est - 1.96 * se, hi: est + 1.96 * se, p: se > 0 ? normalP(est / se) : NaN };
}

/**
 * Natural cubic spline basis (ESL §5.2.1) with the given knots; x and the knots are scaled to the
 * boundary knots so the columns stay well conditioned. Returns K − 1 columns (linear term first).
 */
export function naturalSpline(knots: number[]): (x: number) => number[] {
	const lo = knots[0];
	const span = knots[knots.length - 1] - lo || 1;
	const k = knots.map((v) => (v - lo) / span);
	const K = k.length;
	const cube = (v: number) => (v > 0 ? v * v * v : 0);
	const d = (x: number, j: number) => (cube(x - k[j]) - cube(x - k[K - 1])) / (k[K - 1] - k[j]);
	return (raw: number) => {
		const x = (raw - lo) / span;
		const out = [x];
		for (let j = 0; j < K - 2; j++) out.push(d(x, j) - d(x, K - 2));
		return out;
	};
}
