/**
 * Measurement coverage (#123): how many records have a value for each measurement, season by
 * season, and the sample selection behind the catch model. Coverage is availability, not validity.
 */
import type { Dataset, Capture, SetRow } from '../data';
import { effortSets, round } from './common';
import { MIN_MODEL_SETS, MIN_SITE_CATCH, MIN_SITE_SETS, selectCatchModel } from './catchModel';

/** Availability is distinct from validity; zero is a recorded value. */
export function coverageCell<T>(
	rows: T[],
	present: (r: T) => boolean,
	eligible: (r: T) => boolean = () => true
) {
	const subset = rows.filter(eligible),
		available = subset.filter(present).length;
	return {
		available,
		eligible: subset.length,
		percent: subset.length ? (100 * available) / subset.length : null
	};
}

export function measurementCoverage(d: Dataset) {
	const captures = d.captures.filter((c) => c.kind === 'field');
	const sets = d.sets.filter((s) => s.gear === 'Gillnet');
	const panel = <T extends { season: string }>(
		rows: T[],
		fields: { label: string; present: (r: T) => boolean; eligible?: (r: T) => boolean }[]
	) => {
		const table = d.seasons.flatMap((season) =>
			fields.map((f) => {
				const c = coverageCell(
					rows.filter((r) => r.season === season),
					f.present,
					f.eligible
				);
				return { season, field: f.label, ...c, percent: round(c.percent, 1) ?? null };
			})
		);
		return {
			fields: fields.map((f) => f.label),
			seasons: d.seasons,
			rows: table,
			values: d.seasons.map((s) => table.filter((r) => r.season === s).map((r) => r.percent))
		};
	};
	return {
		captures: panel<Capture>(captures, [
			{ label: 'Length', present: (c) => c.tlMm != null },
			{ label: 'Mass', present: (c) => c.massKg != null },
			{ label: 'Length + mass', present: (c) => c.tlMm != null && c.massKg != null },
			{ label: 'Sex', present: (c) => c.sex === 'M' || c.sex === 'F' },
			{ label: 'Scar', present: (c) => c.umbilical != null },
			{ label: 'Capture time', present: (c) => c.captureMin != null },
			{
				label: 'Lavage result',
				present: (c) => c.stomach != null,
				eligible: (c) => c.lavage === 1 || c.stomach != null
			}
		]),
		sets: panel<SetRow>(sets, [
			{ label: 'Duration', present: (s) => s.durationMin != null },
			{ label: 'Start time', present: (s) => s.startMin != null },
			{ label: 'Crew size', present: (s) => s.crewSize != null },
			{ label: 'Water °C', present: (s) => s.waterTemp != null },
			{ label: 'pH', present: (s) => s.ph != null },
			{ label: 'Oxygen', present: (s) => s.doMg != null },
			{ label: 'Salinity', present: (s) => s.salinity != null },
			{ label: 'SST', present: (s) => s.sst != null },
			{ label: 'Rain', present: (s) => s.rain24h != null },
			{ label: 'Tide', present: (s) => s.tideMidMm != null }
		]),
		unknownLavage: captures.filter((c) => c.lavage == null && c.stomach == null).length,
		notLavaged: captures.filter((c) => c.lavage === 0 && c.stomach == null).length
	};
}

/**
 * The catch model's sample, filter by filter, from the same selectCatchModel() the fits use. The
 * first three steps are sequential; each species model then drops nurseries from the all-shark
 * sample, so its "left out" counts from that sample, not from the bar above.
 */
export function modelSelectionFlow(d: Dataset) {
	const s = selectCatchModel(d);
	const timed = effortSets(d).filter((x) => x.cpue != null);
	const step = (stage: string, rule: string, rows: SetRow[], from: number) => ({
		stage,
		rule,
		remaining: rows.length,
		nurseries: new Set(rows.map((x) => x.siteId).filter(Boolean)).size,
		excluded: from - rows.length
	});
	const rows = [
		step('Timed gillnet sets', 'Gillnet sets with a duration', timed, timed.length),
		step(
			'Every variable recorded',
			'Date, nursery and every model variable',
			s.complete,
			timed.length
		),
		step(
			`Nurseries with ≥ ${MIN_SITE_SETS} sets`,
			`The sample for all sharks: nurseries with at least ${MIN_SITE_SETS} of those sets`,
			s.base,
			s.complete.length
		),
		...(
			[
				['Cm', 'Blacktip model', 'blacktips'],
				['Na', 'Sicklefin lemon model', 'sicklefin lemons']
			] as const
		).map(([code, label, plural]) =>
			step(
				label,
				`From the all-shark sample: nurseries where at least ${MIN_SITE_CATCH} ${plural} were caught`,
				s.selectSpecies(code).rows,
				s.base.length
			)
		)
	];
	// A set can miss several variables, so these overlap and can add up to more than the step.
	const missing = [
		{ label: 'date', n: timed.filter((x) => !x.date).length },
		{ label: 'nursery', n: timed.filter((x) => !x.siteId).length },
		...s.vars.map((v) => ({
			label: v.label.toLowerCase(),
			n: timed.filter((x) => v.get(x) == null).length
		}))
	]
		.filter((m) => m.n > 0)
		.sort((a, b) => b.n - a.n);
	return {
		rows,
		missing,
		minModelSets: MIN_MODEL_SETS,
		minSiteSets: MIN_SITE_SETS,
		modelSets: s.base.length,
		nurseries: s.sites.length,
		seasons: s.seasons.length
	};
}
