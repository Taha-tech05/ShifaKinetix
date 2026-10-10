import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../store/settings';
import { colors, MIN_TAP, spacing } from '../theme';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { SosButton } from './SosButton';

interface Props {
  title?: string;
  onBack?: () => void;
}

/** Back arrow, optional title, role chip and the SOS button. Every patient screen uses it. */
export function ScreenHeader({ title, onBack }: Props) {
  const t = useT();
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons
            name={I18nManager.isRTL ? 'arrow-forward' : 'arrow-back'}
            size={26}
            color={colors.navy}
          />
        </Pressable>
      ) : null}
      <View style={styles.titleWrap}>
        {title ? (
          <AppText variant="h3" color={colors.navy} numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
      </View>
      <Chip label={t('common.patient')} />
      <SosButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  back: { width: MIN_TAP, height: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1 },
});
