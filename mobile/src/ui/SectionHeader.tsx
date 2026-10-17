import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, font } from './theme';

interface Props {
  title: string;
  /** "View All" style link on the right. */
  actionLabel?: string;
  onAction?: () => void;
}

/** Section title on the left, a small "View All" link on the right (as in the light reference). */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[font.body, { color: colors.text, fontWeight: '800', flex: 1 }]} accessibilityRole="header">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} style={styles.link}>
          <Text style={[font.caption, { color: colors.accentText, fontWeight: '700' }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: 4 },
});
