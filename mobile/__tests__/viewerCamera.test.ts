import * as THREE from 'three';
import { createCameraRig, isAtHome, orbit, pan, pinch, PAN_LIMIT, PITCH_MAX, PITCH_MIN, positionOf, presetForSide, resetView, setPreset, stepFraming, viewFromPreset, ZOOM_MAX_FACTOR, ZOOM_MIN_FACTOR } from '../src/components/body3d/cameraRig';
import type { CameraPreset } from '../src/components/body3d/cameraRig';
import { buildSegments, fadeMaterial } from '../src/components/body3d/segmentBuild';
import { GHOST_OPACITY, overlyingOf, planEmphasis } from '../src/components/body3d/highlightPlan';
import { BODY_MATERIAL_PARAMS, createBodyMaterial, VIEWER_FOV } from '../src/components/body3d/viewerSetup';
import { replay, stepClock } from '../src/movement/animationStep';
import type { AnimControl } from '../src/movement/animationStep';
import { MOVEMENTS } from '../src/movement/movements';
import { poseAt } from '../src/movement/pose';
import { armTransforms } from '../src/movement/rig';
import { REGION_MAP } from '../src/regions/regionMap';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');
const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

const preset: CameraPreset = { position: [-0.832, 1.428, 1.732], target: [-0.2, 1.28, 0], fov: 45, zoom: 1 };

describe('camera presets', () => {
  it('every movement has a placeholder preset: position, target, fov, zoom', () => {
    for (const m of MOVEMENTS) {
      expect(m.camera.position).toHaveLength(3);
      expect(m.camera.target).toHaveLength(3);
      expect(m.camera.fov).toBeGreaterThan(10);
      expect(m.camera.zoom).toBeGreaterThan(0);
      const v = viewFromPreset(m.camera);
      expect(v.distance).toBeGreaterThan(1); // upper body, not a close-up of one joint
      expect(v.distance).toBeLessThan(2.5);
    }
  });

  it('a preset round-trips through the orbit state', () => {
    const v = viewFromPreset(preset);
    const p = positionOf(v);
    p.forEach((x, i) => expect(x).toBeCloseTo(preset.position[i], 6));
  });

  it('the left side mirrors x', () => {
    const l = presetForSide(preset, 'left');
    expect(l.position[0]).toBeCloseTo(-preset.position[0], 9);
    expect(l.target[0]).toBeCloseTo(-preset.target[0], 9);
    expect(l.position[1]).toBe(preset.position[1]);
    expect(presetForSide(preset, 'right')).toBe(preset);
  });

  it('hand behind back is seen from behind, about 30 to 45 degrees to the selected (right) side', () => {
    const m = MOVEMENTS.find((x) => x.id === 'hand_behind_back')!;
    const v = viewFromPreset(m.camera);
    const fromBehind = Math.abs(Math.atan2(Math.sin(v.yaw - Math.PI), Math.cos(v.yaw - Math.PI))); // 0 = straight behind
    expect(fromBehind).toBeGreaterThan((30 * Math.PI) / 180);
    expect(fromBehind).toBeLessThan((45 * Math.PI) / 180);
    expect(positionOf(v)[2]).toBeLessThan(m.camera.target[2]); // behind the body (the front is +z)
    expect(positionOf(v)[0]).toBeLessThan(m.camera.target[0]); // towards the right side (-x)
  });
});

