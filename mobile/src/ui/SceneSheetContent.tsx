import { useFocusEffect } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useT } from '../store/settings';
import { Chip } from './Chip';
import { SceneHostContext, useScene } from './scene';
import type { SceneMode, StageProps } from './scene';

interface Props {
  /** Changes with the question. */
  contentKey: string;
  /** Question ids this route shows itself. */
  ownIds?: string[];
  onBack?: () => void;
  children: React.ReactNode;
}

/** True while the route is the one in front. A route further back in the stack stays mounted and must not touch the shared sheet. */
function useRouteActive(): boolean {
  const [active, setActive] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );
  return active;
}

/**
 * What a symptom-flow route renders. Inside the shared layout the content is handed to the one persistent sheet (the 3D body
 * and the sheet stay mounted while routes change). Anywhere else it simply renders in place.
 */
export function SceneSheetContent({ contentKey, ownIds = [], onBack, children }: Props) {
  const host = useContext(SceneHostContext);
  const active = useRouteActive();
  const hosted = host && active;
  const key = ownIds.join('|');
  useEffect(() => {
    if (!hosted) return;
    useScene.getState().setSheet({ contentKey, ownIds, node: children });
  });
  // the route's back handler changes every render; the sheet gets one stable function that calls the latest one
  const backRef = useRef(onBack);
  backRef.current = onBack; // eslint-disable-line react-hooks/refs
  const stableBack = useCallback(() => backRef.current?.(), []);
  const hasBack = !!onBack;
  useEffect(() => {
    if (!hosted) return;
    useScene.getState().setOnBack(hasBack ? stableBack : null);
    return () => useScene.getState().setOnBack(null);
  }, [hosted, hasBack, stableBack]);
  useEffect(
    () => () => {
      if (hosted && useScene.getState().sheet?.contentKey === contentKey) useScene.getState().setSheet(null);
    },
    [hosted, contentKey, key],
  );
  const t = useT();
  if (host) return null;
  // outside the shared layout (older screens, tests) the content stands alone and brings its own Back
  return (
    <>
      {onBack ? <Chip label={t('live.back')} icon="chevron-back" onPress={onBack} style={{ alignSelf: 'flex-start' }} /> : null}
      {children}
    </>
  );
}

/** A route tells the scene how its step should look: progress line, sheet behaviour, instruction chip, movement stage. */
export function useSceneStep(step: { stepKey: string; mode: SceneMode; instruction?: string | null; progress?: { label: string; value: number } | null; stage?: StageProps | null }) {
  const active = useRouteActive();
  const hosted = active;
  const { stepKey, mode, instruction = null, progress = null, stage = null } = step;
  useEffect(() => {
    if (!hosted) return;
    useScene.getState().setStep({ mode, stepKey, instruction });
  }, [hosted, mode, stepKey, instruction]);
  const progressKey = progress ? `${progress.label}|${progress.value}` : '';
  useEffect(() => {
    if (!hosted) return;
    useScene.getState().setProgress(progress);
  }, [hosted, progressKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const stageKey = stage ? `${stage.movement.id}|${stage.side}|${stage.paused}|${stage.autoFocus}|${stage.highlightIds.join(',')}` : '';
  useEffect(() => {
    if (!hosted) return;
    useScene.getState().setStage(stage);
    return () => useScene.getState().setStage(null);
  }, [hosted, stageKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
