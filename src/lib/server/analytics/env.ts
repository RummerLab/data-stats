/** Per-set explanatory variables used by the drivers, tides, moon and weather pages (#45). */
import { spearman, pairs } from '#lib/stats';
import type { SetRow } from '../data';
import { seasonDay } from './common';

export interface SetVariable {
	key: string;
	label: string;
	unit: string;
	dp: number;
	get: (s: SetRow) => number | null;
}

export const SET_VARIABLES: SetVariable[] = [
	{ key: 'sst', label: 'Sea-surface temperature', unit: '°C', dp: 1, get: (s) => s.sst },
	{ key: 'sstAnom', label: 'SST anomaly', unit: '°C', dp: 2, get: (s) => s.sstAnom },
	{ key: 'dhw', label: 'Degree heating weeks', unit: '°C-wk', dp: 1, get: (s) => s.dhw },
	{
		key: 'moonIllum',
		label: 'Moon illumination',
		unit: '%',
		dp: 0,
		get: (s) => (s.moonIllum == null ? null : s.moonIllum * 100)
	},
	{ key: 'moonAlt', label: 'Moon altitude mid-set', unit: '°', dp: 0, get: (s) => s.moonAltMid },
	{ key: 'tide', label: 'Tide height mid-set', unit: 'mm', dp: 0, get: (s) => s.tideMidMm },
	{ key: 'tideRange', label: 'Daily tide range', unit: 'mm', dp: 0, get: (s) => s.tideRangeMm },
	{ key: 'airTemp', label: 'Air temperature', unit: '°C', dp: 1, get: (s) => s.airTemp },
	{ key: 'wind', label: 'Wind speed', unit: 'km/h', dp: 0, get: (s) => s.windSpeed },
	{ key: 'gusts', label: 'Wind gusts', unit: 'km/h', dp: 0, get: (s) => s.gusts },
	{ key: 'rain24h', label: 'Rain in previous 24 h', unit: 'mm', dp: 1, get: (s) => s.rain24h },
	{ key: 'rainSet', label: 'Rain during the set', unit: 'mm', dp: 1, get: (s) => s.rainEvening },
	{ key: 'cloud', label: 'Cloud cover', unit: '%', dp: 0, get: (s) => s.cloudEvening },
	{ key: 'pressure', label: 'Air pressure', unit: 'hPa', dp: 1, get: (s) => s.pressure },
	{ key: 'waves', label: 'Wave height (offshore)', unit: 'm', dp: 1, get: (s) => s.waveHeight },
	{ key: 'swell', label: 'Swell height (offshore)', unit: 'm', dp: 1, get: (s) => s.swellHeight },
	{ key: 'oni', label: 'El Niño index (ONI)', unit: '', dp: 1, get: (s) => s.oni },
	{
		key: 'startSunset',
		label: 'Net in, relative to sunset',
		unit: 'min',
		dp: 0,
		get: (s) => (s.startMin != null && s.sunsetMin != null ? s.startMin - s.sunsetMin : null)
	},
	{ key: 'duration', label: 'Set duration', unit: 'min', dp: 0, get: (s) => s.durationMin },
	{ key: 'crew', label: 'Crew size', unit: 'people', dp: 0, get: (s) => s.crewSize },
	{
		key: 'waterTemp',
		label: 'Water temperature at the net',
		unit: '°C',
		dp: 1,
		get: (s) => s.waterTemp
	},
	{
		key: 'insituTemp',
		label: 'Logger water temperature during the set',
		unit: '°C',
		dp: 1,
		get: (s) => s.insituTemp
	},
	{
		key: 'day',
		label: 'Day of the season',
		unit: 'days',
		dp: 0,
		get: (s) => (s.date ? seasonDay(s.date) : null)
	},
	{ key: 'visit', label: 'Visit number at the site', unit: '', dp: 0, get: (s) => s.visit }
];

export function correlations(sets: SetRow[], y: (s: SetRow) => number | null = (s) => s.cpue) {
	return SET_VARIABLES.map((v) => {
		const r = spearman(pairs(sets, v.get, y));
		return {
			key: v.key,
			label: v.label,
			unit: v.unit,
			rho: r?.rho ?? null,
			p: r?.p ?? null,
			n: r?.n ?? 0
		};
	}).filter((r) => r.n >= 30);
}
