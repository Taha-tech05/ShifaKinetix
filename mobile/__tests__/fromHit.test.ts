import { shoulderRegionFromHit } from '../src/regions/fromHit';
import { SHOULDER_REGIONS } from '../src/regions/shoulder';

const base = { packRegion: 'shoulder', meshName: 'Supraspinatus_musclel_Generated_Mesh_From_X3D170', x: 0.1, yaw: 0, pitch: 0 };

describe('shoulderRegionFromHit', () => {
  it('always returns an id from the plain list', () => {
    const ids = SHOULDER_REGIONS.map((r) => r.regionId);
    for (const yaw of [0, 1, 2, 3, -2]) {
      for (const pitch of [0, 1.1]) {
        for (const meshName of ['A_musclel_Plane1', 'A_muscler_Plane1', 'Unsided']) {
          const id = shoulderRegionFromHit({ ...base, meshName, yaw, pitch });
          expect(ids).toContain(id);
        }
      }
    }
  });

  it('takes the side from the mesh name suffix', () => {
    expect(shoulderRegionFromHit({ ...base, meshName: 'Deltoid_musclel_Plane1', x: -0.2 })).toBe('shoulder_left_front');
    expect(shoulderRegionFromHit({ ...base, meshName: 'Deltoid_muscler_Plane1', x: 0.2 })).toBe('shoulder_right_front');
  });

  it('falls back to the sign of x when the name has no side', () => {
    expect(shoulderRegionFromHit({ ...base, meshName: 'Unsided', x: 0.2 })).toBe('shoulder_left_front');
    expect(shoulderRegionFromHit({ ...base, meshName: 'Unsided', x: -0.2 })).toBe('shoulder_right_front');
  });

  it('uses the turn of the model for front and back, and the tilt for top', () => {
    expect(shoulderRegionFromHit({ ...base, yaw: Math.PI })).toBe('shoulder_left_back');
    expect(shoulderRegionFromHit({ ...base, yaw: 2 * Math.PI })).toBe('shoulder_left_front');
    expect(shoulderRegionFromHit({ ...base, pitch: 1.1 })).toBe('shoulder_left_top');
  });

  it('ignores taps outside the shoulder area', () => {
    expect(shoulderRegionFromHit({ ...base, packRegion: 'ankle_foot' })).toBeNull();
    expect(shoulderRegionFromHit({ ...base, packRegion: 'thigh_quad_hamstring' })).toBeNull();
  });
});
