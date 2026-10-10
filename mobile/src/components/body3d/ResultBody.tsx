import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '../../store/settings';
import { colors, gradients } from '../../theme';
import { AppText } from '../AppText';
import { BodyFigure } from '../BodyFigure';
import { Body3D } from './Body3D';
import { usePack } from './usePack';
import { useScreenFocused } from './useScreenFocused';

const FORCE_PLAIN = process.env.EXPO_PUBLIC_DISABLE_3D === '1';

/**
 * Read-only 3D body for the result screen: the muscles that may be involved are highlighted. No taps. If the 3D
 * body is not available, a plain figure is shown instead and the list below the figure carries the result.
 */
export function ResultBody({ highlightNames, initialYaw = 0, height = 260 }: { highlightNames: string[]; initialYaw?: number; height?: number }) {
  const t = useT();
  const focused = useScreenFocused();
  const state = usePack(!FORCE_PLAIN && focused);
  const [firstFrame, setFirstFrame] = useState(false);
  if (FORCE_PLAIN || state.status === 'failed') return <BodyFigure height={height} />;
  return (
    <LinearGradient colors={[...gradients.studio]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 1 }} style={[styles.box, { height }]}>
      {state.pack && focused ? <Body3D pack={state.pack} layer="muscle" highlightNames={highlightNames} initialYaw={initialYaw} onFirstFrame={() => setFirstFrame(true)} /> : null}
      {!state.pack || !firstFrame ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.teal} />
          <AppText variant="secondary" color={colors.muted}>
            {t('body.loading3d')}
          </AppText>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 24, overflow: 'hidden' },
  loading: { ...(StyleSheet.absoluteFill as object), alignItems: 'center', justifyContent: 'center', gap: 8 },
});
