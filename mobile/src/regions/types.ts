export type Side = 'right' | 'left';

/** Where on the shoulder the tap landed, relative to the shoulder joint (see subregion.ts). */
export type SubRegionId = 'top' | 'front' | 'back' | 'side';

/** Which layer of the body the viewer shows and picks from. There is no skin layer. */
export type BodyLayer = 'muscle' | 'bone';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * The structure the tapped ray hit first in the visible layer.
 *
 * THIS IS A HINT, NOT A DIAGNOSIS. It is the closest surface structure (muscle layer) or the closest bone
 * (bone layer) under the finger. A deeper structure can be the real source of pain. Anything that narrows
 * down causes must use `subRegionId` and `point`, never `hitStructure` alone.
 */
export interface HitStructure {
  /** Raw mesh name in the model, e.g. "Supraspinatus_musclel_Generated_Mesh_From_X3D170". */
  meshName: string;
  /** Readable English name without the side, e.g. "Supraspinatus Muscle". Not translated. */
  name: string;
  kind: BodyLayer;
}

/** What the body viewer (3D, figure or list) returns through onSelect. */
export interface BodySelection {
  /** Side-level region, "shoulder_right" or "shoulder_left". */
  regionId: string;
  subRegionId: SubRegionId;
  /** Tapped point in model space (metres, body 1.7 high). Approximate when the figure or list was used. */
  point: Point3D;
  /** null when the 3D body was not used (figure or list fallback). */
  hitStructure: HitStructure | null;
  /** Always set: the layer that was active when the selection was made. */
  layer: BodyLayer;
}
