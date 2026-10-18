import { boxFocusView, createCameraRig, FOCUS_PADDING, FOCUS_ZOOM_MAX, FOCUS_ZOOM_MIN, orbit, pan, PAN_LIMIT, pinch, positionOf, refocus, resetView, setPreset, startFocus, stepFocus, unionBox, ZOOM_MAX_FACTOR, ZOOM_MIN_FACTOR } from '../src/components/body3d/cameraRig';
import type { CameraPreset } from '../src/components/body3d/cameraRig';
import { planFocus } from '../src/components/body3d/focusPlan';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');
const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

type V3 = [number, number, number];
const preset: CameraPreset = { position: [-0.832, 1.428, 1.732], target: [-0.2, 1.28, 0], fov: 45, zoom: 1 };
// boxes in model space (metres): the infraspinatus is behind the body, the pectoral in front, the deltoid at the side
const infraspinatus = { min: [-0.2, 1.25, -0.12] as V3, max: [-0.1, 1.38, -0.08] as V3 };
const pectoral = { min: [-0.15, 1.2, 0.08] as V3, max: [-0.02, 1.35, 0.13] as V3 };
const deltoid = { min: [-0.3, 1.28, -0.04] as V3, max: [-0.2, 1.4, 0.04] as V3 };

describe('auto-focus: where the camera goes', () => {
  it('a muscle behind the middle of the body is seen from behind, in front from the front, at the side from that side', () => {
    const back = positionOf(boxFocusView(infraspinatus, 'right', 45, 1));
    const front = positionOf(boxFocusView(pectoral, 'right', 45, 1));
    const side = positionOf(boxFocusView(deltoid, 'right', 45, 1));
    expect(back[2]).toBeLessThan(infraspinatus.min[2]); // behind it
    expect(front[2]).toBeGreaterThan(pectoral.max[2]); // in front of it
    expect(side[0]).toBeLessThan(deltoid.min[0]); // on the right side (-x) of it
    expect(Math.abs(side[2])).toBeLessThan(Math.abs(side[0]));
  });

  it('the left side mirrors the view', () => {
    const r = boxFocusView(deltoid, 'right', 45, 1);
    const mirrored = { min: [-deltoid.max[0], deltoid.min[1], deltoid.min[2]] as V3, max: [-deltoid.min[0], deltoid.max[1], deltoid.max[2]] as V3 };
    const l = boxFocusView(mirrored, 'left', 45, 1);
    expect(l.yaw).toBeCloseTo(-r.yaw, 6);
    expect(l.target[0]).toBeCloseTo(-r.target[0], 9);
  });

  it('frames the box with padding: a small muscle zooms in, a large cluster zooms out, always within the zoom limits', () => {
    const small = boxFocusView(infraspinatus, 'right', 45, 1);
    const cluster = boxFocusView(unionBox([infraspinatus, pectoral, deltoid])!, 'right', 45, 1);
    expect(small.zoom).toBeGreaterThan(cluster.zoom);
    for (const v of [small, cluster]) {
      expect(v.zoom).toBeGreaterThanOrEqual(FOCUS_ZOOM_MIN);
      expect(v.zoom).toBeLessThanOrEqual(FOCUS_ZOOM_MAX);
    }
    // the muscle (half its diagonal) fits inside the frame with the padding
    const radius = Math.hypot(...[0, 1, 2].map((a) => infraspinatus.max[a] - infraspinatus.min[a])) / 2;
    const visible = (small.distance * Math.tan((45 * Math.PI) / 360)) / small.zoom;
    expect(visible).toBeGreaterThanOrEqual(radius * FOCUS_PADDING * 0.999);
  });

  it('the union of several candidates covers all of them', () => {
    const u = unionBox([infraspinatus, pectoral, deltoid])!;
    expect(u.min[0]).toBe(-0.3);
    expect(u.max[2]).toBe(0.13);
    expect(unionBox([])).toBeNull();
  });
});

