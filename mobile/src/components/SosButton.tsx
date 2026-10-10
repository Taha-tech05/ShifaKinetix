import { useState } from 'react';
import { Linking, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../theme';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

const HOSPITAL_SEARCH_URL = 'https://www.google.com/maps/search/?api=1&query=hospital';

/** Small SOS icon that opens a sheet with two actions and no advice text. */
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
        <Ionicons name="medkit" size={18} color={colors.white} />
        <AppText variant="secondary" color={colors.white} style={styles.text}>
          {t('sos.label')}
        </AppText>
      </Pressable>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('sos.title')}
        closeLabel={t('common.close')}
      >
        <Button label={t('sos.call')} icon="call" onPress={() => Linking.openURL('tel:1122')} />
        <Button
          label={t('sos.hospital')}
          icon="location"
          variant="outline"
          onPress={() => Linking.openURL(HOSPITAL_SEARCH_URL)}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    minWidth: MIN_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerDark,
  },
  text: { fontWeight: '800' },
});
