/**
 * Sun and moon for Moorea, computed locally (#21). Formulas follow the Astronomy Answers
 * articles (the same low-precision series used by the SunCalc library): good to about a
 * minute for sunset and a percent for moon illumination, plenty for field-ecology joins.
 *
 * All public helpers take a local calendar date (`YYYY-MM-DD`) and local clock minutes, and
 * return local clock minutes. Moorea is UTC−10 all year (no daylight saving).
 */
export const MOOREA = { lat: -17.53, lon: -149.83, utcOffsetMin: -600 } as const;

const rad = Math.PI / 180;
const dayMs = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const e = rad * 23.4397; // obliquity of the Earth

const toJulian = (ms: number) => ms / dayMs - 0.5 + J1970;
const fromJulian = (j: number) => (j + 0.5 - J1970) * dayMs;
const toDays = (ms: number) => toJulian(ms) - J2000;

const rightAscension = (l: number, b: number) =>
	Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l: number, b: number) =>
	Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const altitude = (H: number, phi: number, dec: number) =>
	Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const siderealTime = (d: number, lw: number) => rad * (280.16 + 360.9856235 * d) - lw;

function astroRefraction(h: number) {
	if (h < 0) h = 0;
	return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}

const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);

function eclipticLongitude(M: number) {
	const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
	const P = rad * 102.9372; // perihelion of the Earth
	return M + C + P + Math.PI;
}

function sunCoords(d: number) {
	const M = solarMeanAnomaly(d);
	const L = eclipticLongitude(M);
	return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

const J0 = 0.0009;
const julianCycle = (d: number, lw: number) => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, M: number, L: number) =>
	J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h: number, phi: number, d: number) =>
	Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));

/** UTC epoch ms for a local date + local minutes. */
export function localToUtcMs(date: string, minutes: number, offsetMin = MOOREA.utcOffsetMin): number {
	return Date.parse(`${date}T00:00:00Z`) + (minutes - offsetMin) * 60_000;
}

/** Local minutes (relative to the given local date's midnight) for a UTC epoch ms. */
function utcMsToLocalMinutes(ms: number, date: string, offsetMin = MOOREA.utcOffsetMin) {
	return (ms - Date.parse(`${date}T00:00:00Z`)) / 60_000 + offsetMin;
}

export interface SunTimes {
	sunrise: number;
	sunset: number;
	civilDusk: number;
	nauticalDusk: number;
	solarNoon: number;
}

export function sunTimes(date: string, lat: number = MOOREA.lat, lon: number = MOOREA.lon): SunTimes {
	const lw = rad * -lon;
	const phi = rad * lat;
	const ms = localToUtcMs(date, 12 * 60);
	const d = toDays(ms);
	const n = julianCycle(d, lw);
	const ds = approxTransit(0, lw, n);
	const M = solarMeanAnomaly(ds);
	const L = eclipticLongitude(M);
	const dec = declination(L, 0);
	const Jnoon = solarTransitJ(ds, M, L);
	const setJ = (h: number) => solarTransitJ(approxTransit(hourAngle(h * rad, phi, dec), lw, n), M, L);
	const local = (j: number) => utcMsToLocalMinutes(fromJulian(j), date);
	const sunsetJ = setJ(-0.833);
	return {
		sunrise: local(Jnoon - (sunsetJ - Jnoon)),
		sunset: local(sunsetJ),
		civilDusk: local(setJ(-6)),
		nauticalDusk: local(setJ(-12)),
		solarNoon: local(Jnoon)
	};
}

function moonCoords(d: number) {
	const L = rad * (218.316 + 13.176396 * d);
	const M = rad * (134.963 + 13.064993 * d);
	const F = rad * (93.272 + 13.22935 * d);
	const l = L + rad * 6.289 * Math.sin(M);
	const b = rad * 5.128 * Math.sin(F);
	const dt = 385_001 - 20_905 * Math.cos(M);
	return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
}

export interface MoonState {
	/** Illuminated fraction 0–1. */
	fraction: number;
	/** Phase 0 (new) → 0.25 (first quarter) → 0.5 (full) → 0.75 (last quarter) → 1. */
	phase: number;
	/** Altitude above the horizon in degrees (refraction corrected). */
	altitude: number;
}

export function moonAt(
	date: string,
	minutes: number,
	lat: number = MOOREA.lat,
	lon: number = MOOREA.lon
): MoonState {
	const ms = localToUtcMs(date, minutes);
	const d = toDays(ms);
	const s = sunCoords(d);
	const m = moonCoords(d);
	const sdist = 149_598_000;
	const phiAngle = Math.acos(
		Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
	);
	const inc = Math.atan2(sdist * Math.sin(phiAngle), m.dist - sdist * Math.cos(phiAngle));
	const angle = Math.atan2(
		Math.cos(s.dec) * Math.sin(s.ra - m.ra),
		Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
	);
	const lw = rad * -lon;
	const phi = rad * lat;
	const H = siderealTime(d, lw) - m.ra;
	let h = altitude(H, phi, m.dec);
	h += astroRefraction(h);
	return {
		fraction: (1 + Math.cos(inc)) / 2,
		phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI,
		altitude: h / rad
	};
}

export const MOON_PHASES = [
	'New moon',
	'Waxing crescent',
	'First quarter',
	'Waxing gibbous',
	'Full moon',
	'Waning gibbous',
	'Last quarter',
	'Waning crescent'
] as const;

/** Name of the eighth of the lunar cycle a phase value falls in. */
export function moonPhaseName(phase: number): (typeof MOON_PHASES)[number] {
	return MOON_PHASES[Math.round(phase * 8) % 8];
}