describe('auto-focus: animation and the user', () => {
  it('eases to the target in about 0.7 s and ends exactly on it', () => {
    const rig = createCameraRig(preset);
    const to = boxFocusView(infraspinatus, 'right', 45, 1);
    startFocus(rig, to);
    expect(rig.focus).not.toBeNull();
    stepFocus(rig, 0.35);
    expect(rig.view.zoom).not.toBe(to.zoom); // half way
    for (let i = 0; i < 60; i++) stepFocus(rig, 1 / 60);
    expect(rig.focus).toBeNull();
    expect(rig.view.target).toEqual(to.target);
    expect(rig.view.zoom).toBeCloseTo(to.zoom, 9);
  });

  it('a touch cancels the running focus at once and the person keeps what they set', () => {
    const rig = createCameraRig(preset);
    startFocus(rig, boxFocusView(infraspinatus, 'right', 45, 1));
    stepFocus(rig, 0.2);
    orbit(rig, 25, 5);
    expect(rig.focus).toBeNull();
    const kept = JSON.stringify(rig.view);
    for (let i = 0; i < 120; i++) stepFocus(rig, 1 / 60);
    expect(JSON.stringify(rig.view)).toBe(kept);
    // pinch and pan cancel it too
    startFocus(rig, boxFocusView(pectoral, 'right', 45, 1));
    pinch(rig, 1.2);
    expect(rig.focus).toBeNull();
    startFocus(rig, boxFocusView(pectoral, 'right', 45, 1));
    pan(rig, 10, 10, 400);
    expect(rig.focus).toBeNull();
  });

  it('the next change of candidates focuses again, after a touch', () => {
    const rig = createCameraRig(preset);
    startFocus(rig, boxFocusView(infraspinatus, 'right', 45, 1));
    orbit(rig, 25, 5);
    startFocus(rig, boxFocusView(deltoid, 'right', 45, 1));
    expect(rig.focus).not.toBeNull();
    expect(rig.touched).toBe(false);
  });

  it('reduce motion: the camera jumps, no animation', () => {
    const rig = createCameraRig(preset);
    const to = boxFocusView(infraspinatus, 'right', 45, 1);
    startFocus(rig, to, 0.7, true);
    expect(rig.focus).toBeNull();
    expect(rig.view.target).toEqual(to.target);
    expect(rig.view.zoom).toBeCloseTo(to.zoom, 9);
  });

  it('Re-focus runs the last focus again; Reset view goes back to the preset', () => {
    const rig = createCameraRig(preset);
    expect(refocus(rig)).toBe(false);
    const to = boxFocusView(infraspinatus, 'right', 45, 1);
    startFocus(rig, to, 0);
    orbit(rig, 200, 40);
    expect(refocus(rig, 0)).toBe(true);
    expect(rig.view.yaw).toBeCloseTo(to.yaw, 9);
    resetView(rig, true);
    expect(rig.view.target).toEqual(preset.target);
  });

  it('the model cannot be lost: zoom and pan stay limited around the focus', () => {
    const rig = createCameraRig(preset);
    const to = boxFocusView(infraspinatus, 'right', 45, 1);
    startFocus(rig, to, 0);
    for (let i = 0; i < 40; i++) pan(rig, 4000, -4000, 400);
    const d = Math.hypot(...[0, 1, 2].map((a) => rig.view.target[a] - to.target[a]));
    expect(d).toBeLessThanOrEqual(PAN_LIMIT + 1e-9);
    pinch(rig, 1e6);
    expect(rig.view.zoom).toBeLessThanOrEqual(rig.home.zoom * ZOOM_MAX_FACTOR + 1e-9);
    pinch(rig, 1e-9);
    expect(rig.view.zoom).toBeGreaterThanOrEqual(rig.home.zoom * ZOOM_MIN_FACTOR - 1e-9);
  });

  it('a new movement preset takes the camera back from a running focus', () => {
    const rig = createCameraRig(preset);
    startFocus(rig, boxFocusView(infraspinatus, 'right', 45, 1));
    setPreset(rig, { ...preset, position: [0, 1.4, 1.8] });
    expect(rig.focus).toBeNull();
  });
});

describe('auto-focus: when it triggers', () => {
  it('only when the highlighted candidates changed since the last focus', () => {
    let last = '';
    const run = (ids: string[]) => {
      const p = planFocus(last, ids);
      if (p.run) last = p.key;
      return p.run;
    };
    expect(run(['a', 'b'])).toBe(true);
    expect(run(['a', 'b'])).toBe(false); // same set, no move
    expect(run(['a'])).toBe(true);
    expect(run([])).toBe(false); // nothing to frame
    expect(planFocus('', undefined).run).toBe(false);
  });

  it('the stage uses it, respects reduce motion, and offers Re-focus and Reset view; the movement demo presets are not affected', () => {
    const stage = src('components/movement/MovementStage.tsx');
    expect(stage).toContain('planFocus(');
    expect(stage).toContain('isReduceMotionEnabled');
    expect(stage).toContain("t('movement.refocus')");
    expect(stage).toContain("t('movement.resetView')");
    expect(stage).toContain('if (!autoFocus');
    const screen = src('app/report/movement.tsx');
    // the route publishes autoFocus for the shared stage, and report/_layout's scene host passes it on
    expect(screen).toContain('autoFocus: !onMovement');
    expect(src('ui/SceneHost.tsx')).toContain('autoFocus={stage.autoFocus}');
  });
});
