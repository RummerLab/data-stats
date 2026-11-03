import { memo } from '#lib/server/data';
import {
	activeNurseries,
	cpueOf,
	effortSets,
	fieldCaptures,
	isNeonate,
	round,
	siteName
} from '#lib/server/analytics/common';
import { topFindings } from '#lib/server/analytics/findings';
import { rateEffects, rateTest, trendText } from '#lib/server/analytics/tests';
import { num, pValue, season as seasonFmt } from '#lib/format';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('overview', (d) => {
		const caps = fieldCaptures(d);
		const sets = d.sets.filter((s) => s.gear === 'Gillnet');
		const eff = effortSets(d);
		const recaptured = d.individuals.filter((i) => i.nCaptures > 1).length;
		const people = new Set(d.crew.map((c) => c.person)).size;
		const hours = eff.reduce((a, s) => a + (s.durationMin ?? 0) / 60, 0);

		const perSeason = d.seasons.map((season) => {
			const sc = caps.filter((c) => c.season === season);
			const ss = eff.filter((s) => s.season === season);
			return {
				season,
				Cm: sc.filter((c) => c.species === 'Cm').length,
				Na: sc.filter((c) => c.species === 'Na').length,
				other: sc.filter((c) => c.species !== 'Cm' && c.species !== 'Na').length,
				cpueCm: round(cpueOf(ss, 'cpueCm')),
				cpueNa: round(cpueOf(ss, 'cpueNa')),
				sets: sets.filter((s) => s.season === season).length
			};
		});

		// Do seasons differ beyond chance once nursery and time of season are held fixed (#120)?
		const seasonStats = (['cpueCm', 'cpueNa'] as const).map((key) => {
			const name = key === 'cpueCm' ? 'Blacktips' : 'Sicklefin lemons';
			const t = rateTest(eff, { groupOf: (s) => s.season }, key, ['season']);
			if (!t?.adjusted) return null;
			const unusual = (rateEffects(eff, (s) => s.season, key, ['season']) ?? []).filter(
				(e) => e.lo > 1 || e.hi < 1
			);
			const differ = t.adjusted.p < 0.05;
			return [
				`${name}: seasons ${differ ? 'differ beyond chance' : 'do not differ beyond chance'} once nursery and day of the season are held fixed (negative-binomial test, ${pValue(t.adjusted.p)}).`,
				differ && unusual.length
					? `Unusual seasons: ${unusual.map((e) => `${seasonFmt(e.level)} ${num(e.rr, 2)}× the average season (95% interval ${num(e.lo, 2)}–${num(e.hi, 2)})`).join('; ')}.`
					: '',
				trendText(
					perSeason.map((s) => s[key]),
					'sharks per net-hour'
				) ?? ''
			]
				.filter(Boolean)
				.join(' ');
		});

		const months = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
		const byMonth = months.map((m) => ({
			month: m,
			Cm: caps.filter((c) => c.species === 'Cm' && c.date && Number(c.date.slice(5, 7)) === m)
				.length,
			Na: caps.filter((c) => c.species === 'Na' && c.date && Number(c.date.slice(5, 7)) === m)
				.length
		}));

		const map = activeNurseries(d)
			.map((id) => {
				const s = d.siteById.get(id)!;
				const n = caps.filter((c) => c.siteId === id).length;
				return {
					id,
					label: s.name,
					lat: s.lat!,
					lon: s.lon!,
					value: n,
					href: `/nurseries/${id}`,
					sub: `CPUE ${round(cpueOf(eff.filter((x) => x.siteId === id))) ?? '–'} sharks / net-hour`
				};
			})
			.filter((p) => p.lat != null);

		const species = (['Cm', 'Na', 'Nf'] as const).map((sp) => {
			const sc = caps.filter((c) => c.species === sp);
			return {
				code: sp,
				n: sc.length,
				individuals: new Set(sc.map((c) => c.individualId)).size,
				neonates: sc.filter(isNeonate).length
			};
		});

		return {
			seasonStats,
			kpi: {
				captures: caps.length,
				individuals: new Set(caps.map((c) => c.individualId)).size,
				sets: sets.length,
				hours: Math.round(hours),
				nurseries: map.length,
				recaptured,
				people,
				seasons: d.seasons.length,
				adults: d.adults.length,
				cpue: round(cpueOf(eff))
			},
			perSeason,
			byMonth,
			map,
			species,
			topSite: map.length ? siteName(d, [...map].sort((a, b) => b.value - a.value)[0].id) : null,
			findings: topFindings(d).slice(0, 6)
		};
	});
