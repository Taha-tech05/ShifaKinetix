import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../theme';
import { GradientBackground } from '../ui/GradientBackground';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  onBack?: () => void;
  scroll?: boolean;
  /** False while a child (the 3D viewer) is using the touch, so the page does not scroll under the finger. */
  scrollEnabled?: boolean;
  /** Slim header and tighter padding, for the question screen (everything must fit without scrolling). */
  compact?: boolean;
  /** Full-width strip right under the top bar (e.g. the movement caution). */
  banner?: React.ReactNode;
  /** Fixed action area at the bottom: main button and text link. */
  footer?: React.ReactNode;
  /** Footer without padding or page background (used by sheets). */
  bareFooter?: boolean;
  /** Kept so call sites can name the screen. */
  title?: string;
  /** Role chip text in the top bar (default: Patient). */
  roleLabel?: string;
  /** Leave room under the content for the floating bottom nav. */
  navSpace?: boolean;
  children: React.ReactNode;
}

/** Standard screen: gradient background, transparent top bar with SOS, padded body, optional fixed footer. */
export function Screen({ onBack, scroll = true, scrollEnabled = true, compact = false, footer, bareFooter = false, banner, roleLabel, title, navSpace = false, children }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bottomPad = navSpace ? 110 + insets.bottom : 24;
  return (
    <View style={styles.root}>
      <GradientBackground />
      <ScreenHeader onBack={onBack} compact={compact} title={title} roleLabel={roleLabel} />
      {banner}
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.body, styles.fill, compact && [styles.compactBody, { paddingBottom: 6 + insets.bottom }]]}>{children}</View>
      )}
      {footer ? (
        bareFooter ? (
          footer
        ) : (
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>{footer}</View>
        )
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.page },
    body: { paddingHorizontal: 20, paddingVertical: 16, gap: 16 },
    fill: { flex: 1 },
    compactBody: { paddingHorizontal: 12, paddingTop: 6, gap: 8 },
    footer: { paddingHorizontal: 20, paddingTop: 12, gap: spacing.xs },
  });
