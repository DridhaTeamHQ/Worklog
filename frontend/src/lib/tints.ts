/**
 * The stat cards step through three tinted surfaces — indigo, pink, periwinkle —
 * and repeat. Rows of buttons reuse the same cycle in the same order, so a tab
 * strip and a card grid read as one palette rather than two.
 *
 * The surfaces themselves live in `index.css` as `.chip-tint-*` / `.btn-tint-*`;
 * this only decides which one each position in a row gets.
 */
export const TINT_COUNT = 3;

/** Chip colours for the button at `index` in a series. */
export function chipTint(index: number, active: boolean): string {
  return `chip-tint-${(index % TINT_COUNT) + 1}${active ? ' is-active' : ''}`;
}

/** Filled-button colours for the button at `index` in a series. */
export function buttonTint(index: number): string {
  return `btn-tint-${(index % TINT_COUNT) + 1}`;
}
