import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHOULDER_REGIONS } from '../regions/shoulder';
import type { Point3D } from '../store/session';
import { useT } from '../store/settings';
import { colors, MIN_TAP, radius, spacing } from '../theme';
import { AppText } from './AppText';

export type BodyLayer = 'surface' | 'middle' | 'deep';

export interface BodySelection {
  regionId: string;
  point: Point3D;
}

export interface BodyViewerProps {
  highlightedIds?: string[];
  layer?: BodyLayer;
  onSelect: (selection: BodySelection) => void;
}

/**
 * Body selection interface. This version is a plain tappable list of shoulder
 * regions. The 3D viewer will replace the body of this component and keep the
 * same props, so screens do not change.
 */
export function BodyViewer({ highlightedIds = [], onSelect }: BodyViewerProps) {
  const t = useT();
  return (
    <View style={styles.list}>
      {SHOULDER_REGIONS.map((r) => {
        const highlighted = highlightedIds.includes(r.regionId);
        return (
          <Pressable
            key={r.regionId}
            accessibilityRole="button"
            accessibilityLabel={t(r.labelKey)}
            accessibilityState={{ selected: highlighted }}
            // No real 3D hit point yet, so the origin stands in for the tapped point.
            onPress={() => onSelect({ regionId: r.regionId, point: { x: 0, y: 0, z: 0 } })}
            style={[styles.row, highlighted && styles.highlighted]}
          >
            <AppText variant="bodyStrong" color={colors.navy} style={styles.label}>
              {t(r.labelKey)}
            </AppText>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    minHeight: MIN_TAP + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  highlighted: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  label: { flex: 1 },
});
