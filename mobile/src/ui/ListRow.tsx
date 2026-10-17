import { Ionicons } from '@expo/vector-icons';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, font, softShadow } from './theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** A small tag on the right (instead of the chevron), e.g. a status. */
  trailing?: React.ReactNode;
  /** Icon tile tint: accent (default) or a status colour. */
  tone?: 'accent' | 'warn' | 'safe' | 'danger';
}

/** One row of a list: rounded icon tile, title, small subtitle, chevron (the "Medical Records" rows of the light reference). */
export function ListRow({ icon, title, subtitle, onPress, trailing, tone = 'accent' }: Props) {
  const { colors } = useTheme();
  const tint = tone === 'warn' ? colors.cautionTint : tone === 'safe' ? colors.safeTint : tone === 'danger' ? colors.dangerTint : colors.accentTint;
  const fg = tone === 'warn' ? colors.caution : tone === 'safe' ? colors.safe : tone === 'danger' ? colors.danger : colors.accentText;
  const body = (
    <>
      <View style={[styles.tile, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={24} color={fg} />
      </View>
      <View style={styles.text}>
        <Text style={[font.body, { color: colors.text, fontWeight: '700' }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={[font.caption, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.muted} /> : null)}
    </>
  );
  const base = [styles.row, { backgroundColor: colors.cardFill, borderColor: colors.glassBorder }, softShadow(colors, 0.7)];
  if (!onPress) return <View style={base}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 26, borderWidth: 1 },
  tile: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
