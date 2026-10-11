// The animation clock. It advances the loop fraction and returns nothing but time: it has no access to the camera.
// (Camera state lives in components/body3d/cameraRig.ts and is changed only by the user's touch and by "Reset view".)

/** Playback state, changed by the screen and read every frame. */
export interface AnimControl {
  playing: boolean;
  /** 0.25, 0.5 or 1 for the dev screen; 1 for patients. */
  speed: number;
  /** Set to a loop fraction (0 to 1) to jump there (scrubbing or replay); the scene clears it. */
  seek: number | null;
  /** Current loop fraction, written by the scene. */
  t: number;
}

/** Advance the loop by dt seconds. Returns the new loop fraction (0 to 1). */
export function stepClock(c: AnimControl, dt: number, loopSeconds: number): number {
  if (c.seek !== null) {
    c.t = c.seek;
    c.seek = null;
  } else if (c.playing) {
    c.t = (c.t + (dt * c.speed) / loopSeconds) % 1;
  }
  return c.t;
}

/** Jump to the start and play (the "Replay" button). */
export function replay(c: AnimControl): void {
  c.seek = 0;
  c.playing = true;
}
