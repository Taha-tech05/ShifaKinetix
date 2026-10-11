import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * True while the screen is in front. A screen further back in the stack stays mounted, and a 3D canvas keeps its graphics
 * memory and its highlight colours. Screens render their 3D view only while focused, so only one pack copy is on the GPU.
 */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
