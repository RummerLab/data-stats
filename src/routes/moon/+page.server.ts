import { memo } from '#lib/server/data';
import { binnedMean, cpueOf, effortSets, fieldCaptures, round } from '#lib/server/analytics/common';
import { MOON_PHASES } from '#lib/server/astro';
import { histogram, median, welch } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('moon', (d) => {
		const sets = effortSets(d);
		const phaseIdx = (p: number | null) => (p == null ? null : Math.round(p * 8) % 8);
		const phases = MOON_PHASES.map((name, i) => {
			const ss = sets.filter((s) => phaseIdx(s.moonPhase) === i);
			return {
				name,
				n: ss.length,
				cpue: round(cpueOf(ss)),
				cpueCm: round(cpueOf(ss, 'cpueCm')),
				cpueNa: round(cpueOf(ss, 'cpueNa'))
			};
		});
		const up = sets.filter((s) => s.moonAltMid != null && s.moonAltMid > 0);
		const down = sets.filter((s) => s.moonAltMid != null && s.moonAltMid <= 0);
		const caps = fieldCaptures(d).filter(
			(c) => c.minAfterSunset != null && c.minAfterSunset > -180 && c.minAfterSunset < 360
		);
		const dark = caps.filter((c) => (c.moonIllum ?? 0.5) < 0.25).map((c) => c.minAfterSunset);
		const bright = caps.filter((c) => (c.moonIllum ?? 0.5) > 0.75).map((c) => c.minAfterSunset);
		const w = welch(bright, dark);
		return {
			phases,
			illum: binnedMean(
				sets,
				(s) => (s.moonIllum == null ? null : s.moonIllum * 100),
				(s) => s.cpue,
				[0, 10, 30, 50, 70, 90, 100],
				(a, b) => `${a}–${b}%`
			),
			upDown: [
				{ k: 'Moon above horizon', n: up.length, cpue: round(cpueOf(up)) },
				{ k: 'Moon below horizon', n: down.length, cpue: round(cpueOf(down)) }
			],
			timing: {
				dark: median(dark),
				bright: median(bright),
				nDark: dark.length,
				nBright: bright.length,
				p: w?.p ?? null,
				edges: Array.from({ length: 19 }, (_, i) => -60 + i * 20),
				histDark: histogram(dark, -60, 300, 20).map((b) => b.count),
				histBright: histogram(bright, -60, 300, 20).map((b) => b.count)
			}
		};
	});
