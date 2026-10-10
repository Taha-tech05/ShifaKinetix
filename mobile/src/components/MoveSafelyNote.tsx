import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { colors, radius, spacing } from '../theme';
import { AppText } from './AppText';

/** Required on every movement or exercise screen. */
export function MoveSafelyNote() {
  const t = useT();
  return (
    <View style={styles.box}>
      <Ionicons name="information-circle" size={22} color={colors.navy} />
      <AppText variant="body" color={colors.navy} style={styles.text}>
        {t('moveSafely')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.tealTint,
  },
  text: { flex: 1 },
});
