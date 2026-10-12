import { useEffect, useState } from 'react';
import { AppText } from '../components/AppText';
import { openSafetySession } from './safetySession';
import { useSession } from '../store/session';

/** Checkpoint a live-flow stop as soon as its route opens; this never grants clearance. */
export function SafetyStopNotice() {
  const [failed, setFailed] = useState(false);
  const output = useSession((s) => s.gateOutput);
  const onset = useSession((s) => s.answers.find((a) => a.questionId === 'Q_BASICS_HOW'));
  const onsetStop = output?.verdict === 'RED_FLAG' && output.firedRules.some((r) =>
    ['R_injury', 'R_sudden', 'APP_REVIEW_Q_BASICS_HOW', 'APP_REVIEW_Q_ONSET_SUDDEN_TRAUMA'].includes(r.ruleId));
  const injury = output?.firedRules.some((r) => r.ruleId === 'R_injury')
    || (onsetStop && onset?.state === 'answered' && onset.value === 'after_injury');
  useEffect(() => {
    let active = true;
    void openSafetySession().then((session) => session.checkpoint()).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);
  return <>
    <AppText variant="secondary">draft, awaiting clinician review</AppText>
    {onsetStop && <>
      <AppText variant="bodyStrong">Why this assessment stopped</AppText>
      <AppText>{injury
        ? 'You reported that this shoulder pain started after an injury or accident.'
        : 'You reported a sudden or injury-related start to this shoulder pain.'}</AppText>
      <AppText>NHS guidance recommends urgent medical assessment for this symptom history. This does not diagnose a serious injury.</AppText>
      <AppText>The app pauses further questions, movement checks and muscle narrowing because an earlier answer already triggered a safety stop.</AppText>
      <AppText variant="secondary">Source: https://www.nhs.uk/symptoms/shoulder-pain/ (Urgent advice)</AppText>
    </>}
    {failed && <AppText accessibilityRole="alert">This result could not be saved. Stop movement checks and seek clinical help; do not rely on an older saved result.</AppText>}
  </>;
}
