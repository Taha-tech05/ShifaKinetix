import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export type Tone = 'teal' | 'navy' | 'caution' | 'danger' | 'safe';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  teal: { bg: colors.tealTint, fg: colors.teal },
  navy: { bg: colors.neutralTint, fg: colors.navy },
  caution: { bg: colors.cautionTint, fg: colors.cautionBase },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  safe: { bg: colors.safeTint, fg: '#2E7D5B' },
};

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** Rounded square icon tile (design .ic): 48 px, radius 18, soft tinted background. */
export function IconTile({ icon, tone = 'teal', size = 48, style }: Props) {
  const c = TONES[tone];
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: c.bg }, style]}>
      <Ionicons name={icon} size={Math.round(size / 2)} color={c.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
