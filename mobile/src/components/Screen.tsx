import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  onBack?: () => void;
  scroll?: boolean;
  /** Fixed action area at the bottom (design .act): main button and text link. */
  footer?: React.ReactNode;
  /** Footer without padding or page background (used by the P5 sheet). */
  bareFooter?: boolean;
  /** Kept so call sites can name the screen; the design has no title in the top bar. */
  title?: string;
  children: React.ReactNode;
}

/** Standard patient screen: navy top bar with SOS, light grey page, padded body, optional fixed footer. */
export function Screen({ onBack, scroll = true, footer, bareFooter = false, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScreenHeader onBack={onBack} />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.body, styles.fill]}>{children}</View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  body: { paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  fill: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: spacing.xs, backgroundColor: colors.page },
});
