import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';
import { AppText } from './AppText';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  closeLabel: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, closeLabel, children }: Props) {
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
        {title ? (
          <AppText variant="h2" color={colors.navy} style={styles.title}>
            {title}
          </AppText>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,46,64,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopStartRadius: radius.xl,
    borderTopEndRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    ...shadows.raised,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.lineStrong,
  },
  title: { marginBottom: spacing.xs },
});
