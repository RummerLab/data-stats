# Branding & chart style

Matches [physioshark.org](https://physioshark.org/): clean, corporate, ocean-blue.

## Type

- **Inter** (variable, bundled via `@fontsource-variable/inter`; no font CDN).
- Page titles 700, section titles 650, body 400 at 16 px / 1.6. Hero headline uppercase like the main site.
- Wordmark: light, letter-spaced `PHYSIO⟆SHARK` in ink with the fin glyph in accent blue, followed by a `DATA` chip (white on `#1d5fb8` in both themes for contrast).

## Colour tokens (`src/app.css`)

| Token       | Light     | Dark      | Use                           |
| ----------- | --------- | --------- | ----------------------------- |
| `--page`    | `#f5f7fa` | `#08111f` | Page background               |
| `--surface` | `#ffffff` | `#0f1b2d` | Cards, chart surface          |
| `--ink`     | `#13213a` | `#eef2f7` | Primary text                  |
| `--ink-2`   | `#3a4a5f` | `#c3ccd8` | Secondary text                |
| `--muted`   | `#66748a` | `#8d9aae` | Axis labels, captions         |
| `--accent`  | `#1d5fb8` | `#5aa0f0` | Links, focus, highlights      |
| `--navy`    | `#0b1a30` |           | Hero and footer (both themes) |
| `--grid`    | `#e8ecf2` | `#1a283d` | Hairline gridlines            |

Theme follows the OS unless the toggle in the header sets `data-theme` (stored in `localStorage.ps_theme`).

## Chart palette

Categorical slots, in this fixed order (validated with the dataviz palette validator against `#ffffff` light and `#0f1b2d` dark: all adjacent pairs pass CVD and normal-vision separation):

| Slot | Light     | Dark      | Default meaning            |
| ---- | --------- | --------- | -------------------------- |
| 1    | `#2a78d6` | `#3987e5` | Blacktip reef shark (Cm)   |
| 2    | `#eb6834` | `#d95926` | Sicklefin lemon (Na)       |
| 3    | `#1baf7a` | `#199e70` | Nurse shark / third series |
| 4    | `#eda100` | `#c98500` |                            |
| 5    | `#e87ba4` | `#d55181` |                            |
| 6    | `#008300` | `#008300` |                            |
| 7    | `#6250d6` | `#9085e9` |                            |
| 8    | `#e34948` | `#e66767` |                            |

Slots 3–5 are below 3:1 on white, so multi-series charts always carry a legend and hover tooltips, and key charts add a data table (`ChartCard table`). Scatter-type charts use at most three categorical slots.

Sequential ramps use `--seq-1…7` (blue, light→dark). Diverging uses `--div-neg` (blue) ↔ `--div-mid` (neutral) ↔ `--div-pos` (red).

## Marks

Bars ≤ 24 px thick with 4 px rounded data ends; 2 px lines; ≥ 8 px markers with a 2 px surface ring; hairline gridlines; one y-axis; direct labels only where few; text never in series colours.
