import { describe, expect, it } from 'vitest';
import { IssueLog } from './issues';
import { checkRecaptures } from './recaptures';

// Synthetic captures only.
const row = (
	date: string,
	captureNo: number | null,
	o: {
		tags?: string[];
		season?: string;
		kind?: 'field' | 'hook' | 'lab_release';
		row?: number;
	} = {}
) => ({
	season: o.season ?? '2020-2021',
	date,
	captureNo,
	kind: o.kind ?? 'field',
	tags: o.tags ?? ['900000000000001'],
	ref: { file: 'log.xlsx', sheet: 'Shark Log', row: o.row ?? 2 }
});

const run = (rows: ReturnType<typeof row>[], inLab = false) => {
	const log = new IssueLog();
	checkRecaptures(rows, log, inLab);
	return log.items;
};

describe('checkRecaptures (#168)', () => {
	it('stays quiet when the numbers follow the tag', () => {
		expect(run([row('2020-11-02', 1), row('2020-12-01', 2), row('2021-01-05', 3)])).toEqual([]);
	});

	it('accepts the 2013-14 habit of writing the number of catches on every row', () => {
		const s = { tags: [], season: '2013-2014' };
		expect(run([row('2014-01-02', 2, s), row('2014-02-01', 2, s)])).toEqual([]);
		expect(
			run([row('2014-01-02', 3, s), row('2014-02-01', 3, s), row('2014-03-01', 3, s)])
		).toEqual([]);
		expect(run([row('2014-01-02', 3, s), row('2014-02-01', 3, s)])).toHaveLength(1);
	});

	it('flags a recapture with no earlier capture, tagged or not', () => {
		const tagged = run([row('2020-12-01', 2, { row: 9 }), row('2021-01-05', 3)], true);
		expect(tagged).toHaveLength(1);
		expect(tagged[0]).toMatchObject({ severity: 'warning', category: 'recaptures', row: 9 });
		expect(tagged[0].message).toMatch(/capture 2, but tag 900000000000001 .*lab records/);
		const untagged = run([row('2014-03-01', 2, { tags: [], season: '2013-2014' })]);
		expect(untagged[0].message).toMatch(/no tag and no earlier capture/);
	});

	it('flags a first capture whose tag was caught earlier that season, not in an earlier one', () => {
		const same = run([row('2020-11-02', 1), row('2020-12-01', 1)]);
		expect(same).toHaveLength(1);
		expect(same[0]).toMatchObject({ severity: 'info' });
		expect(same[0].message).toMatch(/caught on 2020-11-02 this season/);
		expect(run([row('2020-11-02', 1), row('2021-11-01', 1, { season: '2021-2022' })])).toEqual([]);
	});

	it('flags one tag on two unnumbered or first captures on the same day', () => {
		const twins = run([row('2021-02-01', 1), row('2021-02-01', 1, { row: 7 })]);
		expect(twins).toHaveLength(1);
		expect(twins[0]).toMatchObject({ severity: 'warning', row: 7 });
		expect(twins[0].message).toMatch(/two captures on 2021-02-01/);
		expect(run([row('2021-02-01', null), row('2021-02-01', null)])).toHaveLength(1);
		expect(run([row('2021-02-01', 1), row('2021-02-01', 2)])).toEqual([]);
	});

	it('ignores hook-and-line and lab-release rows', () => {
		expect(run([row('2020-11-02', 1, { kind: 'lab_release' }), row('2020-12-01', 2)])).toHaveLength(
			1
		);
		expect(run([row('2020-11-02', 2, { kind: 'hook' })])).toEqual([]);
	});
});
