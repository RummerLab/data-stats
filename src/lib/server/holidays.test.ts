import { describe, expect, it } from 'vitest';
import { dayType, easter, holidayOn, publicHolidays, schoolDays } from './holidays';

describe('French Polynesia holidays', () => {
	it('computes Easter', () => {
		expect(easter(2014)).toBe('2014-04-20');
		expect(easter(2019)).toBe('2019-04-21');
		expect(easter(2025)).toBe('2025-04-20');
	});

	it('includes the Easter-based and local holidays', () => {
		const h = publicHolidays(2025);
		expect(h.get('2025-04-18')).toBe('Good Friday');
		expect(h.get('2025-05-29')).toBe('Ascension Day');
		expect(h.get('2025-06-09')).toBe('Whit Monday');
		expect(h.get('2025-03-05')).toBe('Arrival of the Gospel');
		expect(h.size).toBe(14);
	});

	it("swaps Autonomy Day for Matari'i i ni'a in 2025", () => {
		expect(holidayOn('2024-06-29')).toBe('Internal Autonomy Day');
		expect(holidayOn('2024-11-20')).toBeNull();
		expect(holidayOn('2025-06-29')).toBeNull();
		expect(holidayOn('2025-11-20')).toBe("Matari'i i ni'a");
	});

	it('labels each day once', () => {
		expect(dayType('2023-12-25')).toBe('Public holiday');
		expect(dayType('2023-12-30')).toBe('Festive period'); // a Saturday
		expect(dayType('2023-11-18')).toBe('Weekend');
		expect(dayType('2023-11-21')).toBe('Weekday');
	});

	it('spreads school breaks over their days', () => {
		const school = schoolDays([
			{ name: 'November break', start: '2023-10-28', end: '2023-11-12' },
			{ name: 'Christmas break', start: '2023-12-16', end: '2024-01-14' }
		]);
		expect(school.size).toBe(16 + 30);
		expect(school.get('2023-12-31')).toBe('Christmas break');
		expect(dayType('2023-11-01', school)).toBe('Public holiday');
		expect(dayType('2023-11-04', school)).toBe('School holidays'); // a Saturday
		expect(dayType('2023-11-13', school)).toBe('Weekday');
		expect(dayType('2023-12-18', school)).toBe('School holidays');
		expect(dayType('2023-12-20', school)).toBe('Festive period');
	});
});
