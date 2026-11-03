/** Small, dependency-free statistics used by the analyses. Nulls/NaN are always ignored. */

export type Num = number | null | undefined;

export const finite = (xs: Num[]): number[] =>
	xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));

export function sum(xs: Num[]): number {
	return finite(xs).reduce((a, b) => a + b, 0);
}

export function mean(xs: Num[]): number | null {
	const v = finite(xs);
	return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function quantile(xs: Num[], q: number): number | null {
	const v = finite(xs).sort((a, b) => a - b);
	if (!v.length) return null;
	const pos = (v.length - 1) * q;
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const median = (xs: Num[]) => quantile(xs, 0.5);

export function sd(xs: Num[]): number | null {
	const v = finite(xs);
	if (v.length < 2) return null;
	const m = v.reduce((a, b) => a + b, 0) / v.length;
	return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

export function se(xs: Num[]): number | null {
	const s = sd(xs);
	const n = finite(xs).length;
	return s == null ? null : s / Math.sqrt(n);
}

export function extent(xs: Num[]): [number, number] | null {
	const v = finite(xs);
	if (!v.length) return null;
	let lo = v[0];
	let hi = v[0];
	for (const x of v) {
		if (x < lo) lo = x;
		if (x > hi) hi = x;
	}
	return [lo, hi];
}

/** Pairs where both values are finite. */
export function pairs<T>(rows: T[], fx: (r: T) => Num, fy: (r: T) => Num): [number, number][] {
	const out: [number, number][] = [];
	for (const r of rows) {
		const x = fx(r);
		const y = fy(r);
		if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y))
			out.push([x, y]);
	}
	return out;
}

// --- distributions -----------------------------------------------------------------------------

export function logGamma(x: number): number {
	const c = [
		76.1800917294715, -86.5053203294168, 24.0140982408309, -1.23173957245016, 0.00120865097386618,
		-0.5395239384953e-5
	];
	let y = x;
	const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
	let ser = 1.00000000019002;
	for (const ci of c) ser += ci / ++y;
	return -tmp + Math.log((2.506628274631 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
	const MAXIT = 200;
	const EPS = 3e-12;
	const FPMIN = 1e-300;
	let c = 1;
	let d = 1 - ((a + b) * x) / (a + 1);
	if (Math.abs(d) < FPMIN) d = FPMIN;
	d = 1 / d;
	let h = d;
	for (let m = 1; m <= MAXIT; m++) {
		const m2 = 2 * m;
		let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
		d = 1 + aa * d;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = 1 + aa / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		h *= d * c;
		aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
		d = 1 + aa * d;
		if (Math.abs(d) < FPMIN) d = FPMIN;
		c = 1 + aa / c;
		if (Math.abs(c) < FPMIN) c = FPMIN;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < EPS) break;
	}
	return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	const bt = Math.exp(
		logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
	);
	return x < (a + 1) / (a + b + 2)
		? (bt * betacf(a, b, x)) / a
		: 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a standard normal statistic (erfc, Numerical Recipes; error < 1.2e-7). */
export function normalP(z: number): number {
	if (!Number.isFinite(z)) return NaN;
	const x = Math.abs(z) / Math.SQRT2;
	const t = 1 / (1 + 0.5 * x);
	const poly =
		-x * x -
		1.26551223 +
		t *
			(1.00002368 +
				t *
					(0.37409196 +
						t *
							(0.09678418 +
								t *
									(-0.18628806 +
										t *
											(0.27886807 +
												t *
													(-1.13520398 +
														t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
	return Math.min(1, t * Math.exp(poly));
}

/** Upper regularised incomplete gamma Q(a, x) (Numerical Recipes series / continued fraction). */
function gammaQ(a: number, x: number): number {
	if (x <= 0) return 1;
	const front = Math.exp(-x + a * Math.log(x) - logGamma(a));
	if (x < a + 1) {
		let ap = a;
		let del = 1 / a;
		let sum = del;
		for (let n = 0; n < 500; n++) {
			ap++;
			del *= x / ap;
			sum += del;
			if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
		}
		return Math.max(0, 1 - sum * front);
	}
	const tiny = 1e-300;
	let b = x + 1 - a;
	let c = 1 / tiny;
	let d = 1 / b;
	let h = d;
	for (let i = 1; i < 500; i++) {
		const an = -i * (i - a);
		b += 2;
		d = an * d + b;
		if (Math.abs(d) < tiny) d = tiny;
		c = b + an / c;
		if (Math.abs(c) < tiny) c = tiny;
		d = 1 / d;
		const del = d * c;
		h *= del;
		if (Math.abs(del - 1) < 1e-14) break;
	}
	return front * h;
}

/** Upper-tail p-value of a chi-square statistic. */
export const chiSquareP = (stat: number, df: number) => gammaQ(df / 2, stat / 2);

/** Pearson chi-square test of independence for a table of counts (rows × columns). */
export function chiSquare(table: number[][]): { stat: number; df: number; p: number } | null {
	const rows = table.filter((r) => r.some((v) => v > 0));
	const cols = rows[0]?.map((_, j) => rows.reduce((a, r) => a + r[j], 0)) ?? [];
	const keep = cols.map((c) => c > 0);
	const t = rows.map((r) => r.filter((_, j) => keep[j]));
	const colSums = cols.filter((c) => c > 0);
	const n = colSums.reduce((a, b) => a + b, 0);
	if (t.length < 2 || colSums.length < 2 || !n) return null;
	let stat = 0;
	for (const r of t) {
		const rs = r.reduce((a, b) => a + b, 0);
		r.forEach((v, j) => {
			const e = (rs * colSums[j]) / n;
			stat += (v - e) ** 2 / e;
		});
	}
	const df = (t.length - 1) * (colSums.length - 1);
	return { stat, df, p: chiSquareP(stat, df) };
}

/** Two-sided p-value for a t statistic with `df` degrees of freedom. */
export function tTestP(t: number, df: number): number {
	if (!Number.isFinite(t) || df <= 0) return NaN;
	return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

// --- association -------------------------------------------------------------------------------

export interface Fit {
	n: number;
	slope: number;
	intercept: number;
	r: number;
	r2: number;
	p: number;
}

/** Ordinary least squares y = intercept + slope·x, with Pearson r and its p-value. */
export function linearFit(xy: [number, number][]): Fit | null {
	const n = xy.length;
	if (n < 3) return null;
	let sx = 0;
	let sy = 0;
	for (const [x, y] of xy) {
		sx += x;
		sy += y;
	}
	const mx = sx / n;
	const my = sy / n;
	let sxx = 0;
	let syy = 0;
	let sxy = 0;
	for (const [x, y] of xy) {
		sxx += (x - mx) ** 2;
		syy += (y - my) ** 2;
		sxy += (x - mx) * (y - my);
	}
	if (sxx === 0 || syy === 0) return null;
	const slope = sxy / sxx;
	const r = sxy / Math.sqrt(sxx * syy);
	const t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
	return { n, slope, intercept: my - slope * mx, r, r2: r * r, p: tTestP(t, n - 2) };
}

function ranks(v: number[]): number[] {
	const idx = v.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
	const out = new Array<number>(v.length);
	for (let i = 0; i < idx.length;) {
		let j = i;
		while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
		const rank = (i + j) / 2 + 1;
		for (let k = i; k <= j; k++) out[idx[k][1]] = rank;
		i = j + 1;
	}
	return out;
}

/** Spearman rank correlation with a t-approximation p-value. */
export function spearman(xy: [number, number][]): { n: number; rho: number; p: number } | null {
	if (xy.length < 4) return null;
	const rx = ranks(xy.map((p) => p[0]));
	const ry = ranks(xy.map((p) => p[1]));
	const fit = linearFit(rx.map((x, i) => [x, ry[i]]));
	if (!fit) return null;
	return { n: fit.n, rho: fit.r, p: fit.p };
}

/** Log–log fit W = a·L^b (used for length–mass). */
export function powerFit(xy: [number, number][]): (Fit & { a: number; b: number }) | null {
	const logged = xy
		.filter(([x, y]) => x > 0 && y > 0)
		.map(([x, y]) => [Math.log10(x), Math.log10(y)] as [number, number]);
	const fit = linearFit(logged);
	if (!fit) return null;
	return { ...fit, a: 10 ** fit.intercept, b: fit.slope };
}

/** Wilson score interval for a binomial proportion. */
export function wilson(
	successes: number,
	n: number,
	z = 1.96
): { p: number; lo: number; hi: number } | null {
	if (n === 0) return null;
	const p = successes / n;
	const denom = 1 + (z * z) / n;
	const centre = (p + (z * z) / (2 * n)) / denom;
	const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
	return { p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/** Exact two-sided binomial test against p = 0.5 (sex ratios). */
export function binomTestHalf(k: number, n: number): number {
	if (n === 0) return 1;
	const logC = (n2: number, k2: number) =>
		logGamma(n2 + 1) - logGamma(k2 + 1) - logGamma(n2 - k2 + 1);
	const pk = (i: number) => Math.exp(logC(n, i) - n * Math.log(2));
	const obs = pk(k);
	let p = 0;
	for (let i = 0; i <= n; i++) {
		const v = pk(i);
		if (v <= obs * (1 + 1e-9)) p += v;
	}
	return Math.min(1, p);
}

/** Welch's t-test for two independent samples. */
export function welch(
	a: Num[],
	b: Num[]
): { t: number; df: number; p: number; diff: number } | null {
	const x = finite(a);
	const y = finite(b);
	if (x.length < 2 || y.length < 2) return null;
	const mx = mean(x)!;
	const my = mean(y)!;
	const vx = sd(x)! ** 2 / x.length;
	const vy = sd(y)! ** 2 / y.length;
	if (vx + vy === 0) return null;
	const t = (mx - my) / Math.sqrt(vx + vy);
	const df = (vx + vy) ** 2 / (vx ** 2 / (x.length - 1) + vy ** 2 / (y.length - 1));
	return { t, df, p: tTestP(t, df), diff: mx - my };
}

// --- grouping ----------------------------------------------------------------------------------

export function groupBy<T, K extends string | number>(
	rows: T[],
	key: (r: T) => K | null | undefined
): Map<K, T[]> {
	const m = new Map<K, T[]>();
	for (const r of rows) {
		const k = key(r);
		if (k == null) continue;
		const list = m.get(k);
		if (list) list.push(r);
		else m.set(k, [r]);
	}
	return m;
}

export function countBy<T, K extends string | number>(
	rows: T[],
	key: (r: T) => K | null | undefined
): Map<K, number> {
	const m = new Map<K, number>();
	for (const r of rows) {
		const k = key(r);
		if (k == null) continue;
		m.set(k, (m.get(k) ?? 0) + 1);
	}
	return m;
}

export interface Bin {
	x0: number;
	x1: number;
	count: number;
}

/** Fixed-width histogram bins over [lo, hi). */
export function histogram(xs: Num[], lo: number, hi: number, width: number): Bin[] {
	const bins: Bin[] = [];
	for (let x = lo; x < hi - 1e-9; x += width) bins.push({ x0: x, x1: x + width, count: 0 });
	for (const v of finite(xs)) {
		const i = Math.floor((v - lo) / width);
		if (i >= 0 && i < bins.length) bins[i].count++;
	}
	return bins;
}

/** "Nice" bin width for roughly `target` bins over a range. */
export function niceStep(span: number, target = 20): number {
	const raw = span / target;
	const pow = 10 ** Math.floor(Math.log10(raw));
	const n = raw / pow;
	return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
}

/** Box-plot summary (Tukey whiskers at 1.5 IQR). */
export function boxStats(xs: Num[]) {
	const v = finite(xs).sort((a, b) => a - b);
	if (v.length === 0) return null;
	const q1 = quantile(v, 0.25)!;
	const q3 = quantile(v, 0.75)!;
	const iqr = q3 - q1;
	const lo = v.find((x) => x >= q1 - 1.5 * iqr) ?? v[0];
	const hi = [...v].reverse().find((x) => x <= q3 + 1.5 * iqr) ?? v[v.length - 1];
	return {
		n: v.length,
		min: v[0],
		q1,
		median: quantile(v, 0.5)!,
		q3,
		max: v[v.length - 1],
		lo,
		hi,
		mean: mean(v)!
	};
}
