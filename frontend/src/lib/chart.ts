/**
 * Chart colours.
 *
 * Recharts paints with SVG attributes rather than classes, so it cannot read the
 * theme — every fill and stroke has to be passed as a literal. Keeping those literals
 * here, next to nothing else, is what stops the charts drifting away from the palette
 * the rest of the app is calibrated to: when a token in `index.css` moves, this is the
 * one other file to move with it.
 *
 * The values are the token values. They are duplicated, not derived, because reading a
 * custom property at render time would mean the charts flashed the wrong colour on
 * first paint.
 *
 * A chart gets one coloured series — the one the chart is about — and the rest step
 * down through the neutrals. That is the whole rule. Where a series *is* a task state,
 * it takes that state's colour instead, because there the colour carries meaning that
 * a neutral cannot.
 */
export const CHART = {
  /** `--chart-1`: the primary series. */
  primary: '#f4553c',
  /** `--chart-2` … `--chart-5`: supporting series, in descending weight. */
  neutral: '#52525b',
  neutralSoft: '#a1a1aa',
  neutralFaint: '#d4d4d8',

  /** Axis labels, gridlines and the muted text around a chart. */
  axis: '#71717a',
  grid: '#e4e4e7',
} as const;

/** Status keeps its meaning across every chart, table and badge in the app. */
export const STATUS_COLORS = {
  pending: '#a16207',
  in_progress: '#1d4ed8',
  completed: '#15803d',
  overdue: '#b91c1c',
} as const;

/**
 * The tooltip chrome, shared so a tooltip looks the same wherever it appears. It is
 * shadcn's popover: a light card with a border and a soft shadow.
 */
export const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: '1px solid #e4e4e7',
  background: '#ffffff',
  color: '#09090b',
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 12px rgba(9,9,11,0.08)',
} as const;

export const TOOLTIP_LABEL_STYLE = {
  color: '#09090b',
  fontWeight: 600,
  marginBottom: 2,
} as const;

/** Recharts styles the value rows separately from the panel they sit in. */
export const TOOLTIP_ITEM_STYLE = { color: '#52525b' } as const;
