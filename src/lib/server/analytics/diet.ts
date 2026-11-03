/**
 * Stomach contents from gastric lavage (#40): 2016-17 (full/empty + contents) and 2020-21
 * (empty / traces / full). "Fed" = anything in the stomach (full or traces). Exploratory: a
 * lavage only sees the last few hours of feeding.
 */
import { boxStats, chiSquare, welch, wilson } from '#lib/stats';
import type { Capture, Dataset } from '../data';
import { fieldCaptures, fulton, round } from './common';

export const PREY_GROUPS = [
	{ key: 'fish', label: 'Fish', re: /fish|bone|vertebra|lens|scale|surgeon|tuna|goby|mullet/ },
	{ key: 'crustacean', label: 'Crustaceans', re: /shrimp|crab|crustac|prawn|isopod|amphipod/ },
	{ key: 'other', label: 'Worms and molluscs', re: /worm|squid|octopus|mollus|snail|polych/ },
	{ key: 'plastic', label: 'Plastic', re: /plastic/ },
	{ key: 'unknown', label: 'Unidentified', re: /goo|unident|chunk|meat|muscle|piece|mush/ }
] as const;

const fed = (c: Capture) => c.stomach === 'full' || c.stomach === 'traces';

function share(caps: Capture[]) {
	const k = caps.filter(fed).length;
	const ci = wilson(k, caps.length);
	return {
		n: caps.length,
		fed: k,
		rate: caps.length ? round(k / caps.length, 3) : null,
		lo: round(ci?.lo, 3),
		hi: round(ci?.hi, 3)
	};
}

/** Chi-square across groups of fed / not fed. */
const test = (groups: Capture[][]) =>
	chiSquare(groups.map((g) => [g.filter(fed).length, g.filter((c) => !fed(c)).length]));

const MOON = [
	{ label: 'New moon', test: (p: number) => p < 0.125 || p >= 0.875 },
	{ label: 'First quarter', test: (p: number) => p >= 0.125 && p < 0.375 },
	{ label: 'Full moon', test: (p: number) => p >= 0.375 && p < 0.625 },
	{ label: 'Last quarter', test: (p: number) => p >= 0.625 && p < 0.875 }
];

const AFTER_SUNSET = [
	{ label: 'Before sunset', lo: -Infinity, hi: 0 },
	{ label: '0–1 h after', lo: 0, hi: 60 },
	{ label: '1 h or more after', lo: 60, hi: Infinity }
];

const SCAR = [
	{ key: 'open', label: 'Open scar (newborn)' },
	{ key: 'semi', label: 'Healing scar' },
	{ key: 'closed', label: 'Healed scar' }
] as const;

export function diet(d: Dataset) {
	const checked = fieldCaptures(d).filter((c) => c.stomach != null);
	const cm = checked.filter((c) => c.species === 'Cm');
	if (!checked.length) return null;

	const bySeason = [...new Set(checked.map((c) => `${c.season}|${c.species}`))]
		.sort()
		.map((k) => {
			const [season, species] = k.split('|');
			const g = checked.filter((c) => c.season === season && c.species === species);
			return {
				season,
				species,
				n: g.length,
				full: g.filter((c) => c.stomach === 'full').length,
				traces: g.filter((c) => c.stomach === 'traces').length,
				empty: g.filter((c) => c.stomach === 'empty').length
			};
		})
		.filter((r) => r.n >= 10);

	const scarGroups = SCAR.map((s) => cm.filter((c) => c.umbilical === s.key));
	const moonGroups = MOON.map((m) => cm.filter((c) => c.moonPhase != null && m.test(c.moonPhase)));
	const sunsetGroups = AFTER_SUNSET.map((b) =>
		cm.filter(
			(c) => c.minAfterSunset != null && c.minAfterSunset >= b.lo && c.minAfterSunset < b.hi
		)
	);

	// Body condition of fed vs empty blacktips (Fulton's K).
	const kFed = cm.filter(fed).map(fulton);
	const kEmpty = cm.filter((c) => !fed(c)).map(fulton);
	const kTest = welch(kFed, kEmpty);

	// Prey groups named in the free-text contents (any species).
	const withContents = checked.filter((c) => c.stomachContents);
	const prey = PREY_GROUPS.map((g) => ({
		key: g.key,
		label: g.label,
		n: withContents.filter((c) => g.re.test(c.stomachContents!.toLowerCase())).length
	})).filter((g) => g.n > 0);

	return {
		n: checked.length,
		nCm: cm.length,
		seasons: [...new Set(checked.map((c) => c.season))].sort(),
		bySeason,
		cmFed: share(cm),
		scar: SCAR.map((s, i) => ({ label: s.label, ...share(scarGroups[i]) })),
		scarTest: test(scarGroups),
		moon: MOON.map((m, i) => ({ label: m.label, ...share(moonGroups[i]) })),
		moonTest: test(moonGroups),
		sunset: AFTER_SUNSET.map((b, i) => ({ label: b.label, ...share(sunsetGroups[i]) })),
		sunsetTest: test(sunsetGroups),
		condition: [
			{ name: 'Food in stomach', stats: boxStats(kFed) },
			{ name: 'Empty', stats: boxStats(kEmpty) }
		].filter((b) => b.stats && b.stats.n >= 5),
		conditionP: kTest?.p ?? null,
		withContents: withContents.length,
		prey
	};
}
