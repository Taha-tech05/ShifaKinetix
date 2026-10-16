import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

/** Flipped to true by useFpsGuard when blur costs frames. Everything glass then uses the solid fallback. */
export const useBlurGuard = create<{ forceSolid: boolean; setForceSolid: (v: boolean) => void }>((set) => ({
  forceSolid: false,
  setForceSolid: (forceSolid) => set({ forceSolid }),
}));

/**
 * True when a real blur may be drawn. iOS only: on Android a blur over the GL view (or a WebView) may not render, and the
 * unblurred translucent fill is the intended look there. Also false once the frame-rate guard has tripped.
 */
export function useBlurAllowed(): boolean {
  const forceSolid = useBlurGuard((s) => s.forceSolid);
  return !forceSolid && Platform.OS === 'ios';
}

/** Watches the frame rate for a few seconds; under 30 fps it switches blur off for good. Mount only on the 3D screen. */
export function useFpsGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let frames = 0;
    let start = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (start === 0) start = now;
      frames++;
      const elapsed = now - start;
      if (elapsed >= 2500) {
        if ((frames * 1000) / elapsed < 30) useBlurGuard.getState().setForceSolid(true);
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
}
