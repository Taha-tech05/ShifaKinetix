import { AMBIENT_INTENSITY, KEY_LIGHT } from './viewerSetup';

/** The lights of the picker. Used as they are by the picker; the movement view keeps the key light on the camera side. */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight position={KEY_LIGHT.position} intensity={KEY_LIGHT.intensity} />
    </>
  );
}
