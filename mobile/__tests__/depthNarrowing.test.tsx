import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { BodyPicker } from '../src/components/BodyPicker';
import { ChooseOne } from '../src/components/questions/ChooseOne';
import { DEPTH_QUESTION_ID, depthAnswerFrom, depthQuestion } from '../src/dev/followUpQuestions';
import { narrow } from '../src/dev/narrowingStub';
import type { QuestionResult } from '../src/questions/types';
import type { BodySelection } from '../src/regions/types';
import { narrowingInputFrom, useSession } from '../src/store/session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const selection: BodySelection = {
  regionId: 'shoulder_right',
  subRegionId: 'top',
  point: { x: -0.17, y: 1.4, z: -0.03 },
  hitStructure: { meshName: 'Trapezius_muscler_Plane1', name: 'Trapezius Muscle', kind: 'muscle' },
  layer: 'muscle',
};

function press(tree: ReturnType<typeof create>, label: string) {
  const el = tree.root.findAll(
    (n: ReactTestInstance) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label,
  )[0];
  if (!el) throw new Error(`no button "${label}"`);
  act(() => {
    el.props.onPress();
  });
}

beforeEach(() => useSession.getState().reset());

describe('depth question (placeholder)', () => {
  it('is the fixed question with the two options and is labelled as a placeholder', () => {
    const q = depthQuestion();
    expect(q.text).toBe('Does it feel just under the skin, deep inside, or are you not sure?');
    expect(q.options!.map((o: { label: string }) => o.label)).toEqual(['Just under the skin', 'Deep inside']);
    expect(q.source).toMatch(/PLACEHOLDER/);
  });

  it('Not sure is stored as state unknown with a null value, never as another answer', () => {
    let got: QuestionResult | undefined;
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ChooseOne question={depthQuestion()} onAnswer={(r) => (got = r)} />);
    });
    press(tree, 'Not sure');
    expect(got).toMatchObject({ questionId: DEPTH_QUESTION_ID, state: 'unknown', value: null });

    useSession.getState().recordAnswer(got!);
    const stored = useSession.getState().answers.find((a) => a.questionId === DEPTH_QUESTION_ID);
    expect(stored).toMatchObject({ state: 'unknown', value: null });
    expect(depthAnswerFrom(useSession.getState().answers)).toEqual({ state: 'unknown', value: null });
  });

  it('an option is stored as an answered value', () => {
    let got: QuestionResult | undefined;
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ChooseOne question={depthQuestion()} onAnswer={(r) => (got = r)} />);
    });
    press(tree, 'Deep inside');
    expect(got).toMatchObject({ state: 'answered', value: 'deep_inside' });
  });

  it('an unrecognised stored value does not turn into a known answer', () => {
    expect(depthAnswerFrom([{ questionId: DEPTH_QUESTION_ID, type: 'chooseone', value: 'whatever', state: 'answered' }])).toEqual({ state: 'unknown', value: null });
  });

  it('is null before the question is asked', () => {
    expect(depthAnswerFrom([])).toBeNull();
  });
});

describe('narrowing input', () => {
  it('is null until a spot is chosen', () => {
    expect(narrowingInputFrom(useSession.getState())).toBeNull();
  });

  it('carries layer, sub-region, point, depth answer and movement results', () => {
    const s = useSession.getState();
    s.setSelection(selection);
    s.recordAnswer({ questionId: DEPTH_QUESTION_ID, type: 'chooseone', value: null, state: 'unknown' });
    const move = { movementId: 'M1', painful: true, weak: false, unableToDo: false, measuredAngle: null, state: 'done' };
    s.recordMovement(move);
    const input = narrowingInputFrom(useSession.getState())!;
    expect(input).toEqual({
      layer: 'muscle',
      regionId: 'shoulder_right',
      subRegionId: 'top',
      point: selection.point,
      hitMeshName: 'Trapezius_muscler_Plane1',
      depthAnswer: { state: 'unknown', value: null },
      movementResults: [move],
    });
  });

  it('the stub keeps the output shape', () => {
    const out = narrow(narrowingInputFrom({ selection, answers: [], movementResults: [] })!);
    expect(Array.isArray(out.candidates)).toBe(true);
    expect(typeof out.cluster).toBe('boolean');
  });
});

describe('onSelect always returns a layer', () => {
  it('the figure and list fallback return one, with no hit structure', () => {
    for (const layer of [undefined, 'muscle', 'bone'] as const) {
      const got: BodySelection[] = [];
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<BodyPicker layer={layer} onSelect={(s) => got.push(s)} />);
      });
      press(tree, 'Right shoulder');
      expect(got).toHaveLength(1);
      expect(got[0].layer).toBe(layer ?? 'muscle');
      expect(got[0]).toMatchObject({ regionId: 'shoulder_right', subRegionId: 'front', hitStructure: null });
      expect(typeof got[0].point.x).toBe('number');
    }
  });
});
