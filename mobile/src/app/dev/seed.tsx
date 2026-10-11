// DEV ONLY (EXPO_PUBLIC_DEV_ANIM=1): jump into the live flow with a prepared session, for emulator checks. Without the flag
// this route redirects home and nothing links to it.
//   /dev/seed?side=right|left&sub=top|front|back|side|scapular&mode=region|exact&lang=en|ur|roman
//            &moves=sideways_raise:pain,forward_raise:skip&qs=Q_DQ_NIGHT:yes&to=/report/movement
// moves: <movementId>:<pain|weak|no|unsure|skip>      qs: <questionId>:<yes|no|unsure|skip>
// The answers go through the same functions as the real flow (flow/live.ts), so the gate and the narrowing run for each.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { Language } from '../../i18n';
import { submitMovement, submitQuestion } from '../../flow/live';
import { buildMovementResult } from '../../movement/result';
import type { Feel } from '../../movement/result';
import { discriminatorQuestions } from '../../narrowing/bank';
import { answered, unknown } from '../../questions/answer';
import type { SubRegionId } from '../../regions/types';
import { useSession } from '../../store/session';
import { useSettings } from '../../store/settings';

const ENABLED = process.env.EXPO_PUBLIC_DEV_ANIM === '1';
const FEEL: Record<string, Feel> = {
  pain: { kind: 'felt', pain: true, weak: false, couldNot: false },
  weak: { kind: 'felt', pain: false, weak: true, couldNot: false },
  no: { kind: 'felt', pain: false, weak: false, couldNot: false },
  unsure: { kind: 'unsure' },
  skip: { kind: 'skip' },
};

export default function DevSeed() {
  const p = useLocalSearchParams<{ side?: string; sub?: string; mode?: string; lang?: string; moves?: string; qs?: string; to?: string }>();
  const [to, setTo] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!ENABLED || done.current) return;
    done.current = true;
    const s = useSession.getState();
    s.reset();
    const side = p.side === 'left' ? 'left' : 'right';
    s.setSelection({ regionId: `shoulder_${side}`, subRegionId: (p.sub as SubRegionId) ?? 'top', point: { x: side === 'left' ? 0.17 : -0.17, y: 1.4, z: -0.03 }, hitStructure: null, layer: 'muscle' });
    s.setMode(p.mode === 'exact' ? 'exact' : 'region');
    useSession.setState({ gateVerdict: 'SAFE' });
    if (p.lang === 'ur' || p.lang === 'roman' || p.lang === 'en') {
      useSettings.getState().chooseLanguage(p.lang as Language);
    }
    for (const item of (p.moves ?? '').split(',').filter(Boolean)) {
      const [id, feel] = item.split(':');
      submitMovement(buildMovementResult(id, FEEL[feel] ?? FEEL.skip), feel);
    }
    const qs = discriminatorQuestions();
    for (const item of (p.qs ?? '').split(',').filter(Boolean)) {
      const [id, a] = item.split(':');
      const q = qs.find((x) => x.questionId === id);
      if (q) submitQuestion(a === 'yes' ? answered(q, true) : a === 'no' ? answered(q, false) : unknown(q));
    }
    setTo(p.to ?? '/report/movement');
  }, [p.side, p.sub, p.mode, p.lang, p.moves, p.qs, p.to]);

  if (!ENABLED) return <Redirect href="/" />;
  return to ? <Redirect href={to as never} /> : null;
}
