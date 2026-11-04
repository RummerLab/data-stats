import type { Dataset } from '../data';
import { boxStats } from '#lib/stats';
import { recapturePairs } from './common';

const stages = ['open', 'semi', 'closed'];
// The labels /neonates uses elsewhere ("open → healing → healed").
export const SCAR_LABELS = ['Open', 'Healing', 'Healed'];
/** A transition needs this many pairs before its days-between box is drawn. */
export const MIN_BOX_PAIRS = 5;

/** Consecutive known-stage field observations, within one season; never infer healing dates. */
export function scarTransitions(d: Pick<Dataset, 'captures' | 'individuals' | 'labSharks'>) {
	const conflicts = new Set(d.individuals.filter((i) => i.conflict).map((i) => i.id));
	return (['Cm', 'Na'] as const).map((species) => {
		const field = d.captures.filter((c) => c.kind === 'field' && c.species === species);
		const known = field.filter(
			(c) => c.umbilical && stages.includes(c.umbilical) && c.date && c.individualId
		);
		const excluded = { identity: 0, chronology: 0, season: 0, lab: 0 };
		const dayCounts = new Map<string, number>();
		for (const c of known) {
			const key = `${c.individualId}|${c.date}`;
			dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
		}
		const pairs = recapturePairs(known).filter((p) => {
			if (conflicts.has(p.id)) {
				excluded.identity++;
				return false;
			}
			if (
				p.days <= 0 ||
				dayCounts.get(`${p.id}|${p.a.date}`)! > 1 ||
				dayCounts.get(`${p.id}|${p.b.date}`)! > 1
			) {
				excluded.chronology++;
				return false;
			}
			if (p.a.season !== p.b.season) {
				excluded.season++;
				return false;
			}
			if (
				p.a.toLab ||
				d.labSharks.some(
					(l) =>
						l.individualId === p.id &&
						(!l.arrivalDate || l.arrivalDate <= p.b.date!) &&
						(!l.releaseDate || l.releaseDate >= p.a.date!)
				)
			) {
				excluded.lab++;
				return false;
			}
			return true;
		});
		const rows = stages.flatMap((from, i) =>
			stages.map((to, j) => {
				const ps = pairs.filter((p) => p.a.umbilical === from && p.b.umbilical === to);
				return {
					from: SCAR_LABELS[i],
					to: SCAR_LABELS[j],
					pairs: ps.length,
					sharks: new Set(ps.map((p) => p.id)).size,
					backward: j < i,
					stats: ps.length >= MIN_BOX_PAIRS ? boxStats(ps.map((p) => p.days)) : null
				};
			})
		);
		const contributions = new Map<string, number>();
		for (const p of pairs) contributions.set(p.id, (contributions.get(p.id) ?? 0) + 1);
		return {
			species,
			labels: SCAR_LABELS,
			rows,
			values: stages.map((_, i) => rows.slice(i * 3, i * 3 + 3).map((r) => r.pairs)),
			pairs: pairs.length,
			sharks: contributions.size,
			unknown: field.filter((c) => !c.umbilical || !stages.includes(c.umbilical)).length,
			missingIdentityOrDate: field.filter((c) => !c.date || !c.individualId).length,
			excluded,
			backward: rows.filter((r) => r.backward).reduce((n, r) => n + r.pairs, 0),
			contributions: [...new Set(contributions.values())]
				.sort((a, b) => a - b)
				.map((n) => ({
					pairs: n,
					sharks: [...contributions.values()].filter((v) => v === n).length
				}))
		};
	});
}
