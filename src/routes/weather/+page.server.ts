import { memo } from '#lib/server/data';
import { binnedMean, cpueOf, effortSets, round } from '#lib/server/analytics/common';
import { crewVsEra5 } from '#lib/server/analytics/cloud';
import { weatherEvents } from '#lib/server/analytics/events';
import { mean, sum } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('weather', (d) => {
		const w = d.weather;
		const sets = effortSets(d);
		const months = Array.from({ length: 12 }, (_, i) => i + 1);
		const years = [...new Set(w.map((r) => r.date.slice(0, 4)))];
		const byMonth = months.map((m) => {
			const rows = w.filter((r) => Number(r.date.slice(5, 7)) === m);
			const perYear = years
				.map((y) => sum(rows.filter((r) => r.date.startsWith(y)).map((r) => r.precip)))
				.filter((v) => v > 0);
			return {
				m,
				tmax: round(mean(rows.map((r) => r.tmax)), 1),
				tmin: round(mean(rows.map((r) => r.tmin)), 1),
				rain: round(mean(perYear), 0),
				wind: round(mean(rows.map((r) => r.windMax)), 1),
				sun: round(mean(rows.map((r) => r.sunshineH)), 1)
			};
		});
		const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
		const monthly = new Map<string, number>();
		for (const r of w)
			monthly.set(r.date.slice(0, 7), (monthly.get(r.date.slice(0, 7)) ?? 0) + (r.precip ?? 0));

		const sectors = 16;
		const rose = Array.from({ length: sectors }, () => 0);
		for (const s of sets)
			if (s.windDir != null) rose[Math.round(((s.windDir % 360) / 360) * sectors) % sectors]++;

		const tags = [
			['Sunny / clear', /sun|clear|no clouds/i],
			['Cloudy / overcast', /cloud|overcast/i],
			['Rain / drizzle', /rain|drizzl|lightning/i],
			['Windy', /wind/i],
			['Calm', /calm|no wind/i]
		] as const;
		const fieldWeather = tags.map(([label, re]) => {
			const ss = sets.filter((s) => s.weatherRaw && re.test(s.weatherRaw));
			return { label, n: ss.length, cpue: round(cpueOf(ss)) };
		});

		const lbl =
			(u: string, dp = 0) =>
			(a: number, b: number) =>
				`${round(a, dp)}–${round(b, dp)}${u}`;
		const events = weatherEvents(d);
		return {
			events,
			stormMarkers: (events?.storms ?? []).map((s) => ({ x: toDay(s.date), label: s.name })),
			crewCloud: crewVsEra5(d),
			byMonth,
			rainMonthly: [...monthly.entries()]
				.sort()
				.map(([ym, v]) => ({ x: toDay(`${ym}-15`), y: round(v, 0) })),
			tempWeekly: w.filter((_, i) => i % 7 === 0).map((r) => ({ x: toDay(r.date), y: r.tmean })),
			rose,
			rain: binnedMean(
				sets,
				(s) => s.rain24h,
				(s) => s.cpue,
				[0, 0.5, 2, 5, 10, 25, 200],
				lbl(' mm', 1)
			),
			wind: binnedMean(
				sets,
				(s) => s.windSpeed,
				(s) => s.cpue,
				[0, 10, 15, 20, 25, 30, 80],
				lbl(' km/h')
			),
			cloud: binnedMean(
				sets,
				(s) => s.cloudEvening,
				(s) => s.cpue,
				[0, 20, 40, 60, 80, 100],
				lbl('%')
			),
			pressure: binnedMean(
				sets,
				(s) => s.pressure,
				(s) => s.cpue,
				[1000, 1008, 1010, 1012, 1014, 1030],
				lbl(' hPa')
			),
			fieldWeather,
			lastDate: w.length ? w[w.length - 1].date : null
		};
	});
