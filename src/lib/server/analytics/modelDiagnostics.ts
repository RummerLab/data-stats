/**
 * In-sample fit checks for the catch model (#125): calibration, zero-catch shares and Pearson
 * residuals, from the exact rows, design matrix, counts and offsets of each fit. Only what the
 * charts draw goes to the page, rounded, so /drivers stays light (#76).
 */
import type { SetRow } from '../data';
import type { GlmFit } from './glm';
import { round, seasonDay } from './common';

/** Calibration groups: sets sorted by expected count, split into this many near-equal bins. */
export const CALIBRATION_BINS = 10;

/** NB2 P(Y = 0) = (θ / (θ + μ))^θ, with the Poisson limit e^−μ as θ → ∞. */
export function zeroProbability(mu: number, theta: number) {
	return Number.isFinite(theta) ? Math.exp(-theta * Math.log1p(mu / theta)) : Math.exp(-mu);
}

/** Same X, response and offsets as the fit; all diagnostics are in-sample. */
export function modelDiagnostics(
	fit: GlmFit | null,
	rows: SetRow[],
	X: number[][],
	y: number[],
	offsets: number[],
	siteLabel: (id: string) => string = (id) => id
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
	const nBins = Math.min(CALIBRATION_BINS, points.length);
	const bins = Array.from({ length: nBins }, (_, i) => {
		const ps = sorted.slice(
			Math.floor((i * points.length) / nBins),
			Math.floor(((i + 1) * points.length) / nBins)
		);
		const hours = ps.reduce((n, p) => n + p.hours, 0);
		return {
			bin: i + 1,
			n: ps.length,
			min: round(ps[0].expected, 2)!,
			max: round(ps.at(-1)!.expected, 2)!,
			hours: round(hours, 1)!,
			// Rates are summed sharks over summed net-hours, never a mean of per-set rates.
			expected: round(ps.reduce((n, p) => n + p.expected, 0) / hours, 3)!,
			observed: round(ps.reduce((n, p) => n + p.observed, 0) / hours, 3)!
		};
	});
	const zero = (key: 'site' | 'season', label: (v: string) => string) =>
		[...new Set(points.map((p) => p[key]))].sort().map((group) => {
			const ps = points.filter((p) => p[key] === group);
			return {
				group: label(group),
				n: ps.length,
				observed: round((100 * ps.filter((p) => p.observed === 0).length) / ps.length, 1)!,
				expected: round((100 * ps.reduce((n, p) => n + p.zero, 0)) / ps.length, 1)!
			};
		});
	return {
		n: points.length,
		bins,
		sites: zero('site', siteLabel),
		seasons: zero('season', (s) => s),
		// Columns rather than objects: a few thousand points per model.
		residuals: {
			expected: points.map((p) => Number(p.expected.toPrecision(3))),
			day: points.map((p) => p.day),
			value: points.map((p) => round(p.residual, 2)!)
		}
	};
}
