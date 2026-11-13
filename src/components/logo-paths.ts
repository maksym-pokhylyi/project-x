/*
 * Path data of the Bidfolio mark, exactly as delivered by the designer
 * (docs/design/handoff/Main.dc.html). Do not redraw or nudge it.
 *
 * The drawing: the top-left corner of a 3 : 4 sheet is folded down along a line 22.5° off the
 * top edge; the folded corner's two edges land at 45° and leave a tick-shaped gap. Nothing is
 * drawn on: the tick is the gap the fold leaves. One colour, always.
 */

/** The mark on a 24 × 32 grid (3 : 4). Smallest size: 16 px high. */
export const MARK = "M0 11.022L4.393 15.415 19.808 0H22a2 2 0 0 1 2 2v28a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2ZM0 6.213 15 0 4.393 10.607Z";
export const MARK_VIEWBOX = "0 0 24 32";
/** Width of the mark as a share of its height. */
export const MARK_RATIO = 24 / 32;

/** The favicon cut on a 32 × 32 grid: a heavier tick (2 px at 16). Only for src/app/icon.svg. */
export const MARK_FAVICON = "M4 12.284L8.686 16.971 25.657 0H27a1 1 0 0 1 1 1v29a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM4 6.627 20 0 8.686 11.314Z";
