import type { SetRow } from '../data';
import type { GlmFit } from './glm';
import { seasonDay } from './common';

export function zeroProbability(mu: number, theta: number) {
	return Number.isFinite(theta) ? Math.exp(-theta * Math.log1p(mu / theta)) : Math.exp(-mu);
}

/** Same X, response and offsets as the fit; all diagnostics are in-sample. */
export function modelDiagnostics(
	fit: GlmFit | null,
	rows: SetRow[],
	X: number[][],
	y: number[],
	offsets: number[]
) {
	if (
		!fit?.converged ||
		!rows.length ||
		rows.length !== fit.n ||
		X.length !== rows.length ||
		y.length !== rows.length ||
		offsets.length !== rows.length
	)
		return null;
	const points = rows.map((s, i) => {
		const mu = Math.exp(
			Math.min(30, X[i].reduce((sum, v, j) => sum + v * fit.beta[j], 0) + offsets[i])
		);
		return {
			expected: mu,
			observed: y[i],
			hours: Math.exp(offsets[i]),
			residual:
				(y[i] - mu) / Math.sqrt(mu + (Number.isFinite(fit.theta) ? (mu * mu) / fit.theta : 0)),
			zero: zeroProbability(mu, fit.theta),
			day: seasonDay(s.date!),
			site: s.siteId!,
			season: s.season
		};
	});
	if (points.some((p) => !Number.isFinite(p.residual) || !Number.isFinite(p.hours))) return null;
	const sorted = [...points].sort((a, b) => a.expected - b.expected);
	const nBins = Math.min(10, points.length);
	const bins = Array.from({ length: nBins }, (_, i) => {
		const ps = sorted.slice(
			Math.floor((i * points.length) / nBins),
			Math.floor(((i + 1) * points.length) / nBins)
		);
		const hours = ps.reduce((n, p) => n + p.hours, 0);
		return {
			bin: i + 1,
			n: ps.length,
			min: ps[0].expected,
			max: ps.at(-1)!.expected,
			hours,
			expected: ps.reduce((n, p) => n + p.expected, 0) / hours,
			observed: ps.reduce((n, p) => n + p.observed, 0) / hours
		};
	});
	const zero = (key: 'site' | 'season') =>
		[...new Set(points.map((p) => p[key]))].map((group) => {
			const ps = points.filter((p) => p[key] === group);
			return {
				group,
				n: ps.length,
				observed: ps.filter((p) => p.observed === 0).length / ps.length,
				expected: ps.reduce((n, p) => n + p.zero, 0) / ps.length
			};
		});
	return { n: points.length, bins, sites: zero('site'), seasons: zero('season'), points };
}
