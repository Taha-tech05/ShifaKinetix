import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../store/settings';
import type { TKey } from '../i18n';
import { Button } from '../components/Button';
import { useTheme } from './ThemeProvider';
import { font } from './theme';

/** The colour guide: what each colour of the chat means. Every colour also has a label or an icon, never colour alone. */
export function Legend({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  const rows: { icon: keyof typeof Ionicons.glyphMap; fill: string; fg: string; border: string; label: TKey }[] = [
    { icon: 'pulse', fill: colors.bubble, fg: colors.text, border: colors.glassBorder, label: 'scene.legendBot' },
    { icon: 'checkmark-circle', fill: colors.accentFill, fg: colors.onAccent, border: colors.accentFill, label: 'scene.legendYou' },
    { icon: 'locate', fill: colors.pin, fg: colors.onAccent, border: colors.pin, label: 'scene.legendRegion' },
    { icon: 'body-outline', fill: colors.involvedTint, fg: colors.involved, border: colors.involved, label: 'scene.legendInvolved' },
    { icon: 'warning-outline', fill: colors.cautionTint, fg: colors.caution, border: colors.cautionBase, label: 'scene.legendWarning' },
    { icon: 'sparkles-outline', fill: colors.aiTint, fg: colors.ai, border: colors.ai, label: 'scene.legendAi' },
    { icon: 'alert-circle-outline', fill: colors.dangerTint, fg: colors.danger, border: colors.danger, label: 'scene.legendRed' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('scene.legendClose')} style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose} />
      <View style={[styles.card, { backgroundColor: colors.menuFill, borderColor: colors.glassBorder }]}>
        <Text style={[font.title, { color: colors.text, fontSize: 20, lineHeight: 28 }]} accessibilityRole="header">
          {t('scene.legend')}
        </Text>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <View style={[styles.swatch, { backgroundColor: r.fill, borderColor: r.border }]}>
              <Ionicons name={r.icon} size={18} color={r.fg} />
            </View>
            <Text style={[font.caption, { color: colors.text, flex: 1 }]}>{t(r.label)}</Text>
          </View>
        ))}
        <Button label={t('scene.legendClose')} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  card: { position: 'absolute', start: 16, end: 16, bottom: 32, borderRadius: 28, borderWidth: 1, padding: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
