import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './AppText';
import { Card } from './Card';
import { IconTile } from './IconTile';
import type { Tone } from './IconTile';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

interface Props {
  title: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  selected: boolean;
  onPress: () => void;
}

/** Choice card with an icon, a title, a short line and a radio dot (design P29 and P25a). */
export function RadioCard({ title, sub, icon, tone = 'teal', selected, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Card
      row
      onPress={onPress}
      accessibilityLabel={title}
      style={[styles.card, selected && styles.on]}
    >
      <IconTile icon={icon} tone={tone} />
      <View style={styles.col}>
        <AppText variant="bodyStrong" color={colors.text}>
          {title}
        </AppText>
        {sub ? (
          <AppText variant="secondary" color={colors.muted}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.dot} /> : null}</View>
    </Card>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { minHeight: 72, borderWidth: 2, borderColor: 'transparent' },
  on: { borderColor: colors.accentFill, backgroundColor: colors.accentTint },
  col: { flex: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accentFill, backgroundColor: colors.accentFill },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surface },
});