describe('camera: the user is in control', () => {
  it('a gesture cancels auto-framing and the preset is not applied again', () => {
    const rig = createCameraRig(preset, { ...viewFromPreset(preset), distance: 3.5 });
    expect(rig.framing).toBe(true);
    stepFraming(rig, 0.1);
    orbit(rig, 40, -10); // one finger
    expect(rig.framing).toBe(false);
    expect(rig.touched).toBe(true);
    const before = JSON.stringify(rig.view);
    for (let i = 0; i < 120; i++) stepFraming(rig, 1 / 60);
    expect(JSON.stringify(rig.view)).toBe(before); // nothing moves it any more
  });

  it('a new preset (next movement) does not move a camera the user has moved', () => {
    const rig = createCameraRig(preset);
    pinch(rig, 1.5);
    const before = JSON.stringify(rig.view);
    setPreset(rig, { ...preset, position: [0.5, 1.4, 1.8] });
    for (let i = 0; i < 120; i++) stepFraming(rig, 1 / 60);
    expect(JSON.stringify(rig.view)).toBe(before);
  });

  it('an untouched camera eases to a new preset and stops exactly there', () => {
    const rig = createCameraRig(preset);
    const next: CameraPreset = { position: [0.5, 1.4, 1.8], target: [0, 1.2, 0], fov: 45, zoom: 1.2 };
    setPreset(rig, next);
    expect(rig.framing).toBe(true);
    for (let i = 0; i < 600; i++) stepFraming(rig, 1 / 60);
    expect(rig.framing).toBe(false);
    expect(isAtHome(rig)).toBe(true);
    positionOf(rig.view).forEach((x, i) => expect(x).toBeCloseTo(next.position[i], 3));
  });

  it('Reset view restores the preset after orbit, zoom and pan', () => {
    const rig = createCameraRig(preset);
    orbit(rig, 300, 120);
    pinch(rig, 2);
    pan(rig, 80, -60, 400);
    expect(isAtHome(rig)).toBe(false);
    resetView(rig); // eased
    expect(rig.touched).toBe(false);
    for (let i = 0; i < 600; i++) stepFraming(rig, 1 / 60);
    expect(isAtHome(rig)).toBe(true);
    orbit(rig, 50, 50);
    resetView(rig, true); // instant
    expect(isAtHome(rig)).toBe(true);
  });

  it('keeps the model findable: pitch, zoom and pan are limited', () => {
    const rig = createCameraRig(preset);
    orbit(rig, 0, 100000);
    expect(rig.view.pitch).toBe(PITCH_MAX);
    orbit(rig, 0, -200000);
    expect(rig.view.pitch).toBe(PITCH_MIN);
    pinch(rig, 1000);
    expect(rig.view.zoom).toBeCloseTo(preset.zoom * ZOOM_MAX_FACTOR, 9);
    pinch(rig, 1e-6);
    expect(rig.view.zoom).toBeCloseTo(preset.zoom * ZOOM_MIN_FACTOR, 9);
    for (let i = 0; i < 50; i++) pan(rig, 5000, 5000, 400);
    const off = Math.hypot(rig.view.target[0] - rig.home.target[0], rig.view.target[1] - rig.home.target[1], rig.view.target[2] - rig.home.target[2]);
    expect(off).toBeLessThanOrEqual(PAN_LIMIT + 1e-9);
  });
});

describe('the animation never touches the camera', () => {
  it('playing, seeking and replaying the loop leaves the camera state exactly as it was', () => {
    const rig = createCameraRig(preset);
    orbit(rig, 30, 10);
    const frozen = JSON.stringify(rig);
    const control: AnimControl = { playing: true, speed: 1, seek: null, t: 0 };
    for (const m of MOVEMENTS) {
      for (let i = 0; i < 700; i++) {
        const t = stepClock(control, 1 / 60, m.loopSeconds);
        armTransforms(poseAt(m, t));
      }
      replay(control);
      stepClock(control, 1 / 60, m.loopSeconds);
    }
    expect(JSON.stringify(rig)).toBe(frozen);
  });

  it('the animation frame code in SegmentedBody does not mention the camera', () => {
    const body = src('components/body3d/SegmentedBody.tsx');
    const a = body.indexOf('// ---- animation');
    const b = body.indexOf('// ---- emphasis');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(body.slice(a, b).replace(/\/\/.*$/gm, '')).not.toMatch(/camera/i);
    const clock = src('movement/animationStep.ts').replace(/\/\/.*$/gm, '');
    expect(clock).not.toMatch(/camera/i);
  });

  it('the three.js camera is moved only by CameraDriver (state -> camera)', () => {
    const body = src('components/body3d/SegmentedBody.tsx');
    const lines = body.split('\n');
    const moves = lines.map((l, i) => (/camera\.position\.set|camera\.lookAt/.test(l) ? i : -1)).filter((i) => i >= 0);
    expect(moves).toHaveLength(2);
    const driver = lines.findIndex((l) => l.includes('function CameraDriver'));
    const scene = lines.findIndex((l) => l.includes('function Scene'));
    for (const i of moves) {
      expect(i).toBeGreaterThan(driver);
      expect(i).toBeLessThan(scene);
    }
  });
});

