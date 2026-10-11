// One finger orbits, two fingers pinch and pan. The handler takes the touch for itself and refuses to give it back, so a
// parent ScrollView cannot steal it; the parent is also told (onInteract) so it can switch its scrolling off meanwhile.
import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { orbit, pan, pinch } from './cameraRig';
import type { CameraRig } from './cameraRig';

export function useViewerGestures(rig: React.MutableRefObject<CameraRig>, onInteract?: (active: boolean) => void) {
  const height = useRef(300);
  const last = useRef({ x: 0, y: 0, pinch: 0, mx: 0, my: 0, fingers: 0 });
  const interact = useRef(onInteract);
  interact.current = onInteract;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          last.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, pinch: 0, mx: 0, my: 0, fingers: 1 };
          interact.current?.(true);
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          const l = last.current;
          const ts = e.nativeEvent.touches;
          if (ts.length >= 2) {
            const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
            const mx = (ts[0].pageX + ts[1].pageX) / 2;
            const my = (ts[0].pageY + ts[1].pageY) / 2;
            if (l.fingers >= 2 && l.pinch > 0 && d > 0) {
              pinch(rig.current, d / l.pinch);
              pan(rig.current, mx - l.mx, my - l.my, height.current);
            }
            l.pinch = d;
            l.mx = mx;
            l.my = my;
            l.fingers = 2;
            return;
          }
          if (l.fingers >= 2) {
            // one finger lifted: start the orbit from where the remaining finger is, so the view does not jump
            l.x = e.nativeEvent.pageX;
            l.y = e.nativeEvent.pageY;
            l.fingers = 1;
            l.pinch = 0;
            return;
          }
          orbit(rig.current, e.nativeEvent.pageX - l.x, e.nativeEvent.pageY - l.y);
          l.x = e.nativeEvent.pageX;
          l.y = e.nativeEvent.pageY;
        },
        onPanResponderRelease: () => interact.current?.(false),
        onPanResponderTerminate: () => interact.current?.(false),
      }),
    [rig],
  );

  return { panHandlers: responder.panHandlers, onLayout: (e: LayoutChangeEvent) => (height.current = e.nativeEvent.layout.height) };
}
