import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { colors, shadows, spacing } from '../theme';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { IconTile } from './IconTile';

const HOSPITAL_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=hospital';

/** Red SOS pill in the top bar. Opens a sheet with two big actions and no advice text. */
export function SosButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('sos.label')}
        onPress={() => setOpen(true)}
        style={styles.button}
      >
        <AppText variant="secondary" color={colors.white} style={styles.text}>
          {t('sos.label')}
        </AppText>
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} closeLabel={t('common.close')}>
        <View style={styles.head}>
          <IconTile icon="alert-circle-outline" tone="danger" />
          <AppText variant="h2" color={colors.navy} style={styles.title}>
            {t('sos.title')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sos.call')}
          onPress={() => Linking.openURL('tel:1122')}
          style={[styles.big, styles.red]}
        >
          <Ionicons name="call" size={24} color={colors.white} />
          <AppText variant="h2" color={colors.white} style={styles.bigText}>
            {t('sos.call')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sos.hospital')}
          onPress={() => Linking.openURL(HOSPITAL_SEARCH_URL)}
          style={[styles.big, styles.line]}
        >
          <Ionicons name="location" size={24} color={colors.navy} />
          <AppText variant="h2" color={colors.navy} style={styles.bigText}>
            {t('sos.hospital')}
          </AppText>
        </Pressable>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: 24,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sos,
  },
  text: { fontWeight: '800', letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: 20 },
  big: {
    height: 72,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bigText: { fontSize: 20 },
  red: { backgroundColor: colors.danger },
  line: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.navy },
});
