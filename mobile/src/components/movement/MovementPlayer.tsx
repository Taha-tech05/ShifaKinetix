// Data-driven movement demo: a simple mannequin made of capsule segments and pivots, driven by the keyframes in
// movements_shoulder.json. It loops slowly (about 4 seconds), never past the comfortable range in the data.
// It is drawn on its own mannequin, not on the 3D body, because the lite pack merges both arms and all muscles of a
// region into single meshes with no joints (see docs/intake-flow.md).
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { LOOP_MS, localized } from '../../movement/movements';
import type { Keyframe, Movement } from '../../movement/movements';
import { useT } from '../../store/settings';
import { colors } from '../../theme';
import { AppText } from '../AppText';

const STAGE = { w: 300, h: 270 };
const UPPER = 62;
const FORE = 52;
const BODY_FILL = '#E4ECF2';
const BODY_LINE = '#9FB3C4';
const ARM_FILL = '#CBE7E7';
const ARM_LINE = colors.teal;

/** A capsule: rounded rectangle with a thin outline. */
function Capsule({ x, y, w, h, fill = BODY_FILL, line = BODY_LINE }: { x: number; y: number; w: number; h: number; fill?: string; line?: string }) {
  return (
    <View
      style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: Math.min(w, h) / 2, backgroundColor: fill, borderWidth: 2, borderColor: line }}
    />
  );
}

/** Interpolate one channel of the keyframes into a rotation in degrees, easing like pose.ts. */
function channel(v: Animated.Value, kf: Keyframe[], pick: (k: Keyframe) => number, mul: number) {
  return v.interpolate({
    inputRange: kf.map((k) => k.t),
    outputRange: kf.map((k) => `${pick(k) * mul}deg`),
    easing: Easing.inOut(Easing.sin),
  });
}

/** Zero-size view at a pivot: its rotation turns everything inside around that point. */
function Pivot({ x, y, rotate, children }: { x: number; y: number; rotate: Animated.AnimatedInterpolation<string> | string; children?: React.ReactNode }) {
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, transform: [{ rotate }] }}>{children}</Animated.View>
  );
}

function Mannequin({ movement, value }: { movement: Movement; value: Animated.Value }) {
  const front = movement.view === 'front';
  const kf = movement.keyframes;
  // Front view: the right arm is drawn on the left of the picture and rises outward (clockwise).
  // Side view: the body faces right and the arm rises forward (counter-clockwise).
  const armSign = front ? 1 : -1;
  const elbowSign = movement.elbowDirection === 'behind' ? 1 : -1;
  const arm = channel(value, kf, (k) => k.humerusDeg, armSign);
  const elbow = channel(value, kf, (k) => k.elbowDeg, elbowSign);
  // Outward swing (outward push): the hand moves away from the belly, counter-clockwise on the picture (schematic).
  const outward = channel(value, kf, (k) => k.forearmRotationDeg ?? 0, -1);
  const scapula = channel(value, kf, (k) => k.scapulaDeg, armSign);

  const cx = STAGE.w / 2;
  const torsoW = front ? 76 : 52;
  const torsoX = cx - torsoW / 2;
  const pivotX = front ? torsoX + 4 : cx;
  const pivotY = 78;

  return (
    <View style={{ width: STAGE.w, height: STAGE.h }}>
      <Capsule x={cx - 20} y={12} w={40} h={44} /> {/* head */}
      <Capsule x={torsoX} y={58} w={torsoW} h={112} /> {/* torso */}
      {front ? (
        <>
          <Capsule x={cx - 34} y={164} w={30} h={96} />
          <Capsule x={cx + 4} y={164} w={30} h={96} />
          <Capsule x={torsoX + torsoW - 14} y={pivotY - 8} w={18} h={UPPER + FORE - 10} /> {/* other arm, still */}
        </>
      ) : (
        <Capsule x={cx - 17} y={164} w={34} h={96} />
      )}
      {/* shoulder blade: a small plate that turns with the arm (schematic) */}
      <Pivot x={front ? pivotX + 16 : pivotX - 14} y={pivotY + 10} rotate={scapula}>
        <View style={{ position: 'absolute', left: -7, top: -20, width: 14, height: 40, borderRadius: 7, backgroundColor: 'rgba(47,127,127,0.55)' }} />
      </Pivot>
      {/* arm: upper arm turns about the shoulder, forearm about the elbow */}
      <Pivot x={pivotX} y={pivotY} rotate={arm}>
        <View style={{ position: 'absolute', left: -9, top: -8, width: 18, height: UPPER + 8, borderRadius: 9, backgroundColor: ARM_FILL, borderWidth: 2, borderColor: ARM_LINE }} />
        <Pivot x={0} y={UPPER - 4} rotate={elbow}>
          <Pivot x={0} y={0} rotate={outward}>
            <View style={{ position: 'absolute', left: -8, top: -6, width: 16, height: FORE + 6, borderRadius: 8, backgroundColor: ARM_FILL, borderWidth: 2, borderColor: ARM_LINE }} />
          </Pivot>
        </Pivot>
      </Pivot>
    </View>
  );
}

/** Loops the movement slowly. With reduced motion switched on it shows the peak pose and does not move. */
export function MovementPlayer({ movement }: { movement: Movement }) {
  const t = useT();
  const value = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduce) {
      const peak = movement.keyframes.find((k) => k.name === 'peak');
      value.setValue(peak?.t ?? 0.5);
      return;
    }
    value.setValue(0);
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration: LOOP_MS, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [movement, reduce, value]);

  const label = useMemo(() => `${localized(movement.name)}. ${localized(movement.instruction)}`, [movement]);

  return (
    <View style={styles.stage} accessible accessibilityLabel={label}>
      <View style={styles.badge}>
        <AppText variant="secondary" color={colors.navy} style={styles.bold}>
          {t('movement.demo')}
        </AppText>
      </View>
      <Mannequin movement={movement} value={value} />
      <View style={styles.legend}>
        <View style={styles.swatch} />
        <AppText variant="secondary" color={colors.navy}>
          {t('movement.shoulderBlade')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#EEF6F7',
    overflow: 'hidden',
  },
  badge: { position: 'absolute', top: 12, start: 12, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 12, height: 28, justifyContent: 'center', zIndex: 2 },
  bold: { fontWeight: '700' },
  legend: { position: 'absolute', bottom: 10, start: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 10, height: 28 },
  swatch: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(47,127,127,0.75)' },
});
