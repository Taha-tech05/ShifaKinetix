// Sizes of the question screen, in one place so the layout can be checked without a device. Everything the patient needs to
// answer (header, strip, progress, candidate strip, question card with its chips) has a fixed or capped height; only the 3D
// viewer gives way when the screen is small.
export const VIEWER_FRACTION = 0.43;
export const VIEWER_MIN = 140;
export const TEXT_MAX_FRACTION = 0.2;
export const TEXT_MIN = 72;
export const TOUCH_MIN = 48;

/** The viewer height for a content height. */
export const viewerHeightFor = (contentHeight: number) => Math.max(VIEWER_MIN, Math.round(contentHeight * VIEWER_FRACTION));
/** The tallest the question text area may be before it scrolls inside the card. */
export const textMaxFor = (contentHeight: number) => Math.max(TEXT_MIN, Math.round(contentHeight * TEXT_MAX_FRACTION));

/**
 * An upper estimate of what must stay visible besides the viewer, in dp, for a font scale: the slim header, the one strip with the
 * demo and caution messages, the progress row, the candidate strip, the card (text area, one row of answer chips) and the gaps.
 */
export function fixedHeights(fontScale: number, contentHeight: number) {
  const fs = Math.max(1, fontScale);
  const header = 52;
  const strip = Math.ceil(2 * 16 * fs) + 8;
  const progress = TOUCH_MIN;
  const candidates = Math.ceil((20 + 18 + 16) * fs) + 12;
  const chips = Math.ceil(TOUCH_MIN * Math.max(1, fs * 0.9)); // chip text may wrap to two lines at large font scales
  const card = 20 + textMaxFor(contentHeight) + chips;
  const gaps = 6 * 5;
  return { header, strip, progress, candidates, card, gaps, answerRow: chips, total: header + strip + progress + candidates + card + gaps };
}
