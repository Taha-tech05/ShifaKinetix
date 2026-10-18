import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { approximatePoint } from '../regions/subregion';
import { SHOULDER_REGIONS, regionLabel, selectionKey } from '../regions/shoulder';
import type { BodyLayer, BodySelection, Side, SubRegionId } from '../regions/types';
import { useT } from '../store/settings';
import { MIN_TAP, radius, shadows, spacing } from '../theme';
import { AppText } from './AppText';
import { BodyFigure } from './BodyFigure';
import { Button } from './Button';
import { useMemo } from 'react';
import { useTheme } from '../ui/ThemeProvider';
import type { Palette } from '../ui/theme';

export interface BodyPickerProps {
  highlightedIds?: string[];
  layer?: BodyLayer;
  onSelect: (selection: BodySelection) => void;
}

type View3 = 'front' | 'back';

/** Selection from the figure or list: no real hit point or structure, so the point is approximate. */
export function fallbackSelection(side: Side, subRegionId: SubRegionId, layer: BodyLayer = 'muscle'): BodySelection {
  return {
    regionId: `shoulder_${side}`,
    subRegionId,
    point: approximatePoint(side, subRegionId),
    hitStructure: null,
    layer,
  };
}

function RegionList({ highlightedIds, layer, onSelect }: Required<Pick<BodyPickerProps, 'highlightedIds' | 'layer' | 'onSelect'>>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {SHOULDER_REGIONS.map((r) => {
        const label = regionLabel(r.regionId, r.subRegionId) ?? r.regionId;
        const highlighted = highlightedIds.includes(selectionKey(r.regionId, r.subRegionId));
        return (
          <Pressable
            key={selectionKey(r.regionId, r.subRegionId)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: highlighted }}
            onPress={() => onSelect(fallbackSelection(r.side, r.subRegionId, layer))}
            style={[styles.row, highlighted && styles.highlighted]}
          >
            <AppText variant="bodyStrong" color={colors.text} style={styles.label}>
              {label}
            </AppText>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Plain body picker: a simple figure with tappable shoulders (front or back) and a plain list.
 * Used when the 3D body is not available. Returns the same selection shape as the 3D body, without a hit structure.
 */
export function BodyPicker({ highlightedIds = [], layer = 'muscle', onSelect }: BodyPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const t = useT();
  const [view, setView] = useState<View3>('front');
  const [asList, setAsList] = useState(false);

  if (asList) {
    return (
      <View style={styles.fill}>
        <RegionList highlightedIds={highlightedIds} layer={layer} onSelect={onSelect} />
        <Button variant="text" label={t('body.showBody')} onPress={() => setAsList(false)} />
      </View>
    );
  }

  // Facing the viewer, the patient's right shoulder is on the viewer's left. Seen from behind it swaps.
  const rightX = view === 'front' ? 22 : 78;
  const hotspots = [
    { id: selectionKey('shoulder_right', view), x: rightX, y: 22, label: t('body.rightShoulder'), side: 'right' as Side },
    { id: selectionKey('shoulder_left', view), x: 100 - rightX, y: 22, label: t('body.leftShoulder'), side: 'left' as Side },
  ];

  return (
    <View style={styles.fill}>
      <BodyFigure
        height="fill"
        hotspots={hotspots}
        selectedId={highlightedIds[0] ?? null}
        onHotspot={(id) => {
          const h = hotspots.find((x) => x.id === id);
          if (h) onSelect(fallbackSelection(h.side, view, layer));
        }}
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
              <AppText variant="secondary" color={colors.text} style={view === v ? styles.bold : undefined}>
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  fill: { flex: 1, gap: spacing.xs },
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    minHeight: MIN_TAP + 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
    ...shadows.card,
  },
  highlighted: { borderColor: colors.accentFill, backgroundColor: colors.accentTint },
  label: { flex: 1 },
  pill: {
    position: 'absolute',
    top: 12,
    start: 12,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 4,
    ...shadows.card,
  },
  pillBtn: { minHeight: MIN_TAP, paddingHorizontal: 10, justifyContent: 'center' },
  bold: { fontWeight: '700' },
});