describe('movement view = picker view (same viewer setup)', () => {
  it('the base material is opaque, writes depth, and is made by the same factory as the pack', () => {
    const m = createBodyMaterial();
    expect(m.transparent).toBe(false);
    expect(m.opacity).toBe(1);
    expect(m.depthWrite).toBe(true);
    expect(m.vertexColors).toBe(true);
    expect(BODY_MATERIAL_PARAMS.roughness).toBe(0.55);
    expect(src('screens/model3d/loadPack.ts')).toContain('createBodyMaterial()');
    expect(src('components/body3d/segmentBuild.ts')).toContain('createBodyMaterial()');
  });

  it('both viewers use the same field of view and lights, and the movement view has no dimming material', () => {
    expect(src('components/body3d/Body3D.tsx')).toContain('VIEWER_FOV');
    expect(src('components/body3d/Body3D.tsx')).toContain('<StudioLights />');
    expect(src('components/body3d/SegmentedBody.tsx')).toContain('VIEWER_FOV');
    expect(src('components/body3d/SegmentedBody.tsx')).toContain('KEY_LIGHT');
    const body = src('components/body3d/SegmentedBody.tsx');
    expect(body).not.toMatch(/opacity:\s*0\.\d/);
    expect(body).not.toMatch(/dimmed|dimOthers/);
    expect(VIEWER_FOV).toBe(45);
  });

  /** A tiny pack: two parts (superficial and deep muscle) with real mesh names, so the split and the tags are real. */
  function fakePack() {
    const names = (id: string) => REGION_MAP.structures[id].meshNames;
    const mk = (layer: 'superficial' | 'deep', ids: string[]) => {
      const nm = ids.flatMap(names);
      const g = new THREE.BufferGeometry();
      const verts = nm.length * 3;
      g.setAttribute('position', new THREE.BufferAttribute(new Int16Array(verts * 3), 3, true));
      g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(verts * 3), 3, true));
      g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(verts * 3), 3, true));
      const idx = new Uint32Array(nm.length * 3).map((_, i) => i);
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      return {
        mesh: new THREE.Mesh(g, createBodyMaterial()),
        layer,
        region: 'shoulder',
        names: nm,
        vStart: Int32Array.from(nm, (_, i) => i * 3),
        vCount: Int32Array.from(nm, () => 3),
        triStart: Int32Array.from(nm, (_, i) => i),
        triCount: Int32Array.from(nm, () => 1),
        bounds: new Float32Array(0),
        positions: new Int16Array(0),
        indices: idx,
        originalColors: new Uint8Array(0),
      };
    };
    return { parts: [mk('superficial', ['acromial_part_of_deltoid_muscle_right', 'teres_minor_muscle_right']), mk('deep', ['supraspinatus_muscle_right'])] } as never;
  }

  it('tracked structures get their own material; everything else shares the unchanged base material', () => {
    const built = buildSegments(fakePack(), 'muscle', new Set(['supraspinatus_muscle_right']));
    expect([...built.materials.keys()]).toEqual(['supraspinatus_muscle_right']);
    const own = built.materials.get('supraspinatus_muscle_right');
    const bases = new Set<THREE.Material>();
    for (const g of Object.values(built.groups)) for (const mesh of g.children as THREE.Mesh[]) if (mesh.material !== own) bases.add(mesh.material as THREE.Material);
    expect(bases.size).toBe(1);
    const base = [...bases][0] as THREE.MeshStandardMaterial;
    expect(base.transparent).toBe(false);
    expect(base.opacity).toBe(1);
    expect(base.depthWrite).toBe(true);
    built.dispose();
  });

  it('tint and ghost change only the tracked material; at 0 it looks exactly like the picker', () => {
    const m = createBodyMaterial();
    fadeMaterial(m, 0, 0);
    expect(m.opacity).toBe(1);
    expect(m.transparent).toBe(false);
    expect(m.depthWrite).toBe(true);
    expect(m.color.getHex()).toBe(0xffffff);
    fadeMaterial(m, 1, 0);
    expect(m.opacity).toBe(1); // a tint never makes anything transparent
    expect(m.color.getHex()).not.toBe(0xffffff);
    fadeMaterial(m, 0, 1);
    expect(m.opacity).toBeCloseTo(GHOST_OPACITY, 9);
    expect(m.transparent).toBe(true);
    fadeMaterial(m, 0, 0);
    expect(m.opacity).toBe(1);
    expect(m.transparent).toBe(false);
  });
});

describe('deep candidate: overlying muscles are ghosted, nothing else changes', () => {
  const deep = new Set(['supraspinatus_muscle_right', 'subscapular_muscle_right', 'infraspinatus_muscle_right']);
  const isDeep = (id: string) => deep.has(id);

  it('a deep candidate is tinted and the superficial muscles over it are ghosted', () => {
    const e = planEmphasis(['supraspinatus_muscle_right'], isDeep);
    expect(e.tint).toEqual({ supraspinatus_muscle_right: 1 });
    const ghosts = Object.keys(e.ghost);
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts).not.toContain('supraspinatus_muscle_right');
    for (const g of ghosts) {
      expect(REGION_MAP.structures[g].side).toBe('right');
      expect(REGION_MAP.structures[g].kind).toBe('muscle');
      expect(isDeep(g)).toBe(false);
    }
    expect(overlyingOf('supraspinatus_muscle_right', isDeep)).toEqual(ghosts);
  });

  it('a superficial candidate ghosts nothing', () => {
    const e = planEmphasis(['acromial_part_of_deltoid_muscle_right'], isDeep);
    expect(e.ghost).toEqual({});
    expect(e.tint).toEqual({ acromial_part_of_deltoid_muscle_right: 1 });
  });

  it('a candidate is never ghosted, even when it lies over another candidate', () => {
    const e = planEmphasis(['supraspinatus_muscle_right', 'acromial_part_of_deltoid_muscle_right'], isDeep);
    expect(e.ghost['acromial_part_of_deltoid_muscle_right']).toBeUndefined();
    expect(e.tint['acromial_part_of_deltoid_muscle_right']).toBe(1);
  });

  it('ghosting is a property of single materials: the ghost opacity is below 1 and the base stays 1', () => {
    expect(GHOST_OPACITY).toBeGreaterThan(0);
    expect(GHOST_OPACITY).toBeLessThan(1);
    expect(BODY_MATERIAL_PARAMS.opacity).toBe(1);
  });
});
