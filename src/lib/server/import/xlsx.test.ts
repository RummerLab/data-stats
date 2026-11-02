import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { columnIndex, decodeXml, ExcelDate, isDateFormat, readWorkbook } from './xlsx';

const fixture = (name: string) => readFileSync(join(process.env.DATA_DIR!, name));

describe('xlsx reader', () => {
	it('reads sheets, inline strings, numbers, dates and times', () => {
		const wb = readWorkbook(fixture('Physioshark_Shark Log 2021-2022.xlsx'));
		expect(wb.sheets.map((s) => s.name)).toEqual(['Set Log', 'Cm Log Juv', 'Na Log Juv']);
		const set = wb.sheet('Set Log')!;
		expect(set.rows[0].cells[1]).toBe('Site');
		const first = set.rows[1].cells;
		expect(first[0]).toBe(1);
		expect(first[3]).toBeInstanceOf(ExcelDate);
		expect((first[3] as ExcelDate).toISODate()).toBe('2021-09-20');
		expect((first[5] as ExcelDate).isTimeOnly).toBe(true);
		expect((first[5] as ExcelDate).toMinutes()).toBeGreaterThanOrEqual(17 * 60);
	});

	it('keeps original row numbers', () => {
		const wb = readWorkbook(fixture('Physioshark Moorea nursery location GPS.xlsx'));
		expect(wb.sheets[0].rows.map((r) => r.r)).toEqual([1, 2, 3, 4]);
	});

	it('detects date number formats', () => {
		expect(isDateFormat('dd/mm/yyyy')).toBe(true);
		expect(isDateFormat('h:mm')).toBe(true);
		expect(isDateFormat('[h]:mm:ss')).toBe(true);
		expect(isDateFormat('0.00')).toBe(false);
		expect(isDateFormat('#,##0')).toBe(false);
		expect(isDateFormat('[Red]0.00')).toBe(false);
		expect(isDateFormat('"Day "0')).toBe(false);
	});

	it('decodes entities and OOXML escapes', () => {
		expect(decodeXml('a &amp; b &lt;c&gt; &#233; _x000D_')).toBe('a & b <c> é \r');
	});

	it('converts column letters', () => {
		expect(columnIndex('A')).toBe(0);
		expect(columnIndex('Z')).toBe(25);
		expect(columnIndex('AA')).toBe(26);
		expect(columnIndex('AF')).toBe(31);
	});

	it('handles Excel serial dates and times', () => {
		expect(new ExcelDate(45000).toISODate()).toBe('2023-03-15');
		expect(new ExcelDate(0.75).toMinutes()).toBe(18 * 60);
		expect(new ExcelDate(45000.5).toISODate()).toBe('2023-03-15');
	});
});
