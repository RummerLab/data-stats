import { describe, expect, it } from 'vitest';
import { IssueLog } from './issues';
import { yearOffSetDate } from './logs';
import { pressureFromDataset } from './reference';

describe('pressureFromDataset (#131)', () => {
	// Synthetic scores, laid out like the Bouyoucos et al. (2024) dataset.
	const rows = [
		{ site: 'Apaura', fish: '10', tramp: '0.1', art: '0' },
		{ site: 'Haapiti', fish: '30', tramp: '0.3', art: '0.2' },
		{ site: 'Pointe de Paorea', fish: '20', tramp: '0.2', art: '0.1' },
		{ site: 'Nowhere', fish: '5', tramp: '0.5', art: '0.5' }
	];

	it('normalises each metric, averages them and tiers the composite in thirds of 0–1', () => {
		const log = new IssueLog();
		const out = pressureFromDataset(rows, log, 'external/pressure.csv');
		expect(out.map((s) => s.siteId)).toEqual(['apaura', 'haapiti', 'paorea']);
		expect(out[0]).toMatchObject({ fishingEffort: 10, humanImpact: 0.1, artificialisation: 0 });
		expect(out.map((s) => s.composite)).toEqual([0, 1, 0.5]);
		expect(out.map((s) => s.tier)).toEqual(['Low', 'High', 'Medium']);
		expect(log.items).toHaveLength(1);
		expect(log.items[0].message).toMatch(/unknown site "Nowhere"/);
	});

	it('leaves the composite blank when a metric is missing', () => {
		const out = pressureFromDataset(
			[rows[0], { ...rows[1], art: '' }, rows[2]],
			new IssueLog(),
			'external/pressure.csv'
		);
		expect(out[1].composite).toBeNull();
		expect(out[1].tier).toBeNull();
	});
});

describe('yearOffSetDate (#133)', () => {
	const sets = [
		{ siteId: 'tiki', date: '2016-03-10' },
		{ siteId: 'apaura', date: '2016-03-03' }
	];

	it('dates a year-off capture by its set at the same nursery', () => {
		expect(yearOffSetDate({ writtenDate: '2015-01-20', setNo: 94, siteId: 'apaura' }, sets)).toBe(
			'2016-03-03'
		);
	});

	it('uses the only set with that number when the nursery differs or is missing', () => {
		expect(yearOffSetDate({ writtenDate: '2015-01-20', setNo: 94, siteId: null }, [sets[0]])).toBe(
			'2016-03-10'
		);
		expect(yearOffSetDate({ writtenDate: '2015-01-20', setNo: 94, siteId: null }, sets)).toBeNull();
	});

	it('ignores captures whose date was in season or that have no set number', () => {
		expect(yearOffSetDate({ setNo: 94, siteId: 'apaura' }, sets)).toBeNull();
		expect(
			yearOffSetDate({ writtenDate: '2015-01-20', setNo: null, siteId: 'apaura' }, sets)
		).toBeNull();
	});
});
