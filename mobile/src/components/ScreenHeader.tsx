import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useT } from '../store/settings';
import { colors, gradients } from '../theme';
import { AppText } from './AppText';
import { LanguageToggle } from './LanguageToggle';
import { SosButton } from './SosButton';

interface Props {
  onBack?: () => void;
  /** Transparent bar for use over the Home hero gradient; shows the logo instead of a back arrow. */
  hero?: boolean;
}

/** Top bar: back arrow (or logo), role chip, EN/Urdu/Roman toggle, SOS. Every patient screen has it. */
export function ScreenHeader({ onBack, hero = false }: Props) {
  const t = useT();
  return (
    <View style={[styles.bar, !hero && styles.solid]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} size={26} color={colors.white} />
        </Pressable>
      ) : (
        <LinearGradient colors={[...gradients.logo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Ionicons name="pulse" size={22} color={colors.white} />
        </LinearGradient>
      )}
      <View style={styles.chip}>
        <View style={styles.dot} />
        <AppText variant="secondary" color={colors.white} style={styles.chipText}>
          {t('common.patient')}
        </AppText>
      </View>
      <View style={styles.spacer} />
      <LanguageToggle />
      <SosButton />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  solid: { backgroundColor: colors.navy },
  back: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7FD0D0' },
  chipText: { fontWeight: '700' },
  spacer: { flex: 1 },
});
