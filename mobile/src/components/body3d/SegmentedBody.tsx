// The real 3D body (lite pack) animated with rigid segments, pivots and keyframes.
// The pack is NOT changed or rebuilt. Each moving segment is a new mesh that shares the pack's vertex, normal and colour
// buffers and has its own index list (see movement/split.ts). The segments sit under groups whose matrices come from
// movement/rig.ts. Trunk and the left side never move. Muscles use rigid assignment, so a muscle that crosses a joint
// is cut at the joint instead of stretching (no skinning).
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { apply, armTransforms, arrowDirection, ARM_RIG, jointPositions, lengthOf, sub3 } from '../../movement/rig';
import type { Mat4, Vec3 } from '../../movement/rig';
import { groupLookup, splitIndices } from '../../movement/split';
import type { Group } from '../../movement/split';
import { poseAt } from '../../movement/pose';
import type { Pose } from '../../movement/pose';
import type { Movement } from '../../movement/movements';
import { layerVisible } from '../../regions/select';
import { meshNamesOfStructures } from '../../regions/regionMap';
import type { BodyLayer } from '../../regions/types';
import type { LoadedPack } from '../../screens/model3d/loadPack';

/** Playback state, changed by the screen and read every frame. */
export interface AnimControl {
  playing: boolean;
  /** 0.25, 0.5 or 1 for the dev screen; 1 for patients. */
  speed: number;
  /** Set to a loop fraction (0 to 1) to jump there (scrubbing); the scene clears it. */
  seek: number | null;
  /** Current loop fraction, written by the scene. */
  t: number;
}

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
  control: React.MutableRefObject<AnimControl>;
  view?: 'front' | 'side';
  /** Dim the muscles that are not suggested (only in the Muscle layer). */
  dimOthers?: boolean;
  onFrame?: (info: FrameInfo) => void;
  onFirstFrame?: () => void;
}

const FOV = 45;
const TARGET: Vec3 = [-0.25, 1.33, -0.03]; // middle of the right shoulder and arm
const DISTANCE = 1.9;
const GROUPS: Group[] = ['trunk', 'girdle', 'upper', 'forearm'];
const ARROW_LENGTH = 0.16;

type Built = { root: THREE.Group; groups: Record<Group, THREE.Group>; dispose: () => void; triangles: number; meshes: number };

/** Build segment meshes from the pack parts of the visible layer. */
export function buildSegments(pack: LoadedPack, layer: BodyLayer, highlight: Set<string>, dim: boolean): Built {
  const groupOf = groupLookup(ARM_RIG);
  const root = new THREE.Group();
  const groups = {} as Record<Group, THREE.Group>;
  for (const g of GROUPS) {
    groups[g] = new THREE.Group();
    groups[g].matrixAutoUpdate = false;
    root.add(groups[g]);
  }
  const normal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const dimmed = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, transparent: true, opacity: 0.25, depthWrite: false });
  const hl = new THREE.MeshStandardMaterial({ color: '#00E5FF', emissive: '#007A99', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.0 });
  const geometries: THREE.BufferGeometry[] = [];
  let triangles = 0;
  let meshes = 0;
  for (const part of pack.parts) {
    if (!layerVisible(part.layer, layer)) continue;
    const pieces = splitIndices({ names: part.names, triStart: part.triStart, triCount: part.triCount, indices: part.indices }, groupOf, (n) => highlight.has(n));
    const src = part.mesh.geometry;
    const onlyTrunk = pieces.length === 1 && pieces[0].group === 'trunk' && !pieces[0].highlight;
    for (const piece of pieces) {
      const g = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'color']) g.setAttribute(name, src.getAttribute(name));
      // an untouched part reuses the pack's own index buffer; only split parts get new, smaller ones
      g.setIndex(onlyTrunk ? src.getIndex() : new THREE.BufferAttribute(piece.index, 1));
      g.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Math.sqrt(3));
      geometries.push(g);
      const material = piece.highlight ? hl : dim && layer === 'muscle' ? dimmed : normal;
      const mesh = new THREE.Mesh(g, material);
      mesh.position.copy(part.mesh.position);
      mesh.scale.copy(part.mesh.scale);
      mesh.frustumCulled = false;
      groups[piece.group].add(mesh);
      triangles += piece.triangles;
      meshes++;
    }
  }
  return {
    root,
    groups,
    triangles,
    meshes,
    dispose: () => {
      // shared attributes belong to the pack; only the geometries and materials created here are released
      geometries.forEach((g) => g.dispose());
      normal.dispose();
      dimmed.dispose();
      hl.dispose();
    },
  };
}

