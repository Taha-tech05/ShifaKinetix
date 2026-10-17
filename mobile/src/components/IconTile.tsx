import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';


export type Tone = 'teal' | 'navy' | 'caution' | 'danger' | 'safe';

const tones = (colors: Palette): Record<Tone, { bg: string; fg: string }> => ({
  teal: { bg: colors.accentTint, fg: colors.accent },
  navy: { bg: colors.neutral, fg: colors.text },
  caution: { bg: colors.cautionTint, fg: colors.cautionBase },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  safe: { bg: colors.safeTint, fg: colors.safe },
});

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Rounded square icon tile (design .ic): 48 px, radius 18, soft tinted background. */
export function IconTile({ icon, tone = 'teal', size = 48, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const c = tones(colors)[tone];
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: c.bg }, style]}>
      <Ionicons name={icon} size={Math.round(size / 2)} color={c.fg} />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  tile: { borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
