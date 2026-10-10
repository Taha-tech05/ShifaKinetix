import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../theme';

export interface Hotspot {
  id: string;
  /** Position inside the figure box, in percent. */
  x: number;
  y: number;
  label: string;
}

interface Props {
  /** Height of the studio card, or 'fill' to take the space left by the parent. */
  height?: number | 'fill';
  hotspots?: Hotspot[];
  selectedId?: string | null;
  onHotspot?: (id: string) => void;
  /** Marker drawn without being tappable (P6 preview). */
  marker?: { x: number; y: number } | null;
  children?: React.ReactNode;
}

const SOFT = ['#F4F8FB', '#DCE6EE'] as const;

function Part({ style }: { style: object }) {
  return <LinearGradient colors={[...SOFT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.part, style]} />;
}

/**
 * Soft studio card with a simple standing figure, as in the design's body panels.
 * Stand-in until the 3D body is wired in; the figure has tappable hotspots for the shoulders.
 */
export function BodyFigure({ height = 250, hotspots = [], selectedId = null, onHotspot, marker = null, children }: Props) {
  return (
    <LinearGradient
      colors={[...gradients.studio]}
      start={{ x: 0.5, y: 0.1 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.studio, height === 'fill' ? styles.fill : { height }]}
    >
      <View style={styles.figure}>
        <Part style={{ left: '38%', top: '2%', width: '24%', height: '12%', borderRadius: 999 }} />
        <Part style={{ left: '30%', top: '15%', width: '40%', height: '34%', borderRadius: 28 }} />
        <Part style={{ left: '16%', top: '16%', width: '10%', height: '34%', borderRadius: 20 }} />
        <Part style={{ left: '74%', top: '16%', width: '10%', height: '34%', borderRadius: 20 }} />
        <Part style={{ left: '33%', top: '51%', width: '16%', height: '46%', borderRadius: 20 }} />
        <Part style={{ left: '51%', top: '51%', width: '16%', height: '46%', borderRadius: 20 }} />
        {marker ? <View style={[styles.dot, { left: `${marker.x}%`, top: `${marker.y}%` }]} /> : null}
        {hotspots.map((h) => {
          const on = h.id === selectedId;
          return (
            <Pressable
              key={h.id}
              accessibilityRole="button"
              accessibilityLabel={h.label}
              accessibilityState={{ selected: on }}
              onPress={() => onHotspot?.(h.id)}
              style={[styles.hit, { left: `${h.x}%`, top: `${h.y}%` }]}
              hitSlop={4}
            >
              <View style={[styles.ring, on && styles.ringOn]}>
                <View style={styles.dot2} />
              </View>
            </Pressable>
          );
        })}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  studio: { borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  figure: { width: '70%', height: '88%' },
  part: { position: 'absolute' },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginStart: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },
  hit: { position: 'absolute', width: 48, height: 48, marginStart: -24, marginTop: -24, alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(192,57,43,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { backgroundColor: 'rgba(192,57,43,0.32)', transform: [{ scale: 1.2 }] },
  dot2: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.white },
});
