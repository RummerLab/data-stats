import { expect, it } from 'vitest';
import type { Dataset, Capture } from '../data';
import { scarTransitions } from './scarTransitions';

const cap = (id: string, date: string, stage: string | null, extra = {}) =>
	({
		individualId: id,
		date,
		umbilical: stage,
		season: '2020-2021',
		species: 'Cm',
		kind: 'field',
		...extra
	}) as Capture;
it('skips unknown stages but retains backward transitions and per-shark contributions', () => {
	const d = {
		captures: [
			cap('a', '2020-10-01', 'open'),
			cap('a', '2020-10-03', null),
			cap('a', '2020-10-08', 'closed'),
			cap('a', '2020-10-10', 'semi')
		],
		individuals: [],
		labSharks: []
	};
	const [r] = scarTransitions(d);
	expect(r).toMatchObject({
		pairs: 2,
		sharks: 1,
		unknown: 1,
		backward: 1,
		contributions: [{ pairs: 2, sharks: 1 }]
	});
	// One open → healed pair: counted, but too few for a box.
	expect(r.rows[2]).toMatchObject({ from: 'Open', to: 'Healed', pairs: 1, stats: null });
});
it('draws a days-between box once a transition has five pairs', () => {
	const d = {
		captures: ['a', 'b', 'c', 'd', 'e'].flatMap((id, i) => [
			cap(id, '2020-10-01', 'open'),
			cap(id, `2020-10-${String(5 + i * 2).padStart(2, '0')}`, 'closed')
		]),
		individuals: [],
		labSharks: []
	};
	// Gaps of 4, 6, 8, 10 and 12 days.
	expect(scarTransitions(d)[0].rows[2].stats?.median).toBe(8);
});
it('excludes conflicts, same-day observations, season boundaries and lab interruptions', () => {
	const d = {
		captures: ['a', 'b', 'c', 'd'].flatMap((id) => [
			cap(id, '2020-10-01', 'open'),
			cap(
				id,
				id === 'b' ? '2020-10-01' : '2020-10-08',
				'closed',
				id === 'c' ? { season: '2021-2022' } : {}
			)
		]),
		individuals: [{ id: 'a', conflict: 'sex' }],
		labSharks: [{ individualId: 'd', arrivalDate: '2020-10-03', releaseDate: '2020-10-06' }]
	} as Pick<Dataset, 'captures' | 'individuals' | 'labSharks'>;
	expect(scarTransitions(d)[0]).toMatchObject({
		pairs: 0,
		excluded: { identity: 1, chronology: 1, season: 1, lab: 1 }
	});
});
