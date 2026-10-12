import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { IconTile } from './IconTile';
import type { Tone } from './IconTile';

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
  return (
    <Card
      row
      onPress={onPress}
      accessibilityLabel={title}
      style={[styles.card, selected && styles.on]}
    >
      <IconTile icon={icon} tone={tone} />
      <View style={styles.col}>
        <AppText variant="bodyStrong" color={colors.navy}>
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

const styles = StyleSheet.create({
  card: { minHeight: 72, borderWidth: 2, borderColor: 'transparent' },
  on: { borderColor: colors.teal, backgroundColor: '#F3FAFA' },
  col: { flex: 1 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#A9B6C2', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.teal, backgroundColor: colors.teal },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
});
