import { memo } from '#lib/server/data';
import { boxOf, fulton, round, seasonDay, siteName } from '#lib/server/analytics/common';
import { countBy, histogram, linearFit, mean, pairs } from '#lib/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () =>
	memo('physiology', (d) => {
		const blood = d.blood.filter((b) => b.hct != null || b.cholesterol != null);
		const sites = [...new Set(blood.map((b) => b.siteId).filter(Boolean))] as string[];
		const metric = (k: 'hct' | 'hb' | 'cholesterol' | 'ffa' | 'triglycerides') =>
			sites
				.map((s) => ({
					name: siteName(d, s),
					stats: boxOf(blood.filter((b) => b.siteId === s).map((b) => b[k]))
				}))
				.filter((x) => x.stats && x.stats.n >= 3);

		// Join field blood samples to captures (same season, species and shark number).
		const caps = d.captures.filter((c) => c.season === '2020-2021');
		const joined = blood
			.filter((b) => (b.experiment ?? '').toLowerCase().startsWith('field'))
			.map((b) => {
				const c = caps.find(
					(x) =>
						x.species === b.species &&
						x.sharkNo != null &&
						b.sharkNo != null &&
						String(x.sharkNo).replace(/\D/g, '') === String(b.sharkNo).replace(/\D/g, '')
				);
				return c ? { hct: b.hct, tg: b.triglycerides, k: fulton(c), tl: c.tlMm } : null;
			})
			.filter(Boolean) as {
			hct: number | null;
			tg: number | null;
			k: number | null;
			tl: number | null;
		}[];
		const hctK = pairs(
			joined,
			(j) => j.k,
			(j) => j.hct
		);
		const hctFit = linearFit(hctK);

		const lab = d.labSharks;
		const days = lab.map((l) => l.days).filter((v): v is number => v != null && v >= 0 && v < 200);
		const massPairs = lab
			.filter((l) => l.arrMassKg && l.relMassKg)
			.map((l) => ({ x: l.arrMassKg!, y: l.relMassKg!, label: `${l.season} ${l.sharkNo ?? ''}` }));

		const feedDays = new Map<number, number[]>();
		const firstFeed = new Map<string, string>();
		for (const f of [...d.feeding].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
			if (!f.date || f.pct == null) continue;
			const key = f.tag ?? f.shark ?? '';
			if (!firstFeed.has(key)) firstFeed.set(key, f.date);
			const dd = Math.round((Date.parse(f.date) - Date.parse(firstFeed.get(key)!)) / 86_400_000);
			const l = feedDays.get(dd) ?? [];
			l.push(Math.max(0, Math.min(100, f.pct)));
			feedDays.set(dd, l);
		}

		const wqSeasons = [...new Set(d.labWq.map((w) => w.season))].sort();
		const wqSeries = wqSeasons
			.map((season) => {
				const byDay = new Map<number, number[]>();
				for (const w of d.labWq.filter((x) => x.season === season && x.date && x.temp != null)) {
					const day = seasonDay(w.date!);
					const l = byDay.get(day) ?? [];
					l.push(w.temp!);
					byDay.set(day, l);
				}
				return {
					season,
					points: [...byDay.entries()]
						.sort((a, b) => a[0] - b[0])
						.map(([x, v]) => ({ x, y: round(mean(v), 2) }))
				};
			})
			.filter((s) => s.points.length > 5);

		return {
			nBlood: blood.length,
			hct: metric('hct'),
			chol: metric('cholesterol'),
			tg: metric('triglycerides'),
			ffa: metric('ffa'),
			hctK: hctK.map(([x, y]) => ({ x, y })),
			hctFit: hctFit ? { r2: round(hctFit.r2, 2), p: hctFit.p, n: hctFit.n } : null,
			nLab: lab.length,
			daysEdges: Array.from({ length: 13 }, (_, i) => i * 5),
			daysHist: histogram(days, 0, 60, 5).map((b) => b.count),
			medianDays: round(mean(days), 1),
			massPairs,
			died: lab.filter((l) => l.died).length,
			feeding: [...feedDays.entries()]
				.sort((a, b) => a[0] - b[0])
				.filter(([, v]) => v.length >= 3)
				.map(([x, v]) => ({ x, y: round(mean(v), 1), n: v.length })),
			wqSeries,
			wqPh: wqSeasons
				.map((season) => ({
					name: season,
					stats: boxOf(d.labWq.filter((w) => w.season === season).map((w) => w.ph))
				}))
				.filter((x) => x.stats),
			prey: d.prey.map((p) => ({
				date: p.date,
				location: p.location,
				name: p.name,
				size: p.size,
				notes: p.notes
			})),
			preyTop: [...countBy(d.prey, (p) => p.name?.split(' (')[0] ?? null).entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([k, n]) => ({ k, n })),
			mouth: d.mouth.map((m) => ({
				shark: m.sharkNo,
				site: siteName(d, m.siteId),
				sex: m.sex,
				mol: m.mol,
				mow: m.mow
			}))
		};
	});
