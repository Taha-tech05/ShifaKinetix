// The real 3D body (lite pack) animated with rigid segments, pivots and keyframes, in the same viewer setup as the picker.
// The pack is NOT changed or rebuilt. Each moving segment is a new mesh that shares the pack's vertex, normal and colour
// buffers and has its own index list (see movement/split.ts). The segments sit under groups whose matrices come from
// movement/rig.ts. Trunk and the other arm never move. Muscles use rigid assignment, so a muscle that crosses a joint is
// cut at the joint instead of stretching (no skinning).
//
// Three things are kept apart on purpose:
//  - the ANIMATION only writes segment matrices (stepClock + armTransforms), never the camera;
//  - the CAMERA is a state object (cameraRig.ts) changed only by the user's touch and by "Reset view";
//  - EMPHASIS (tint, ghost) is a per-structure material, so the model as a whole is never made transparent.
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { stepClock } from '../../movement/animationStep';
import type { AnimControl } from '../../movement/animationStep';
import { apply, armTransforms, arrowDirection, jointPositions, lengthOf, rigFor, sub3 } from '../../movement/rig';
import type { Mat4, Side, Vec3 } from '../../movement/rig';
import { endPose, poseAt } from '../../movement/pose';
import type { Pose } from '../../movement/pose';
import type { Movement } from '../../movement/movements';
import type { BodyLayer } from '../../regions/types';
import type { LoadedPack } from '../../screens/model3d/loadPack';
import { positionOf, stepFraming } from './cameraRig';
import type { CameraRig } from './cameraRig';
import { NO_EMPHASIS } from './highlightPlan';
import type { Emphasis } from './highlightPlan';
import { useViewerGestures } from './useViewerGestures';
import { buildSegments, fadeMaterial } from './segmentBuild';
import { AMBIENT_INTENSITY, KEY_LIGHT, VIEWER_FOV } from './viewerSetup';

export type { AnimControl } from '../../movement/animationStep';
export { buildSegments, fadeMaterial } from './segmentBuild';

export interface FrameInfo {
  t: number;
  pose: Pose;
  fps: number;
  /** Distance between the humeral head centre and the glenoid centre, millimetres. */
  gapMm: number;
}

export interface SegmentedBodyProps {
  pack: LoadedPack;
  movement: Movement;
  layer: BodyLayer;
  /** Which arm moves. The left arm is the mirror image of the right. Default right. */
  side?: Side;
  /** Tint the moving arm segments with a distinct colour (opacity stays 1). Default true. */
  armTint?: boolean;
  /** Show a faint translucent copy of the arm at the end pose. Default true. */
  endGhost?: boolean;
  control: React.MutableRefObject<AnimControl>;
  /** Camera state, owned by the screen (so its buttons can reset it). Only the user's touch and "Reset view" change it. */
  cameraRig: React.MutableRefObject<CameraRig>;
  /** Structures that can be tinted or ghosted. Each gets its own material; the rest share the base material. */
  tracked?: string[];
  /** What to tint and ghost right now. Changes cross-fade. */
  emphasis?: Emphasis;
  /** Called with true while a finger is on the model, false when it lifts (the screen switches its scrolling off). */
  onInteract?: (active: boolean) => void;
  onFrame?: (info: FrameInfo) => void;
  onFirstFrame?: () => void;
}

const ARROW_LENGTH = 0.16;
/** Seconds for a tint or ghost to fade in or out. */
const FADE_SECONDS = 0.35;

function setMatrix(g: THREE.Group, m: Mat4) {
  g.matrix.fromArray(m);
  g.matrixWorldNeedsUpdate = true;
}

