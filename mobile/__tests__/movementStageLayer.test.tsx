import { act, create } from 'react-test-renderer';
import { MovementStage } from '../src/components/movement/MovementStage';
import { MOVEMENTS } from '../src/movement/movements';
import { REGION_MAP } from '../src/regions/regionMap';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => ({ ...jest.requireActual('../__tests__/support/react-native'), ActivityIndicator: () => null }));
jest.mock('../src/components/body3d/usePack', () => ({ usePack: () => ({ status: 'ready', pack: {} }) }));
jest.mock('../src/components/body3d/useScreenFocused', () => ({ useScreenFocused: () => true }));
jest.mock('../src/components/body3d/Boundary', () => ({ Boundary: (p: { children?: unknown }) => p.children }));
jest.mock('../src/components/body3d/packLayers', () => ({
  deepStructureIds: () => new Set<string>(),
  structureAnchors: () => ({}),
  structureBounds: () => null,
}));
jest.mock('../src/components/body3d/SegmentedBody', () => ({ SegmentedBody: (p: Record<string, unknown>) => require('react').createElement('SegmentedBody', p) }));

const ids = Object.entries(REGION_MAP.structures).map(([id, s]) => ({ id, kind: (s as { kind: string }).kind }));
const bones = ids.filter((s) => s.kind === 'bone').slice(0, 2).map((s) => s.id);
const muscles = ids.filter((s) => s.kind !== 'bone').slice(0, 2).map((s) => s.id);

const layerOnFirstRender = (highlightIds?: string[]) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<MovementStage movement={MOVEMENTS[0]} highlightIds={highlightIds} />);
  });
  return tree.root.findByType('SegmentedBody' as never).props.layer;
};

describe('MovementStage initial layer', () => {
  it('starts in the bone layer when the first highlights are all bones', () => {
    expect(bones.length).toBeGreaterThan(0);
    expect(layerOnFirstRender(bones)).toBe('bone');
  });

  it('starts in the muscle layer for muscles, mixed ids, no highlights and an empty list', () => {
    expect(layerOnFirstRender(muscles)).toBe('muscle');
    expect(layerOnFirstRender([...bones, ...muscles])).toBe('muscle');
    expect(layerOnFirstRender(undefined)).toBe('muscle');
    expect(layerOnFirstRender([])).toBe('muscle');
  });
});
