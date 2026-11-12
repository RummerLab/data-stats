import { memo, nurseryRoute } from '#lib/server/data';
import {
	activeNurseries,
	fieldCaptures,
	recapturePairs,
	round,
	siteName
} from '#lib/server/analytics/common';
import { schnabel } from '#lib/server/analytics/population';
import { OCCASION_DAYS, survival } from '#lib/server/analytics/survival';
import { histogram, median, pairs as xy, spearman } from '#lib/stats';
import { tableText, trendText } from '#lib/server/analytics/tests';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('recaptures', (d) => {
		const caps = fieldCaptures(d);
		const pairs = recapturePairs(caps).filter((p) => p.days >= 1);
		const nurseries = activeNurseries(d);

		const rateBy = <K extends string>(key: (c: (typeof caps)[number]) => K | null, keys: K[]) =>
			keys.map((k) => {
				const sc = caps.filter((c) => key(c) === k);
				const ind = new Map<string, number>();
				for (const c of sc) ind.set(c.individualId!, (ind.get(c.individualId!) ?? 0) + 1);
				const n = ind.size;
				const re = [...ind.values()].filter((v) => v > 1).length;
				return { key: k, n, recaptured: re, rate: n ? round(re / n, 3) : null };
			});

		const matrix = nurseries.map((from) =>
			nurseries.map((to) => pairs.filter((p) => p.a.siteId === from && p.b.siteId === to).length)
		);
		const same = pairs.filter((p) => p.a.siteId && p.a.siteId === p.b.siteId).length;
		const moved = pairs.filter((p) => p.a.siteId && p.b.siteId && p.a.siteId !== p.b.siteId);
		const dist = (a: string | null, b: string | null) => {
			const sa = a ? d.siteById.get(a) : null;
			const sb = b ? d.siteById.get(b) : null;
			if (!sa?.lat || !sb?.lat || sa.lon == null || sb.lon == null) return null;
			const k = Math.cos((sa.lat * Math.PI) / 180);
			return Math.hypot((sa.lat - sb.lat) * 110.574, (sa.lon - sb.lon) * 111.32 * k);
		};
		// Moves drawn on the map (#173). Sharks with identity conflicts are left out.
		const conflicts = new Set(d.individuals.filter((i) => i.conflict).map((i) => i.id));
		const place = (id: string | null) => {
			const s = id ? d.siteById.get(id) : null;
			return s?.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null;
		};
		const moveLines = (['Cm', 'Na'] as const).map((sp) => {
			// One line per direction (#182): A → B and B → A are drawn side by side.
			const byPair = new Map<string, { a: string; b: string; n: number }>();
			for (const p of moved) {
				if (p.species !== sp || conflicts.has(p.id)) continue;
				const k = `${p.a.siteId}|${p.b.siteId}`;
				const e = byPair.get(k) ?? { a: p.a.siteId!, b: p.b.siteId!, n: 0 };
				e.n++;
				byPair.set(k, e);
			}
			return {
				species: sp,
				lines: [...byPair.values()].flatMap((e) => {
					const from = place(e.a);
					const to = place(e.b);
					if (!from || !to) return [];
					const [na, nb] = [siteName(d, e.a), siteName(d, e.b)];
					const route = nurseryRoute(d, e.a, e.b);
					const km = route?.km ?? dist(e.a, e.b);
					const straightKm = route?.straightKm ?? dist(e.a, e.b);
					return [
						{
							id: `${sp}-${e.a}-${e.b}`,
							label: `${na} → ${nb}`,
							from,
							to,
							path: route?.coordinates,
							value: e.n,
							sub: `${e.n} move${e.n === 1 ? '' : 's'} · ${round(km, 1)} km by water${straightKm != null ? ` (${round(straightKm, 1)} km straight line)` : ''}`
						}
					];
				})
			};
		});
		const stayed = nurseries.flatMap((id) => {
			const at = place(id);
			if (!at) return [];
			const n = pairs.filter(
				(p) => p.a.siteId === id && p.b.siteId === id && !conflicts.has(p.id)
			).length;
			const out = moved.filter((p) => p.a.siteId === id && !conflicts.has(p.id)).length;
			return [
				{
					id,
					label: siteName(d, id),
					...at,
					value: n,
					href: `/nurseries/${id}`,
					sub: `${n} recaptured at the same nursery, ${out} next caught elsewhere`
				}
			];
		});
		const longest = moved
			.map((p) => {
				const route = p.a.siteId && p.b.siteId ? nurseryRoute(d, p.a.siteId, p.b.siteId) : null;
				const km = route?.km ?? dist(p.a.siteId, p.b.siteId);
				const straightKm = route?.straightKm ?? dist(p.a.siteId, p.b.siteId);
				return {
					id: p.id,
					species: p.species,
					from: siteName(d, p.a.siteId),
					to: siteName(d, p.b.siteId),
					km: round(km, 1),
					straightKm: round(straightKm, 1),
					days: p.days,
					date: p.b.date
				};
			})
			.sort((a, b) => (b.km ?? 0) - (a.km ?? 0))
			.slice(0, 15);

		const most = [...d.individuals]
			.filter((i) => i.nCaptures >= 3)
			.sort((a, b) => b.nCaptures - a.nCaptures)
			.slice(0, 20)
			.map((i) => ({
				id: i.id,
				href: `/sharks/${encodeURIComponent(i.id)}`,
				species: i.species,
				sex: i.sex,
				n: i.nCaptures,
				seasons: i.nSeasons,
				first: i.firstDate,
				last: i.lastDate
			}));

		const capCounts = [1, 2, 3, 4, 5, 6].map((k) => ({
			k,
			n: d.individuals.filter((i) => (k === 6 ? i.nCaptures >= 6 : i.nCaptures === k)).length
		}));

		// Schnabel estimates per nursery, season and species (#43), against that nursery-season's CPUE.
		const est = schnabel(d).map((e) => ({ ...e, site: siteName(d, e.siteId) }));
		const rho = (sp: string) => {
			const r = spearman(
				xy(
					est.filter((e) => e.species === sp),
					(e) => e.cpue,
					(e) => e.n
				)
			);
			return r && r.n >= 8 ? { rho: round(r.rho, 2), p: r.p, n: r.n } : null;
		};
		const bySeason = rateBy((c) => c.season, d.seasons);
		const bySite = rateBy((c) => c.siteId, nurseries);
		const stats = {
			season: [
				tableText(
					bySeason.map((r) => [r.recaptured, r.n - r.recaptured]),
					'seasons'
				),
				trendText(bySeason.map((r) => r.rate))
			],
			site: tableText(
				bySite.map((r) => [r.recaptured, r.n - r.recaptured]),
				'nurseries'
			)
		};
		// Apparent survival within a season (#42).
		const stay = (['Cm', 'Na'] as const).map((sp) => survival(d, sp)).filter((r) => r != null);
		return {
			stay,
			occasionDays: OCCASION_DAYS,
			stats,
			abundance: { rows: est, cm: rho('Cm'), na: rho('Na') },
			bySeason: rateBy((c) => c.season, d.seasons),
			bySite: rateBy((c) => c.siteId, nurseries).map((r) => ({ ...r, name: siteName(d, r.key) })),
			bySpecies: rateBy((c) => c.species, ['Cm', 'Na']),
			nurseryNames: nurseries.map((id) => siteName(d, id)),
			matrix,
			moveLines,
			stayed,
			conflictsLeftOut: moved.filter((p) => conflicts.has(p.id)).length,
			fidelity: pairs.length ? round(same / pairs.length, 3) : null,
			pairs: pairs.length,
			medianDays: median(pairs.map((p) => p.days)),
			edges: Array.from({ length: 21 }, (_, i) => i * 7),
			daysHist: histogram(
				pairs.filter((p) => p.days < 140).map((p) => p.days),
				0,
				140,
				7
			).map((b) => b.count),
			longest,
			most,
			capCounts,
			multiSeason: d.individuals.filter((i) => i.nSeasons > 1).length
		};
	});
