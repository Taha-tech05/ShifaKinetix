import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { radius, shadows, spacing } from '../theme';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}

/** Modal sheet over a dark scrim (design .scrim + .sheet). */
export function BottomSheet({ visible, onClose, closeLabel, children }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderTopStartRadius: radius.sheet,
    borderTopEndRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: spacing.md,
    ...shadows.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
  },
});
