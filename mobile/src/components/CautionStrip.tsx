import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { AppText } from './AppText';

/** Amber strip under the top bar (design .mstrip). Every movement screen carries the caution line. */
export function CautionStrip({ text }: { text: string }) {
  return (
    <View style={styles.strip} accessibilityRole="alert">
      <Ionicons name="warning-outline" size={22} color="#6B4A0F" />
      <AppText variant="secondary" color="#6B4A0F" style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cautionTint,
    borderBottomWidth: 1,
    borderBottomColor: '#EBD6A6',
  },
  text: { flex: 1, fontWeight: '600' },
});
