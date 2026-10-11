// The live-narrowing constants, from shared/narrowing_config.json (the single source of truth, placeholder values).
import config from '../../../shared/narrowing_config.json';

export const NARROWING_LABEL: string = config.label;

export const NARROWING = {
  /** Before this many answers that are not "unknown", no ranked list is shown. */
  minNonUnknownAnswers: config.minNonUnknownAnswers,
  /** The top candidate must lead the next one by at least this much (match strength, 0 to 1) to stop early. */
  leadMargin: config.leadMargin,
  /** ... and have at least this many matched criteria. */
  minMatchedCriteria: config.minMatchedCriteria,
  /** Hard cap on movement and discriminator questions (answered or skipped). */
  maxQuestions: config.maxQuestions,
  /** Matched criteria that give a full-strength match. */
  fullMatchCriteria: config.fullMatchCriteria,
  /** A "no" on a criterion of a candidate counts this much against one "yes". */
  contradictionWeight: config.contradictionWeight,
  maxCandidatesShown: config.maxCandidatesShown,
  priors: config.priors,
  bands: config.bands,
} as const;

export type Band = 'low' | 'moderate' | 'higher';

/** Qualitative band of a match strength. Only the band is shown to the patient, never the number. */
export function bandOf(strength: number): Band {
  if (strength >= NARROWING.bands.higherFrom) return 'higher';
  if (strength >= NARROWING.bands.moderateFrom) return 'moderate';
  return 'low';
}
