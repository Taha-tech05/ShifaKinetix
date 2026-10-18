// The narrowing reuses what the safety check already asked (contract v2, docs/safety-integration.md). The structure-type
// questions about tingling and numbness were near-copies of the safety questions, so they are no longer asked: their answers
// come from the safety answers (a No to the opening "unusual feeling" question counts as No). Draft, awaiting clinician review.
import { impliedAnswer } from '../gate/evaluate';
import type { Answer } from '../gate/evaluate';
import { NUMB_ID, TINGLE_ID } from './structureBank';

/** Structure-type questions answered from the safety check instead of being asked. */
export const SAFETY_DERIVED_IDS: readonly string[] = [TINGLE_ID, NUMB_ID];

const yesno = (questionId: string, value: boolean | null): Answer =>
  ({ questionId, type: 'yesno', value, state: value === null ? 'unknown' : 'answered' });

/** The structure-type answers the safety answers already give. An own answer to the same question always wins. */
export function safetyNarrowingFacts(answers: readonly Answer[]): Answer[] {
  const out: Answer[] = [];
  const own = (id: string) => answers.some((a) => a.questionId === id);
  const tingling = impliedAnswer(answers, 'tingling');
  if (tingling && !own(TINGLE_ID)) out.push(yesno(TINGLE_ID, tingling.state === 'unknown' ? null : tingling.value !== 'none'));
  const numb = impliedAnswer(answers, 'numb');
  if (numb && !own(NUMB_ID)) out.push(yesno(NUMB_ID, numb.state === 'unknown' ? null : numb.value === true));
  return out;
}
