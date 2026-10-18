import { useEffect, useState } from 'react';
import { AppText } from '../components/AppText';
import { openSafetySession } from './safetySession';
import { useSession } from '../store/session';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { questions } from './evaluate';
import { AssessmentSync } from './AssessmentSync';

/**
 * Checkpoint a live-flow stop as soon as its route opens; this never grants clearance. The reasons for a stop are shown by the
 * stop screen itself (contract v2 care levels); this offers an explicit review of each answer that took part.
 */
export function SafetyStopNotice() {
  const [failed, setFailed] = useState(false);
  const output = useSession((s) => s.gateOutput);
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
    {reviewable.length > 0 && <>
      <AppText>If you misunderstood a question or entered an answer by mistake, review it below. Continuing still requires a complete safety check.</AppText>
      {reviewable.map((q) => <Button key={q.questionId} variant="outline" label={`Review: ${q.wording}`}
        onPress={() => router.push(`/report/danger?review=${q.questionId}` as never)} />)}
    </>}
    {failed && <AppText accessibilityRole="alert">This result could not be saved. Stop movement checks and seek clinical help; do not rely on an older saved result.</AppText>}
  </>;
}
