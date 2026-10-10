// 3D body for BodyViewer. Loads the lite pack (one merged mesh per layer+region) and reports taps.
// Taps are resolved with pickPack (triangle ranges), not three's raycaster over every mesh.
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import * as THREE from 'three';
import { applyLayer, selectFromRay } from '../../regions/select';
import type { BodyLayer, BodySelection, Point3D } from '../../regions/types';
import { disposeOutline, highlightMesh, makeOutline, restoreMesh } from '../../screens/model3d/loadPack';
import type { LoadedPack } from '../../screens/model3d/loadPack';

const FOV = 45;

type Control = {
  yaw: number;
  pitch: number;
  distance: number;
  baseDistance: number;
  tap: { x: number; y: number } | null;
};

export interface Body3DProps {
  pack: LoadedPack;
  layer: BodyLayer;
  /** A tap result: the selection, or null when the tap hit nothing or was not near a shoulder. */
  onPick: (selection: BodySelection | null) => void;
  onFirstFrame: () => void;
}

function Scene({ pack, layer, control, onPick, onFirstFrame }: Body3DProps & { control: React.MutableRefObject<Control> }) {
  const pivot = useRef<THREE.Group>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const highlighted = useRef<{ part: (typeof pack.parts)[number]; index: number; outline: THREE.Mesh } | null>(null);
  const frames = useRef(0);

  const fitted = useMemo(() => {
    const { min, max } = pack.meta.bbox;
    const lo = new THREE.Vector3(...min);
    const hi = new THREE.Vector3(...max);
    const size = hi.clone().sub(lo);
    const distance = (1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * 1.25;
    return { center: lo.clone().add(hi).multiplyScalar(0.5), scale: 2 / size.y, distance };
  }, [pack]);

  useEffect(() => {
    control.current.baseDistance = fitted.distance;
    control.current.distance = fitted.distance;
  }, [fitted, control]);

  const clearHighlight = () => {
    const h = highlighted.current;
    if (h) {
      restoreMesh(h.part, h.index);
      disposeOutline(h.outline);
    }
    highlighted.current = null;
  };
  // Only the chosen layer is shown and can be hit. Changing layer also drops the old highlight.
  useEffect(() => {
    clearHighlight();
    applyLayer(pack.parts, layer);
  }, [pack, layer]);
  useEffect(() => clearHighlight, []);

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

    if (c.tap) {
      const { x, y } = c.tap;
      c.tap = null;
      pivot.current?.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(new THREE.Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1), camera);
      // World point back to model space: undo the pivot turn, then the fit (scale and centre).
      const toModel = (w: Point3D): Point3D => {
        const local = pivot.current ? pivot.current.worldToLocal(new THREE.Vector3(w.x, w.y, w.z)) : new THREE.Vector3(w.x, w.y, w.z);
        const m = local.divideScalar(fitted.scale).add(fitted.center);
        return { x: m.x, y: m.y, z: m.z };
      };
      const hit = selectFromRay(pack.parts, layer, raycaster.ray.origin.toArray(), raycaster.ray.direction.toArray(), toModel);
      clearHighlight();
      if (!hit) {
        onPick(null);
        return;
      }
      highlightMesh(hit.part, hit.index);
      const outline = makeOutline(hit.part, hit.index);
      hit.part.mesh.parent?.add(outline);
      highlighted.current = { part: hit.part, index: hit.index, outline };
      onPick(hit.selection);
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
  const control = useRef<Control>({ yaw: 0, pitch: 0, distance: 5, baseDistance: 5, tap: null });
  const touch = useRef({ x0: 0, y0: 0, t0: 0, moved: 0, lastX: 0, lastY: 0, pinch: 0, multi: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const n = e.nativeEvent;
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
          if (!t.multi && t.moved < 12 && Date.now() - t.t0 < 500) control.current.tap = { x: t.x0, y: t.y0 };
        },
      }),
    [],
  );

  return (
    <View style={styles.fill} {...responder.panHandlers}>
      <Canvas camera={{ position: [0, 0, 5], fov: FOV, near: 0.05, far: 100 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 4]} intensity={2} />
        <Scene {...props} control={control} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
