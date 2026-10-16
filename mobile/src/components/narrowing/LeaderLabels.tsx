import { StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { useMemo } from 'react';
import { useTheme } from '../../ui/ThemeProvider';
import type { Palette } from '../../ui/theme';

export interface LabelAnchor {
  id: string;
  name: string;
  /** Screen position (px, inside the viewer) of the muscle's centre. */
  x: number;
  y: number;
}

const ROW = 30;

/** Move labels apart vertically so two never sit on top of each other. */
export function spreadLabels(ys: number[], min = ROW): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  let last = -Infinity;
  const out = new Array<number>(ys.length);
  for (const o of order) {
    const y = Math.max(o.y, last + min);
    out[o.i] = y;
    last = y;
  }
  return out;
}

/**
 * Leader-line labels on top of the model: the muscle name only (no numbers), at the left or right edge, joined to the
 * muscle by a thin horizontal line and a dot. Labels alternate sides so they do not crowd.
 */
export function LeaderLabels({ anchors, width }: { anchors: LabelAnchor[]; width: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (anchors.length === 0 || width <= 0) return null;
  const ys = spreadLabels(anchors.map((a) => a.y));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {anchors.map((a, i) => {
        const left = (i & 1) === 0;
        const labelW = Math.min(150, width * 0.4);
        const edge = left ? 6 + labelW : width - 6 - labelW;
        const from = Math.min(edge, a.x);
        const to = Math.max(edge, a.x);
        return (
          <View key={a.id} style={StyleSheet.absoluteFill}>
            <View style={[styles.line, { left: from, width: Math.max(0, to - from), top: ys[i] }]} />
            <View style={[styles.dot, { left: a.x - 4, top: a.y - 4 }]} />
            <View style={[styles.label, { left: left ? 6 : width - 6 - labelW, width: labelW, top: ys[i] - 13 }]}>
              <AppText variant="secondary" color={colors.text} style={styles.text} numberOfLines={2}>
                {a.name}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  line: { position: 'absolute', height: 1.5, backgroundColor: colors.chrome },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.chrome, borderWidth: 1.5, borderColor: colors.surface },
  label: { position: 'absolute', minHeight: 26, justifyContent: 'center', paddingHorizontal: 6, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  text: { fontWeight: '700', fontSize: 13, lineHeight: 16 },
});
