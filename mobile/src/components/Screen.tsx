import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import { ScreenHeader } from './ScreenHeader';

interface Props {
  title?: string;
  onBack?: () => void;
  scroll?: boolean;
  children: React.ReactNode;
}

/** Standard patient screen: white background, header with SOS, padded body. */
export function Screen({ title, onBack, scroll = true, children }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader title={title} onBack={onBack} />
      {scroll ? (
        <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
      ) : (
        <View style={[styles.body, styles.fill]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { padding: spacing.lg, gap: spacing.lg },
  fill: { flex: 1 },
});
