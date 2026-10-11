import { useEffect, useState } from 'react';
import { AppText } from '../components/AppText';
import { openSafetySession } from './safetySession';

/** Checkpoint a live-flow stop as soon as its route opens; this never grants clearance. */
export function SafetyStopNotice() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void openSafetySession().then((session) => session.checkpoint()).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);
  return <>
    <AppText variant="secondary">draft, awaiting clinician review</AppText>
    {failed && <AppText accessibilityRole="alert">This result could not be saved. Stop movement checks and seek clinical help; do not rely on an older saved result.</AppText>}
  </>;
}
