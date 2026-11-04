export const OISST_MAX_LAG_DAYS = 17;

/** Yearly [start, end] chunks between two ISO dates. */
export function chunks(start, end, lagDays = 0) {
	const out = [];
	let y = Number(start.slice(0, 4));
	const endY = Number(end.slice(0, 4));
	for (; y <= endY; y++) {
		const s = y === Number(start.slice(0, 4)) ? start : `${y}-01-01`;
		const e = y === endY ? end : `${y}-12-31`;
		out.push([s, e]);
	}
	// Keep the entire publication-lag window in the request ending at `last`.
	// In early January, December 31 may still be outside the published time axis.
	const earliest = Date.parse(end) - lagDays * 86400000;
	while (out.length > 1 && Date.parse(out.at(-1)[0]) > earliest) {
		const tail = out.pop();
		out.at(-1)[1] = tail[1];
	}
	return out;
}

/** Fetch yearly ERDDAP chunks; never publish a silently truncated historical series. */
export async function readSeries({
	base,
	dataset,
	vars,
	lat,
	lon,
	chunks,
	zlev,
	get,
	sleep,
	latest = true
}) {
	const rows = new Map();
	for (const [i, [start, end]] of chunks.entries()) {
		const final = i === chunks.length - 1;
		const select = (v) =>
			`${v}%5B(${start}T12:00:00Z):1:(${final && latest ? 'last' : end + 'T12:00:00Z'})%5D${zlev ? '%5B(0.0)%5D' : ''}%5B(${lat})%5D%5B(${lon})%5D`;
		let text;
		try {
			text = await get(`${base}/griddap/${dataset}.csv?${vars.map(select).join(',')}`);
		} catch (err) {
			// Only a final chunk with no published observations may be absent. Outages are fatal.
			if (!final || !String(err).includes('404')) throw err;
			console.warn(`[external] ${dataset}: final chunk not published (${start})`);
			continue;
		}
		const [header, , ...lines] = text.trim().split(/\r?\n/);
		const columns = header.split(',');
		for (const v of vars)
			if (!columns.includes(v)) throw new Error(`${dataset}: missing ${v} column`);
		const counts = new Map(vars.map((v) => [v, 0]));
		for (const line of lines) {
			const cells = line.split(',');
			const date = cells[0].slice(0, 10);
			if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${dataset}: invalid date`);
			const record = {};
			for (const v of vars) {
				const raw = cells[columns.indexOf(v)];
				const n = raw?.trim() ? Number(raw) : NaN;
				record[v] = Number.isFinite(n) ? n : null;
				if (record[v] != null) counts.set(v, counts.get(v) + 1);
			}
			rows.set(date, record);
		}
		for (const [v, n] of counts)
			if (!n) throw new Error(`${dataset}: no finite ${v} values in ${start}–${end}`);
		await sleep(1000);
	}
	for (const v of vars)
		if (![...rows.values()].some((r) => r[v] != null))
			throw new Error(`${dataset}: no finite ${v} values`);
	return rows;
}

/** OISST must be continuous; allow two weeks for the final product plus three days for its ERDDAP mirror. */
export function validateDaily(rows, variable, start, end) {
	const dates = [...rows.keys()].sort();
	const last = dates.at(-1);
	const day = 86400000;
	if (!last || Date.parse(end) - Date.parse(last) > OISST_MAX_LAG_DAYS * day)
		throw new Error('OISST: stale or absent series');
	for (let t = Date.parse(start); t <= Date.parse(last); t += day) {
		const date = new Date(t).toISOString().slice(0, 10);
		if (!Number.isFinite(rows.get(date)?.[variable]))
			throw new Error(`OISST: missing daily value ${date}`);
	}
}
