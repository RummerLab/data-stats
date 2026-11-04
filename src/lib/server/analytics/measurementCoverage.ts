import type { Dataset, Capture, SetRow } from '../data';
import { effortSets } from './common';
import { selectCatchModel } from './catchModel';

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
			fields.map((f) => ({
				season,
				field: f.label,
				...coverageCell(
					rows.filter((r) => r.season === season),
					f.present,
					f.eligible
				)
			}))
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
export function modelSelectionFlow(d: Dataset) {
	const s = selectCatchModel(d);
	return ['all', 'Cm', 'Na'].map((response) => {
		const species = s.selectSpecies(response as 'all' | 'Cm' | 'Na');
		const counts = [effortSets(d).length, s.complete.length, s.base.length, species.rows.length];
		return {
			name: response,
			rows: counts.map((remaining, i) => ({
				stage: [
					'Timed gillnet sets',
					'Complete dates, nursery and environment',
					'Nurseries with ≥30 complete sets',
					'Species nursery support (≥10 catches)'
				][i],
				remaining,
				excluded: i ? counts[i - 1] - remaining : 0
			}))
		};
	});
}
