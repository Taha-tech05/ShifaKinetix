import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BodyLayer, BodySelection } from '../regions/types';
import { disposePack, loadPack } from '../screens/model3d/loadPack';
import type { LoadedPack } from '../screens/model3d/loadPack';
import { useT } from '../store/settings';
import { colors, gradients, MIN_TAP, shadows, spacing } from '../theme';
import { AppText } from './AppText';
import { Body3D } from './body3d/Body3D';
import { LITE_BIN, LITE_META } from './body3d/pack';
import { BodyPicker } from './BodyPicker';
import { Button } from './Button';
import { Card } from './Card';

export type { BodyLayer, BodySelection } from '../regions/types';

export interface BodyViewerProps {
  /** Ids of the current choice (side and sub-region, e.g. "shoulder_right_top"), used by the figure and list. */
  highlightedIds?: string[];
  /** Layer to start with. Default "muscle". The user can switch between "muscle" and "bone" in the viewer. */
  layer?: BodyLayer;
  onLayerChange?: (layer: BodyLayer) => void;
  /** Always returns a layer. hitStructure is a hint only, see regions/types.ts. */
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

/** Two-option layer menu: Muscle (default) and Bone. No skin layer. */
function LayerMenu({ layer, onChange }: { layer: BodyLayer; onChange: (l: BodyLayer) => void }) {
  const t = useT();
  const options: { value: BodyLayer; label: string }[] = [
    { value: 'muscle', label: t('layers.muscle') },
    { value: 'bone', label: t('layers.bone') },
  ];
  return (
    <View style={styles.menu} accessibilityLabel={t('layers.title')}>
      {options.map((o) => {
        const on = layer === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.menuBtn, on && styles.menuOn]}
          >
            <AppText variant="secondary" color={on ? colors.white : colors.navy} style={styles.bold}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Body selection. Shows the 3D body when the lite model loads in time; otherwise the plain picker
 * (figure with tappable shoulders, and a list), which returns the same selection shape.
 * Nothing else in the app depends on this component working.
 */
export function BodyViewer({ highlightedIds = [], layer: initialLayer = 'muscle', onLayerChange, onSelect }: BodyViewerProps) {
  const t = useT();
  const [layer, setLayer] = useState<BodyLayer>(initialLayer);
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

  const changeLayer = (l: BodyLayer) => {
    setLayer(l);
    setMiss(false);
    onLayerChange?.(l);
  };

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
              onPick={(sel) => {
                setMiss(sel === null);
                if (sel) onSelect(sel);
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
        {mode === 'ready' ? <LayerMenu layer={layer} onChange={changeLayer} /> : null}
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
  menu: {
    position: 'absolute',
    top: 12,
    start: 12,
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 24,
    backgroundColor: colors.white,
    ...shadows.card,
  },
  menuBtn: { minHeight: MIN_TAP, minWidth: MIN_TAP + 16, paddingHorizontal: 12, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuOn: { backgroundColor: colors.navy },
  bold: { fontWeight: '700' },
});
