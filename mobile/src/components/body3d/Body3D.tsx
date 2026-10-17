// 3D body for BodyViewer and the result screen. Shows the lite pack (one merged mesh per layer+region) and reports taps.
// Taps are resolved with pickPack (triangle ranges), not three's raycaster over every mesh.
// What is highlighted is decided by the parent (highlightNames), so one structure (exact mode), a whole area (region
// mode) or several result candidates can be shown with the same code.
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import * as THREE from 'three';
import { applyLayer, resolveRay } from '../../regions/select';
import type { BodyLayer, BodySelection, Point3D } from '../../regions/types';
import { disposeOutline, highlightMesh, makeOutline, restoreMesh } from '../../screens/model3d/loadPack';
import type { LoadedPack } from '../../screens/model3d/loadPack';
import { StudioLights } from './StudioLights';
import { VIEWER_FOV as FOV } from './viewerSetup';

/** More outlines than this is too many extra meshes for a phone; the fill highlight still shows. */
const MAX_OUTLINES = 60;

type Control = {
  yaw: number;
  pitch: number;
  distance: number;
  baseDistance: number;
  tap: { x: number; y: number } | null;
};

/** What a tap did: a shoulder selection, a tap on another body area (full project), or nothing. */
export type PickResult = { type: 'selection'; selection: BodySelection } | { type: 'outOfScope'; packRegion: string } | { type: 'none' };

/** Screen position of a model-space point, for a label that follows it. `facing` is 1 when the point faces the camera and 0 when it has turned away. */
export interface ProjectedPoint {
  x: number;
  y: number;
  facing: number;
}

export interface Body3DProps {
  /** A model-space point to follow on screen (the tapped point). With onProject, called about 30 times a second, never through React state. */
  anchor?: Point3D | null;
  onProject?: (p: ProjectedPoint | null) => void;
  /** Screen-reader label of the touch area (the tap target). */
  accessibilityLabel?: string;
  pack: LoadedPack;
  layer: BodyLayer;
  /** Mesh names to show highlighted (cyan fill and outline). */
  highlightNames?: string[];
  /** Turn the body at the start, in radians. 0 faces the viewer. */
  initialYaw?: number;
  /** Omit for a read-only view (result screen): taps then do nothing. */
  onPick?: (result: PickResult) => void;
  onFirstFrame: () => void;
}

type Highlighted = { part: LoadedPack['parts'][number]; index: number; outline: THREE.Mesh | null };

