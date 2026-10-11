// Sizes of the question screen, in one place so the layout can be checked without a device. Everything the patient needs to
// answer (header, strip, progress, candidate strip, question card with its chips) has a fixed or capped height; only the 3D
// viewer gives way when the screen is small.
/** The viewer takes the height that is left; it never goes below this. */
export const VIEWER_MIN = 80;
export const TEXT_MAX_FRACTION = 0.2;
export const TEXT_MIN = 80;
export const TOUCH_MIN = 48;

/** On a short screen the strip names two muscles instead of three, so the answers keep their room. */
export const SHORT_CONTENT = 520;
export const namesFor = (contentHeight: number) => (contentHeight > 0 && contentHeight < SHORT_CONTENT ? 2 : 3);
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
  const candidates = Math.ceil((20 + 20 + namesFor(contentHeight) * 20) * fs) + 12; // headline, label (with the caption), the muscle names
  const chips = Math.ceil(52 * Math.max(1, fs)); // chip text may wrap to two lines at large font scales
  const card = 24 + textMaxFor(contentHeight) + chips + 10;
  const gaps = 6 * 5;
  return { header, strip, progress, candidates, card, gaps, answerRow: chips, total: header + strip + progress + candidates + card + gaps };
}
