import { I18nManager, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';
import { FloatingControl } from '../ui/FloatingControl';
import { LanguageMenu } from '../ui/LanguageMenu';
import { AppText } from './AppText';
import { SosButton } from './SosButton';

interface Props {
  onBack?: () => void;
  /** Kept for old call sites: the bar is transparent over the gradient on every screen now. */
  hero?: boolean;
  compact?: boolean;
  /** Title in the middle of the bar (as "Find Doctors" or "Medical Records" in the reference). */
  title?: string;
  /** Text of the role chip under the title. The patient screens use the default; the doctor screens say Doctor. */
  roleLabel?: string;
}

/** Top bar as in the light reference: round back button on the left, the title in the middle, language and SOS on the right. */
export function ScreenHeader({ onBack, compact = false, title, roleLabel }: Props) {
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
      <View style={styles.center}>
        {title ? (
          <AppText variant="bodyStrong" style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </AppText>
        ) : null}
        <AppText variant="secondary" color={colors.muted} style={styles.role} numberOfLines={1}>
          {roleLabel ?? t('common.patient')}
        </AppText>
      </View>
      <LanguageMenu />
      <SosButton />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, zIndex: 20, elevation: 20 },
    barCompact: { height: 56, paddingHorizontal: 8 },
    logo: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    title: { fontWeight: '800', textAlign: 'center' },
    role: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  });