function Scene({ pack, layer, highlightNames, onPick, onFirstFrame, control, anchor, onProject }: Body3DProps & { control: React.MutableRefObject<Control> }) {
  const projectTmp = useMemo(() => ({ p: new THREE.Vector3(), cam: new THREE.Vector3() }), []);
  const pivot = useRef<THREE.Group>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const highlighted = useRef<Highlighted[]>([]);
  const frames = useRef(0);

  const fitted = useMemo(() => {
    const { min, max } = pack.meta.bbox;
    const lo = new THREE.Vector3(...min);
    const hi = new THREE.Vector3(...max);
    const size = hi.clone().sub(lo);
    const distance = (1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 1.25;
    return { center: lo.clone().add(hi).multiplyScalar(0.5), scale: 2 / size.y, distance };
  }, [pack]);

  // mesh name -> part and index, built once per pack
  const meshIndex = useMemo(() => {
    const m = new Map<string, { part: LoadedPack['parts'][number]; index: number }>();
    for (const part of pack.parts) part.names.forEach((n, index) => m.set(n, { part, index }));
    return m;
  }, [pack]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- the camera control is a mutable ref shared with the gesture handler and the frame loop
    control.current.baseDistance = fitted.distance;
    control.current.distance = fitted.distance;
  }, [fitted, control]);

  const clearHighlight = () => {
    for (const h of highlighted.current) {
      restoreMesh(h.part, h.index);
      disposeOutline(h.outline);
    }
    highlighted.current = [];
  };

  // Only the chosen layer is shown and can be hit.
  useEffect(() => {
    applyLayer(pack.parts, layer);
  }, [pack, layer]);

  // Highlight exactly the meshes the parent names, and only the ones in the visible layer.
  const key = (highlightNames ?? []).join('|');
  useEffect(() => {
    clearHighlight();
    const next: Highlighted[] = [];
    const names = highlightNames ?? [];
    for (const n of names) {
      const e = meshIndex.get(n);
      if (!e || !e.part.mesh.visible) continue;
      highlightMesh(e.part, e.index);
      let outline: THREE.Mesh | null = null;
      if (names.length <= MAX_OUTLINES) {
        outline = makeOutline(e.part, e.index);
        e.part.mesh.parent?.add(outline);
      }
      next.push({ part: e.part, index: e.index, outline });
    }
    highlighted.current = next;
  }, [pack, layer, key, meshIndex]);
  useEffect(() => clearHighlight, []);

  // eslint-disable-next-line react-hooks/immutability -- imperative three.js highlight bookkeeping kept in a ref
  useFrame(({ camera, size }) => {
    const c = control.current;
    if (pivot.current) {
      pivot.current.rotation.y = c.yaw;
      pivot.current.rotation.x = c.pitch;
    }
    camera.position.set(0, 0, c.distance);
    camera.lookAt(0, 0, 0);

    frames.current++;
    if (frames.current === 2) onFirstFrame();

    // follow the anchor on screen: project it with the camera, throttled to every second frame (no React state involved)
    if (anchor && onProject && frames.current % 2 === 0 && pivot.current) {
      const { p, cam } = projectTmp;
      pivot.current.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      // model space -> the fitted group (scale and centre) -> world
      p.set(anchor.x, anchor.y, anchor.z).sub(fitted.center).multiplyScalar(fitted.scale);
      const local = p.clone();
      pivot.current.localToWorld(p);
      p.project(camera);
      // facing: the point is hidden only when it lies clearly behind the body's centre plane as seen from the camera
      // (a point on the side of a shoulder is still visible). 1 = in view, 0 = turned away.
      cam.copy(camera.position);
      pivot.current.worldToLocal(cam);
      const pl = Math.hypot(local.x, local.z);
      const cl = Math.hypot(cam.x, cam.z) || 1;
      const d = pl < 1e-4 ? 1 : (cam.x * local.x + cam.z * local.z) / (cl * pl);
      const facing = Math.min(1, Math.max(0, (d + 0.35) / 0.35));
      onProject({ x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height, facing });
    }

    if (c.tap) {
      const { x, y } = c.tap;
      // eslint-disable-next-line react-hooks/immutability -- imperative three.js highlight bookkeeping kept in a ref
      c.tap = null;
      if (!onPick) return;
      pivot.current?.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1), camera);
      // World point back to model space: undo the pivot turn, then the fit (scale and centre).
      const toModel = (w: Point3D): Point3D => {
        const local = pivot.current ? pivot.current.worldToLocal(new THREE.Vector3(w.x, w.y, w.z)) : new THREE.Vector3(w.x, w.y, w.z);
        const m = local.divideScalar(fitted.scale).add(fitted.center);
        return { x: m.x, y: m.y, z: m.z };
      };
      const r = resolveRay(pack.parts, layer, raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray(), toModel);
      if (r.type === 'selection') onPick({ type: 'selection', selection: r.selection });
      else onPick(r);
    }
  });

  return (
    <group ref={pivot}>
      <group scale={fitted.scale} position={fitted.center.clone().multiplyScalar(-fitted.scale)}>
        <primitive object={pack.root} />
      </group>
    </group>
  );
}

/** One finger turns, two fingers zoom, a short still touch is a tap. */
export function Body3D(props: Body3DProps) {
  const control = useRef<Control>({ yaw: props.initialYaw ?? 0, pitch: 0, distance: 5, baseDistance: 5, tap: null });
  const touch = useRef({ x0: 0, y0: 0, t0: 0, moved: 0, lastX: 0, lastY: 0, pinch: 0, multi: false });

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- the gesture handler reads the refs on touch events, not during render
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const n = e.nativeEvent;
          // eslint-disable-next-line react-hooks/purity -- Date.now() is read inside a touch event, not during render
          touch.current = { x0: n.locationX, y0: n.locationY, t0: Date.now(), moved: 0, lastX: n.pageX, lastY: n.pageY, pinch: 0, multi: false };
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const t = touch.current;
          const ts = e.nativeEvent.touches;
          const c = control.current;
          if (ts.length >= 2) {
            t.multi = true;
            const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
            if (t.pinch > 0) {
              const next = c.distance * (t.pinch / d);
              c.distance = Math.min(c.baseDistance * 3, Math.max(c.baseDistance * 0.25, next));
            }
            t.pinch = d;
            t.moved = 999;
            return;
          }
          t.pinch = 0;
          const dx = e.nativeEvent.pageX - t.lastX;
          const dy = e.nativeEvent.pageY - t.lastY;
          t.lastX = e.nativeEvent.pageX;
          t.lastY = e.nativeEvent.pageY;
          t.moved += Math.abs(dx) + Math.abs(dy);
          c.yaw += dx * 0.01;
          c.pitch = Math.max(-1.2, Math.min(1.2, c.pitch + dy * 0.01));
        },
        onPanResponderRelease: () => {
          const t = touch.current;
          // eslint-disable-next-line react-hooks/purity -- Date.now() is read inside a touch event, not during render
          if (!t.multi && t.moved < 12 && Date.now() - t.t0 < 500) control.current.tap = { x: t.x0, y: t.y0 };
        },
      }),
    [],
  );

  return (
    <View style={styles.fill} accessible={props.accessibilityLabel !== undefined} accessibilityLabel={props.accessibilityLabel} {...responder.panHandlers}>
      <Canvas camera={{ position: [0, 0, 5], fov: FOV, near: 0.05, far: 100 }}>
        <StudioLights />
        <Scene {...props} control={control} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
