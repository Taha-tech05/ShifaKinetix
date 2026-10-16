import { I18nManager, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';
import { FloatingControl } from '../ui/FloatingControl';
import { AppText } from './AppText';
import { LanguageToggle } from './LanguageToggle';
import { SosButton } from './SosButton';

interface Props {
  onBack?: () => void;
  /** Kept for old call sites: the bar is transparent over the gradient on every screen now. */
  hero?: boolean;
  compact?: boolean;
  /** Text of the role chip. The patient screens use the default; the doctor screens say Doctor. */
  roleLabel?: string;
}

/** Top bar over the gradient: glass back button (or logo), role chip, EN / Urdu / Roman toggle, SOS. */
export function ScreenHeader({ onBack, compact = false, roleLabel }: Props) {
  const t = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.bar, compact && styles.barCompact]}>
      {onBack ? (
        <FloatingControl icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} label={t('common.back')} onPress={onBack} />
      ) : (
        <View style={styles.logo}>
          <Ionicons name="pulse" size={22} color={colors.onAccent} />
        </View>
      )}
      <View style={styles.chip}>
        <View style={styles.dot} />
        <AppText variant="secondary" color={colors.text} style={styles.chipText}>
          {roleLabel ?? t('common.patient')}
        </AppText>
      </View>
      <View style={styles.spacer} />
      <LanguageToggle />
      <SosButton />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
    barCompact: { height: 56, paddingHorizontal: 8 },
    logo: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    chip: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.glassFill, borderWidth: 1, borderColor: colors.glassBorder },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    chipText: { fontWeight: '700' },
    spacer: { flex: 1 },
  });
