import { useEffect, useState } from 'react';
import { AppText } from '../components/AppText';
import { openSafetySession } from './safetySession';
import { useSession } from '../store/session';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { questions } from './evaluate';
import { AssessmentSync } from './AssessmentSync';

/** Checkpoint a live-flow stop as soon as its route opens; this never grants clearance. */
export function SafetyStopNotice() {
  const [failed, setFailed] = useState(false);
  const output = useSession((s) => s.gateOutput);
  const onset = useSession((s) => s.answers.find((a) => a.questionId === 'Q_BASICS_HOW'));
  const onsetStop = output?.verdict === 'RED_FLAG' && output.firedRules.some((r) =>
    ['R_injury', 'R_sudden', 'APP_REVIEW_Q_BASICS_HOW', 'APP_REVIEW_Q_ONSET_SUDDEN_TRAUMA'].includes(r.ruleId));
  const injury = output?.firedRules.some((r) => r.ruleId === 'R_injury')
    || (onsetStop && onset?.state === 'answered' && onset.value === 'after_injury');
  const reviewable = questions.filter((q) => output?.firedRules.some((r) => r.matchedAnswers.includes(q.questionId)));
  useEffect(() => {
    let active = true;
    void openSafetySession().then((session) => session.checkpoint()).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);
  return <>
    <AssessmentSync />
    <AppText variant="secondary">draft, awaiting clinician review</AppText>
    {output?.verdict === 'CLARIFY' && <AppText>We could not establish safety from these answers. This is uncertainty, not a diagnosis or a confirmed danger sign. Movement checks remain paused.</AppText>}
    {onsetStop && <>
      <AppText variant="bodyStrong">Why this assessment stopped</AppText>
      <AppText>{injury
        ? 'You reported that this shoulder pain started after an injury or accident.'
        : 'You reported a sudden or injury-related start to this shoulder pain.'}</AppText>
      <AppText>NHS guidance recommends urgent medical assessment for this symptom history. This does not diagnose a serious injury.</AppText>
      <AppText>The app pauses further questions, movement checks and muscle narrowing because an earlier answer already triggered a safety stop.</AppText>
      <AppText variant="secondary">Source: https://www.nhs.uk/symptoms/shoulder-pain/ (Urgent advice)</AppText>
    </>}
    {reviewable.length > 0 && <>
      <AppText>If you misunderstood a question or entered an answer by mistake, review it below. Continuing still requires a complete safety check.</AppText>
      {reviewable.map((q) => <Button key={q.questionId} variant="outline" label={`Review: ${q.wording}`}
        onPress={() => router.push(`/report/danger?review=${q.questionId}` as never)} />)}
    </>}
    {failed && <AppText accessibilityRole="alert">This result could not be saved. Stop movement checks and seek clinical help; do not rely on an older saved result.</AppText>}
  </>;
}
