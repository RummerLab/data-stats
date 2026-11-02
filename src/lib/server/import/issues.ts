/** Data-quality notes collected during import (#67). The spreadsheets are never modified. */
export type Severity = 'error' | 'warning' | 'info';

export interface DataIssue {
	severity: Severity;
	category: string;
	message: string;
	file?: string | null;
	sheet?: string | null;
	row?: number | null;
	column?: string | null;
	value?: string | null;
}

export interface SourceRef {
	file: string;
	sheet: string;
	row?: number;
}

export class IssueLog {
	readonly items: DataIssue[] = [];

	add(
		severity: Severity,
		category: string,
		message: string,
		ref?: SourceRef | null,
		column?: string | null,
		value?: unknown
	) {
		this.items.push({
			severity,
			category,
			message,
			file: ref?.file ?? null,
			sheet: ref?.sheet ?? null,
			row: ref?.row ?? null,
			column: column ?? null,
			value: value == null ? null : String(value).slice(0, 200)
		});
	}
}