/** Applies the camera state to the three.js camera and keeps the key light on the camera side, as in the picker. */
function CameraDriver({ rig, light }: { rig: React.MutableRefObject<CameraRig>; light: THREE.DirectionalLight }) {
  const { camera } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const r = rig.current;
    stepFraming(r, dt);
    const v = r.view;
    const p = positionOf(v);
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(v.target[0], v.target[1], v.target[2]);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== v.fov || cam.zoom !== v.zoom) {
      cam.fov = v.fov;
      cam.zoom = v.zoom;
      cam.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    light.target.position.set(v.target[0], v.target[1], v.target[2]);
    tmp.set(KEY_LIGHT.position[0], KEY_LIGHT.position[1], KEY_LIGHT.position[2]).applyQuaternion(camera.quaternion);
    light.position.set(v.target[0] + tmp.x, v.target[1] + tmp.y, v.target[2] + tmp.z);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
  });
  return null;
}

/** The path of the palm over one loop, as a thin line (a clarity aid; it does not touch the model's material). */
function buildTrail(movement: Movement, side: Side): { line: THREE.Line; dispose: () => void } {
  const rig = rigFor(side);
  const p = rig.pivots;
  const palm: Vec3 = [p.wrist[0] + (p.wrist[0] - p.elbow[0]) * 0.35, p.wrist[1] + (p.wrist[1] - p.elbow[1]) * 0.35, p.wrist[2] + (p.wrist[2] - p.elbow[2]) * 0.35];
  const n = 120;
  const pos = new Float32Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const q = apply(armTransforms(poseAt(movement, i / n), rig).forearm, palm);
    pos.set(q, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineBasicMaterial({ color: 0xff9f1c, depthTest: false });
  const line = new THREE.Line(g, m);
  line.renderOrder = 10;
  line.frustumCulled = false;
  return { line, dispose: () => { g.dispose(); m.dispose(); } };
}

function Scene({ pack, movement, layer, side = 'right', armTint = true, endGhost = true, control, cameraRig, tracked, emphasis = NO_EMPHASIS, onFrame, onFirstFrame }: SegmentedBodyProps) {
  const rig = rigFor(side);
  const arrow = useRef<THREE.ArrowHelper | null>(null);
  const frames = useRef(0);
  const fps = useRef({ n: 0, t0: 0, value: 0 });
  const lastReport = useRef(0);
  const light = useMemo(() => new THREE.DirectionalLight(0xffffff, KEY_LIGHT.intensity), []);
  const trackedKey = (tracked ?? []).join('|');
  const trackedSet = useMemo(() => new Set(tracked ?? []), [trackedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const built = useMemo(() => buildSegments(pack, layer, trackedSet, { side, tintArm: armTint, endGhost }), [pack, layer, trackedSet, side, armTint, endGhost]);
  useEffect(() => () => built.dispose(), [built]);

  // the end pose is fixed for a movement: pose the ghost copy once
  useEffect(() => {
    if (!endGhost) return;
    const tr = armTransforms(endPose(movement), rig);
    setMatrix(built.ghostGroups.upper, tr.upper);
    setMatrix(built.ghostGroups.forearm, tr.forearm);
  }, [built, movement, rig, endGhost]);

  // the hand path, for movements that ask for it
  const trail = useMemo(() => (movement.trail ? buildTrail(movement, side) : null), [movement, side]);
  useEffect(() => () => trail?.dispose(), [trail]);

  // current and target emphasis per tracked structure (a ref: it changes every frame while fading)
  const target = useRef<Emphasis>(emphasis);
  target.current = emphasis;
  const current = useRef(new Map<string, { tint: number; ghost: number }>());

  // resist arrow
  useEffect(() => {
    if (!movement.resistArrow) {
      arrow.current = null;
      return;
    }
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), ARROW_LENGTH, 0xe8833a, 0.05, 0.035);
    a.visible = false;
    built.root.add(a);
    arrow.current = a;
    return () => {
      built.root.remove(a);
      a.dispose();
      arrow.current = null;
    };
  }, [built, movement]);

  useFrame((state, dt) => {
    // ---- animation: time -> pose -> segment matrices. Nothing here reads or writes the camera. ----
    const c = control.current;
    const t = stepClock(c, dt, movement.loopSeconds);
    const pose = poseAt(movement, t);
    const tr = armTransforms(pose, rig);
    setMatrix(built.groups.girdle, tr.girdle);
    setMatrix(built.groups.upper, tr.upper);
    setMatrix(built.groups.forearm, tr.forearm);

    const ra = movement.resistArrow;
    const a = arrow.current;
    if (ra && a) {
      const show = c.t >= ra.during[0] && c.t <= ra.during[1];
      a.visible = show;
      if (show) {
        const p = rig.pivots;
        const rest: Vec3 = ra.segment === 'hand' ? [p.wrist[0] + (p.wrist[0] - p.elbow[0]) * 0.3, p.wrist[1] + (p.wrist[1] - p.elbow[1]) * 0.3, p.wrist[2] + (p.wrist[2] - p.elbow[2]) * 0.3] : [(p.elbow[0] + p.wrist[0]) / 2, (p.elbow[1] + p.wrist[1]) / 2, (p.elbow[2] + p.wrist[2]) / 2];
        const tip = apply(tr.forearm, rest);
        const dir = arrowDirection(ra.direction, side);
        a.position.set(tip[0] - dir[0] * ARROW_LENGTH, tip[1] - dir[1] * ARROW_LENGTH, tip[2] - dir[2] * ARROW_LENGTH);
        a.setDirection(new THREE.Vector3(...dir));
      }
    }

    // ---- emphasis: cross-fade tint and ghost per structure ----
    const step = Math.min(1, dt / FADE_SECONDS);
    built.materials.forEach((m, id) => {
      const cur = current.current.get(id) ?? { tint: 0, ghost: 0 };
      const wantTint = target.current.tint[id] ?? 0;
      const wantGhost = target.current.ghost[id] ?? 0;
      const nt = cur.tint + Math.max(-step, Math.min(step, wantTint - cur.tint));
      const ng = cur.ghost + Math.max(-step, Math.min(step, wantGhost - cur.ghost));
      if (nt !== cur.tint || ng !== cur.ghost || !current.current.has(id)) {
        current.current.set(id, { tint: nt, ghost: ng });
        fadeMaterial(m, nt, ng);
      }
    });

    frames.current++;
    if (frames.current === 2) onFirstFrame?.();

    // fps over windows of at least half a second
    const f = fps.current;
    const now = state.clock.elapsedTime;
    if (f.t0 === 0) f.t0 = now;
    f.n++;
    if (now - f.t0 >= 0.5) {
      f.value = Math.round(f.n / (now - f.t0));
      f.n = 0;
      f.t0 = now;
    }
    if (onFrame && now - lastReport.current > 0.2) {
      lastReport.current = now;
      const j = jointPositions(pose, rig);
      onFrame({ t: c.t, pose, fps: f.value, gapMm: Math.round(lengthOf(sub3(j.humeralHead, j.glenoid)) * 1000 * 10) / 10 });
    }
  });

  return (
    <>
      <CameraDriver rig={cameraRig} light={light} />
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <primitive object={light} />
      <primitive object={light.target} />
      <primitive object={built.root} />
      {endGhost ? <primitive object={built.ghostRoot} /> : null}
      {trail ? <primitive object={trail.line} /> : null}
    </>
  );
}

/** Canvas with the animated, segmented body. One finger turns the view, two fingers zoom and pan. */
export function SegmentedBody(props: SegmentedBodyProps) {
  const { panHandlers, onLayout } = useViewerGestures(props.cameraRig, props.onInteract);
  const v = props.cameraRig.current.view;
  const p = positionOf(v);
  return (
    <View style={styles.fill} onLayout={onLayout} {...panHandlers}>
      <Canvas camera={{ fov: VIEWER_FOV, near: 0.05, far: 20, position: p }}>
        <Scene {...props} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
