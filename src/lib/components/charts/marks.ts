/**
 * Keyboard access to chart marks (#32). Each chart is one tab stop: arrow keys step through its
 * marks (left/right along a row, up/down across a grid), Home/End jump to the ends, Enter follows
 * a mark's link and Escape hides the tooltip. The tooltip (role="status") announces each value.
 */
import { goto } from '$app/navigation';

export interface MarkKeysOptions {
	count: () => number;
	/** Marks per row for grids (heatmaps); omit and up/down step like left/right. */
	cols?: () => number;
	show: (i: number) => void;
	hide: () => void;
	href?: (i: number) => string | null | undefined;
}

export function markKeys(o: MarkKeysOptions) {
	let i = -1;
	const go = (j: number) => {
		const n = o.count();
		if (!n) return;
		i = Math.max(0, Math.min(n - 1, j));
		o.show(i);
	};
	return {
		// "application" makes screen readers pass the arrow keys through instead of browsing. A
		// chart with nothing to read stays a plain, unfocusable image. (Getters keep both reactive
		// when the props are spread onto the svg.)
		get role() {
			return o.count() ? 'application' : 'img';
		},
		get tabindex() {
			return o.count() ? 0 : undefined;
		},
		// Mouse clicks also focus the chart; only keyboard focus opens the first tooltip.
		onfocus: (e: FocusEvent) => {
			if ((e.currentTarget as Element).matches(':focus-visible')) go(Math.max(i, 0));
		},
		onblur: () => o.hide(),
		onkeydown: (e: KeyboardEvent) => {
			const row = o.cols?.() ?? 1;
			const step: Record<string, number> = {
				ArrowRight: 1,
				ArrowLeft: -1,
				ArrowDown: row,
				ArrowUp: -row,
				Home: -Infinity,
				End: Infinity
			};
			if (e.key in step) {
				e.preventDefault();
				const s = step[e.key];
				go(!Number.isFinite(s) ? (s > 0 ? o.count() - 1 : 0) : i < 0 ? 0 : i + s);
			} else if (e.key === 'Escape') o.hide();
			else if (e.key === 'Enter' && i >= 0) {
				const href = o.href?.(i);
				if (href) goto(href);
			}
		}
	};
}

/** Pointer position relative to the chart's .wrap (tooltip origin). */
export function pointerIn(e: PointerEvent) {
	const w = (e.currentTarget as Element).closest('.wrap')!.getBoundingClientRect();
	return { x: e.clientX - w.left, y: e.clientY - w.top };
}

/** Calls `fn` with the centre of the element marked data-mark="i", relative to the .wrap. */
export function markAt(
	svg: SVGSVGElement | undefined,
	i: number,
	fn: (at: { x: number; y: number }) => void
) {
	const el = svg?.querySelector(`[data-mark="${i}"]`);
	const wrap = svg?.closest('.wrap');
	if (!el || !wrap) return;
	const a = el.getBoundingClientRect();
	const w = wrap.getBoundingClientRect();
	fn({ x: a.left + a.width / 2 - w.left, y: a.top + a.height / 2 - w.top });
}

/** Accessible name suffix for keyboard-readable charts. */
export const KEYS_HINT = 'Use the arrow keys to read each value.';
