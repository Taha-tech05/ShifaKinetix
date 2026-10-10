// 3D body for BodyViewer. Loads the lite pack (one merged mesh per layer+region) and reports taps.
// Taps are resolved with pickPack (triangle ranges), not three's raycaster over every mesh.
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import * as THREE from 'three';
import { shoulderRegionFromHit } from '../../regions/fromHit';
import type { Point3D } from '../../store/session';
import { highlightMesh, restoreMesh } from '../../screens/model3d/loadPack';
import type { LoadedPack } from '../../screens/model3d/loadPack';
import { pickPack } from '../../screens/model3d/pick';
import type { BodyLayer } from '../BodyViewer';

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
  /** Called with a shoulder region id and the tapped point, or with null when the tap was elsewhere. */
  onPick: (pick: { regionId: string; point: Point3D } | null) => void;
  onFirstFrame: () => void;
}

function Scene({ pack, layer, control, onPick, onFirstFrame }: Body3DProps & { control: React.MutableRefObject<Control> }) {
  const pivot = useRef<THREE.Group>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const highlighted = useRef<{ part: (typeof pack.parts)[number]; index: number } | null>(null);
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

  useEffect(() => {
    for (const p of pack.parts) p.mesh.visible = layer === 'all' || p.layer === layer;
  }, [pack, layer]);

  const clearHighlight = () => {
    const h = highlighted.current;
    if (h) restoreMesh(h.part, h.index);
    highlighted.current = null;
  };
  useEffect(() => clearHighlight, []);
  useEffect(() => {
    clearHighlight();
  }, [layer]);

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
      const origin = raycaster.ray.origin;
      const dir = raycaster.ray.direction;
      const hits = pickPack(pack.parts, origin.toArray(), dir.toArray());
      clearHighlight();
      // First hit (nearest) that is near the shoulder wins; anything else is ignored.
      for (const h of hits) {
        const world = origin.clone().addScaledVector(dir, h.distance);
        // back to model space: undo pivot rotation and the fit transform
        const local = pivot.current ? pivot.current.worldToLocal(world.clone()) : world.clone();
        const model = local.divideScalar(fitted.scale).add(fitted.center);
        const regionId = shoulderRegionFromHit({
          packRegion: h.part.region,
          meshName: h.name,
          x: model.x,
          yaw: c.yaw,
          pitch: c.pitch,
        });
        if (regionId) {
          highlightMesh(h.part, h.index);
          highlighted.current = { part: h.part, index: h.index };
          onPick({ regionId, point: { x: model.x, y: model.y, z: model.z } });
          return;
        }
      }
      onPick(null);
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
