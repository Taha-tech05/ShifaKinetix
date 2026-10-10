import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHOULDER_REGIONS } from '../regions/shoulder';
import type { Point3D } from '../store/session';
import { useT } from '../store/settings';
import { colors, MIN_TAP, radius, shadows, spacing } from '../theme';
import { AppText } from './AppText';
import { BodyFigure } from './BodyFigure';
import { Button } from './Button';

/** Which layer of the model to show. Not used until the 3D body is connected. */
export type BodyLayer = 'all' | 'superficial' | 'deep' | 'bone';

export interface BodySelection {
  regionId: string;
  point: Point3D;
}

export interface BodyViewerProps {
  highlightedIds?: string[];
  layer?: BodyLayer;
  onSelect: (selection: BodySelection) => void;
}

type View3 = 'front' | 'back';

function RegionList({ highlightedIds, onSelect }: Pick<BodyViewerProps, 'highlightedIds' | 'onSelect'>) {
  const t = useT();
  const ids = highlightedIds ?? [];
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {SHOULDER_REGIONS.map((r) => {
        const highlighted = ids.includes(r.regionId);
        return (
          <Pressable
            key={r.regionId}
            accessibilityRole="button"
            accessibilityLabel={t(r.labelKey)}
            accessibilityState={{ selected: highlighted }}
            // The list has no 3D hit point, so the origin stands in for the tapped point.
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
    </ScrollView>
  );
}

/**
 * Body selection. For now a simple figure with tappable shoulders (front or back) and a plain list.
 * The 3D viewer will replace the figure and keep these props, so screens do not change.
 */
export function BodyViewer({ highlightedIds = [], onSelect }: BodyViewerProps) {
  const t = useT();
  const [view, setView] = useState<View3>('front');
  const [asList, setAsList] = useState(false);

  if (asList) {
    return (
      <View style={styles.fill}>
        <RegionList highlightedIds={highlightedIds} onSelect={onSelect} />
        <Button variant="text" label={t('body.showBody')} onPress={() => setAsList(false)} />
      </View>
    );
  }

  // Facing the viewer, the patient's right shoulder is on the viewer's left. Seen from behind it swaps.
  const rightX = view === 'front' ? 22 : 78;
  const hotspots = [
    { id: `shoulder_right_${view}`, x: rightX, y: 22, label: t('body.rightShoulder') },
    { id: `shoulder_left_${view}`, x: 100 - rightX, y: 22, label: t('body.leftShoulder') },
  ];

  return (
    <View style={styles.fill}>
      <BodyFigure
        height="fill"
        hotspots={hotspots}
        selectedId={highlightedIds[0] ?? null}
        onHotspot={(id) => onSelect({ regionId: id, point: { x: 0, y: 0, z: 0 } })}
      >
        <View style={styles.pill}>
          {(['front', 'back'] as View3[]).map((v, i) => (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityLabel={t(v === 'front' ? 'body.front' : 'body.back')}
              accessibilityState={{ selected: view === v }}
              onPress={() => setView(v)}
              style={styles.pillBtn}
            >
              <AppText variant="secondary" color={colors.navy} style={view === v ? styles.bold : undefined}>
                {i === 1 ? '| ' : ''}
                {t(v === 'front' ? 'body.front' : 'body.back')}
              </AppText>
            </Pressable>
          ))}
        </View>
      </BodyFigure>
      <Button variant="text" label={t('body.useList')} onPress={() => setAsList(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, gap: spacing.xs },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    minHeight: MIN_TAP + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.card,
  },
  highlighted: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  label: { flex: 1 },
  pill: {
    position: 'absolute',
    top: 12,
    start: 12,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 4,
    ...shadows.card,
  },
  pillBtn: { minHeight: MIN_TAP, paddingHorizontal: 10, justifyContent: 'center' },
  bold: { fontWeight: '700' },
});
