import { describe, expect, it } from 'vitest';
import { parseCrew } from './crew';
import {
	ageClassOf,
	contentsOf,
	dateOf,
	dmsToDecimal,
	fixSeasonYear,
	headerKey,
	num,
	seasonOf,
	sexOf,
	speciesOf,
	stomachOf,
	tagsOf,
	timeOf,
	umbilicalFromNotes,
	umbilicalOf
} from './normalize';
import { resolveSite } from './sites';
import { ExcelDate } from './xlsx';

describe('cell parsers', () => {
	it('reads stomach fullness and contents (#40)', () => {
		expect(stomachOf('Full')).toBe('full');
		expect(stomachOf('empty')).toBe('empty');
		expect(stomachOf('almost empty')).toBe('traces');
		expect(stomachOf('traces of food')).toBe('traces');
		expect(stomachOf('no sample')).toBeNull();
		expect(stomachOf('n/a')).toBeNull();
		expect(stomachOf('worm found')).toBeNull();
		expect(contentsOf('small fish, shrimp')).toBe('small fish, shrimp');
		for (const v of ['na', 'no food', 'traces of food (too small for sample)', 'no sample'])
			expect(contentsOf(v)).toBeNull();
	});

	it('parses numbers and rejects NA spellings', () => {
		expect(num('1,2')).toBe(1.2);
		expect(num('45 mm')).toBe(45);
		expect(num('~0.9kg')).toBe(0.9);
		for (const na of ['na', 'N/A', '#N/A', '-', '?', '']) expect(num(na)).toBeNull();
	});

	it('parses dates in several forms', () => {
		expect(dateOf(new ExcelDate(41570))).toBe('2013-10-23');
		expect(dateOf('28/11/2015 17:00')).toBe('2015-11-28');
		expect(dateOf('2014-01-03')).toBe('2014-01-03');
		expect(dateOf('31/02/2014')).toBeNull();
	});

	it('parses clock times', () => {
		expect(timeOf('18h30')).toBe(18 * 60 + 30);
		expect(timeOf('19.08')).toBe(19 * 60 + 8);
		expect(timeOf(new ExcelDate(0.5))).toBe(720);
		expect(timeOf('Spring low (18.24)')).toBe(18 * 60 + 24);
		expect(timeOf('LAB')).toBeNull();
	});

	it('normalises sex, species and age', () => {
		expect(sexOf('male ')).toBe('M');
		expect(sexOf('Female')).toBe('F');
		expect(sexOf('NA')).toBeNull();
		expect(speciesOf('C. melanopterus')).toBe('Cm');
		expect(speciesOf('NA')).toBe('Na');
		expect(speciesOf('Nurse')).toBe('Nf');
		expect(speciesOf('Gf1')).toBe('Nf');
		expect(ageClassOf('Juvenile 1y')).toBe('juvenile');
		expect(ageClassOf('neonate')).toBe('neonate');
	});

	it('reads umbilical scars from columns and notes', () => {
		expect(umbilicalOf('OPEN')).toBe('open');
		expect(umbilicalOf('Medium closed')).toBe('semi');
		expect(umbilicalFromNotes('Umbilical scar open, Peps was painting the fin')).toBe('open');
		expect(umbilicalFromNotes('cordon ombilical non cicatrisé')).toBe('open');
		expect(umbilicalFromNotes('Umbilical scare closed')).toBe('closed');
	});

	it('extracts PIT and COFA tags, including re-tags', () => {
		expect(tagsOf(955000004245160)).toEqual(['955000004245160']);
		expect(tagsOf('COFA 03691 -> COFA 12589')).toEqual(['COFA 03691', 'COFA 12589']);
		expect(tagsOf('Recap. COFA12628')).toEqual(['COFA 12628']);
		expect(tagsOf('na')).toEqual([]);
	});

	it('converts DMS coordinates', () => {
		expect(dmsToDecimal(` 17°33'15.12"S`)).toBeCloseTo(-17.5542, 4);
		expect(dmsToDecimal(`149°52'46.13"W`)).toBeCloseTo(-149.87948, 4);
	});

	it('assigns seasons and fixes off-by-one-year dates', () => {
		expect(seasonOf('2014-03-01')).toBe('2013-2014');
		expect(seasonOf('2014-10-01')).toBe('2014-2015');
		expect(fixSeasonYear('2014-01-11', '2014-2015')).toEqual({ date: '2015-01-11', fixed: true });
		expect(fixSeasonYear('2014-11-11', '2014-2015')).toEqual({ date: '2014-11-11', fixed: false });
	});

	it('normalises headers', () => {
		expect(headerKey('Shark N°')).toBe('shark n');
		expect(headerKey('D.O. (%)')).toBe('d o %');
		expect(headerKey('#Cm ')).toBe('#cm');
		expect(headerKey('nombre de nouveaux CM capturés')).toBe('nombre de nouveaux cm captures');
	});
});

describe('sites', () => {
	it('folds spelling variants into nurseries', () => {
		expect(resolveSite("Piha'ena")).toBe('pihaena');
		expect(resolveSite('Piahaena')).toBe('pihaena');
		expect(resolveSite('PDP')).toBe('paorea');
		expect(resolveSite('Pointe de Paroa')).toBe('paroa');
		expect(resolveSite('Tiki2')).toBe('tiki');
		expect(resolveSite('Tiki (outside)')).toBe('tiahura');
		expect(resolveSite('Vaianae')).toBe('vaiane');
		expect(resolveSite('Vaiare 2')).toBe('vaiare');
		expect(resolveSite('Marina Vaiare')).toBe('marina-vaiare');
		expect(resolveSite('Papetoai (Woody)')).toBe('papetoai');
		expect(resolveSite('Plage public')).toBe('mareto');
		expect(resolveSite('Tetiaroa-Chanel Oroatera')).toBe('tetiaroa');
		expect(resolveSite('25')).toBeNull();
	});
});

describe('crew', () => {
	it('splits and normalises names', () => {
		expect(parseCrew('Ian, Kim, Gail')).toEqual(['Ian', 'Kim', 'Gail']);
		expect(parseCrew('TUI , MGX , PAOLA')).toEqual(['Tui', 'MGX', 'Paola']);
		expect(parseCrew('Samuel, Elena, Shamil, José; Johanne; Tamatoa')).toEqual([
			'Samuel',
			'Elena',
			'Shamil',
			'José',
			'Johanne',
			'Tamatoa'
		]);
		expect(parseCrew('Kim + family')).toEqual(['Kim']);
		expect(parseCrew('Tuiterai, Aurélie')).toEqual(['Tui', 'Aurélie']);
		expect(parseCrew('Everyone')).toEqual([]);
	});
});