function setMatrix(g: THREE.Group, m: Mat4) {
  g.matrix.fromArray(m);
  g.matrixWorldNeedsUpdate = true;
}

function Scene({ pack, movement, layer, control, view, dimOthers = true, onFrame, onFirstFrame }: SegmentedBodyProps) {
  const { camera } = useThree();
  const light = useRef<THREE.DirectionalLight>(null);
  const arrow = useRef<THREE.ArrowHelper | null>(null);
  const frames = useRef(0);
  const fps = useRef({ n: 0, t0: 0, value: 0 });
  const lastReport = useRef(0);
  const effectiveView = view ?? movement.view;

  const highlight = useMemo(() => new Set(layer === 'muscle' ? meshNamesOfStructures(movement.suggestsStructures) : []), [movement, layer]);
  const built = useMemo(() => buildSegments(pack, layer, highlight, dimOthers && highlight.size > 0), [pack, layer, highlight, dimOthers]);
  useEffect(() => () => built.dispose(), [built]);

  // camera: front looks at the right shoulder from the front, side from the patient's right
  useEffect(() => {
    const t = new THREE.Vector3(...TARGET);
    if (effectiveView === 'front') camera.position.set(t.x, t.y, t.z + DISTANCE);
    else camera.position.set(t.x - DISTANCE, t.y, t.z);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    if (effectiveView === 'front') light.current?.position.set(0.5, 2, 3);
    else light.current?.position.set(-3, 2, 0.5);
  }, [camera, effectiveView]);

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
    const c = control.current;
    if (c.seek !== null) {
      c.t = c.seek;
      c.seek = null;
    } else if (c.playing) {
      c.t = (c.t + (dt * c.speed) / movement.loopSeconds) % 1;
    }
    const pose = poseAt(movement, c.t);
    const tr = armTransforms(pose);
    setMatrix(built.groups.girdle, tr.girdle);
    setMatrix(built.groups.upper, tr.upper);
    setMatrix(built.groups.forearm, tr.forearm);

    const ra = movement.resistArrow;
    const a = arrow.current;
    if (ra && a) {
      const show = c.t >= ra.during[0] && c.t <= ra.during[1];
      a.visible = show;
      if (show) {
        const p = ARM_RIG.pivots;
        const rest: Vec3 = ra.segment === 'hand' ? [p.wrist[0] + (p.wrist[0] - p.elbow[0]) * 0.3, p.wrist[1] + (p.wrist[1] - p.elbow[1]) * 0.3, p.wrist[2] + (p.wrist[2] - p.elbow[2]) * 0.3] : [(p.elbow[0] + p.wrist[0]) / 2, (p.elbow[1] + p.wrist[1]) / 2, (p.elbow[2] + p.wrist[2]) / 2];
        const tip = apply(tr.forearm, rest);
        const dir = arrowDirection(ra.direction);
        a.position.set(tip[0] - dir[0] * ARROW_LENGTH, tip[1] - dir[1] * ARROW_LENGTH, tip[2] - dir[2] * ARROW_LENGTH);
        a.setDirection(new THREE.Vector3(...dir));
      }
    }

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
      const j = jointPositions(pose);
      onFrame({ t: c.t, pose, fps: f.value, gapMm: Math.round(lengthOf(sub3(j.humeralHead, j.glenoid)) * 1000 * 10) / 10 });
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight ref={light} intensity={2} position={[0.5, 2, 3]} />
      <primitive object={built.root} />
    </>
  );
}

/** Canvas with the animated, segmented body. */
export function SegmentedBody(props: SegmentedBodyProps) {
  return (
    <View style={styles.fill}>
      <Canvas camera={{ fov: FOV, near: 0.05, far: 20, position: [TARGET[0], TARGET[1], TARGET[2] + DISTANCE] }}>
        <Scene {...props} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
