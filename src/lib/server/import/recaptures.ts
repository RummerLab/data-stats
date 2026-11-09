/**
 * Capture numbers in the sheets vs the captures linked by tag (#168). The site counts a shark once
 * per tag and never reads the capture numbers, so a disagreement changes nothing here; it goes on
 * the Data quality page so the lab can find a first capture that was never entered, a mistyped tag
 * or a missing number. Capture numbers restart each season, so repeats across seasons are expected.
 */
import type { IssueLog } from './issues';
import type { RawCapture } from './logs';

type Row = Pick<RawCapture, 'season' | 'date' | 'captureNo' | 'kind' | 'tags' | 'ref'>;

const tagText = (tags: string[]) => `tag ${tags.join(' / ')}`;

/** Check one shark's captures (`inLab`: one of its tags is in the lab records). */
export function checkRecaptures(list: Row[], log: IssueLog, inLab = false): void {
	const field = list
		.filter((c) => c.kind === 'field' && c.date)
		.sort((a, b) => a.date!.localeCompare(b.date!));
	field.forEach((c, i) => {
		const others = field.filter((o) => o !== c);
		const n = c.captureNo;
		if (n != null && n > 1) {
			const earlier = others.some(
				(o) => o.date! < c.date! || (o.date === c.date && (o.captureNo ?? 1) < n)
			);
			// 2013-14 writes how many times the shark was caught on every row: 2, 2 is fine.
			const total = field.filter((o) => o.season === c.season && o.captureNo === n).length >= n;
			if (!earlier && !total)
				log.add(
					'warning',
					'recaptures',
					c.tags.length
						? `Marked as capture ${n}, but ${tagText(c.tags)} isn't on an earlier capture${inLab ? ' (it is in the lab records)' : ''}; counted as a new shark`
						: `Marked as capture ${n}, but it has no tag and no earlier capture is linked to it; counted as a new shark`,
					c.ref,
					'capture no',
					n
				);
			return;
		}
		if (!c.tags.length) return;
		const before = others.find((o) => o.season === c.season && o.date! < c.date!);
		if (n === 1 && before)
			log.add(
				'info',
				'recaptures',
				`Marked as capture 1, but ${tagText(c.tags)} was caught on ${before.date} this season`,
				c.ref,
				'capture no',
				n
			);
		const twin = field
			.slice(0, i)
			.find((o) => o.date === c.date && (o.captureNo == null || o.captureNo <= 1));
		if (twin)
			log.add(
				'warning',
				'recaptures',
				`Tag ${c.tags.join(' / ')} is on two captures on ${c.date}, neither marked as a recapture: a mistyped tag, or a row entered twice?`,
				c.ref,
				'tag',
				c.tags[0]
			);
	});
}
