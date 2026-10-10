import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { disposePack, loadPack } from '../screens/model3d/loadPack';
import type { LoadedPack } from '../screens/model3d/loadPack';
import type { Point3D } from '../store/session';
import { useT } from '../store/settings';
import { colors, gradients, spacing } from '../theme';
import { AppText } from './AppText';
import { Body3D } from './body3d/Body3D';
import { LITE_BIN, LITE_META } from './body3d/pack';
import { BodyPicker } from './BodyPicker';
import { Button } from './Button';
import { Card } from './Card';

/** Which layer of the model to show. Labels are a geometry guess, not clinically reviewed. */
export type BodyLayer = 'all' | 'superficial' | 'deep' | 'bone';

export interface BodySelection {
  regionId: string;
  point: Point3D;
}

export interface BodyViewerProps {
  highlightedIds?: string[];
  layer?: BodyLayer;
  onSelect: (selection: BodySelection) => void;
}

const LOAD_TIMEOUT_MS = 25000;
// Set EXPO_PUBLIC_DISABLE_3D=1 to force the plain picker (also how to test the fallback).
const FORCE_PLAIN = process.env.EXPO_PUBLIC_DISABLE_3D === '1';

type Mode = 'loading' | 'ready' | 'failed';

/** Any render error inside the 3D view falls back to the plain picker instead of crashing the screen. */
class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Body selection. Shows the 3D body when the lite model loads in time; otherwise the plain picker
 * (figure with tappable shoulders, and a list), which returns the same region ids.
 * Nothing else in the app depends on this component working.
 */
export function BodyViewer({ highlightedIds = [], layer = 'all', onSelect }: BodyViewerProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(FORCE_PLAIN ? 'failed' : 'loading');
  const [pack, setPack] = useState<LoadedPack | null>(null);
  const [usePlain, setUsePlain] = useState(false);
  const [miss, setMiss] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);

  useEffect(() => {
    if (FORCE_PLAIN) return;
    let cancelled = false;
    let loaded: LoadedPack | null = null;
    const timer = setTimeout(() => {
      if (!cancelled && !loaded) setMode('failed');
    }, LOAD_TIMEOUT_MS);
    loadPack(LITE_BIN, LITE_META)
      .then((p) => {
        if (cancelled) return disposePack(p);
        loaded = p;
        setPack(p);
        setMode('ready');
      })
      .catch(() => {
        if (!cancelled) setMode('failed');
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      disposePack(loaded);
    };
  }, []);

  const plain = <BodyPicker highlightedIds={highlightedIds} layer={layer} onSelect={onSelect} />;

  if (mode === 'failed') {
    return (
      <View style={styles.fill}>
        <Card tone="gray">
          <AppText variant="body" color={colors.navy}>
            {t('body.unavailable')}
          </AppText>
        </Card>
        {plain}
      </View>
    );
  }

  if (usePlain) {
    return (
      <View style={styles.fill}>
        {plain}
        {mode === 'ready' ? <Button variant="text" label={t('body.show3d')} onPress={() => setUsePlain(false)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <LinearGradient colors={[...gradients.studio]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={styles.canvas}>
        {mode === 'ready' && pack ? (
          <Boundary onError={() => setMode('failed')}>
            <Body3D
              pack={pack}
              layer={layer}
              onFirstFrame={() => setFirstFrame(true)}
              onPick={(pick) => {
                setMiss(pick === null);
                if (pick) onSelect(pick);
              }}
            />
          </Boundary>
        ) : null}
        {mode === 'loading' || (mode === 'ready' && !firstFrame) ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.teal} />
            <AppText variant="body" color={colors.muted}>
              {t('body.loading3d')}
            </AppText>
          </View>
        ) : null}
      </LinearGradient>
      <AppText variant="secondary" color={miss ? colors.navy : colors.muted} style={styles.hint}>
        {miss ? t('body.tapShoulder') : t('body.tapHint')}
      </AppText>
      <Button variant="text" label={t('body.useList')} onPress={() => setUsePlain(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: spacing.xs },
  canvas: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  loading: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  hint: { textAlign: 'center' },
});
