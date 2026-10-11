import { evaluateStub } from '../src/gate/stub';
import { useSession } from '../src/store/session';
import type { Answer } from '../src/gate/evaluate';

const yes = (id: string, flagged = false): Answer & { flagged?: boolean } => ({
  questionId: id,
  type: 'yesno',
  value: true,
  state: 'answered',
  ...(flagged ? { flagged } : {}),
});

beforeEach(() => useSession.getState().reset());

describe('session store', () => {
  it('starts empty', () => {
    expect(useSession.getState()).toMatchObject({
      selection: null,
      answers: [],
      gateVerdict: null,
      movementResults: [],
    });
  });

  it('stores the selection: side, sub-region, point, closest structure and layer', () => {
    const selection = {
      regionId: 'shoulder_right',
      subRegionId: 'top' as const,
      point: { x: 1, y: 2, z: 3 },
      hitStructure: { meshName: 'M', name: 'Trapezius', kind: 'muscle' as const },
      layer: 'muscle' as const,
    };
    useSession.getState().setSelection(selection);
    expect(useSession.getState().selection).toEqual(selection);
  });

  it('replaces an earlier answer to the same question', () => {
    const s = useSession.getState();
    s.recordAnswer(yes('Q1'));
    s.recordAnswer({ questionId: 'Q1', type: 'yesno', value: null, state: 'unknown' });
    const { answers } = useSession.getState();
    expect(answers).toHaveLength(1);
    expect(answers[0].state).toBe('unknown');
    expect(answers[0].value).toBeNull();
  });

  it('keeps an unknown answer unknown', () => {
    useSession
      .getState()
      .recordAnswer({ questionId: 'Q1', type: 'yesno', value: null, state: 'unknown' });
    expect(useSession.getState().answers[0]).toEqual({
      questionId: 'Q1',
      type: 'yesno',
      value: null,
      state: 'unknown',
    });
  });

  it('records movement results once per movement', () => {
    const s = useSession.getState();
    const base = { painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'done' };
    s.recordMovement({ movementId: 'M1', ...base });
    s.recordMovement({ movementId: 'M1', ...base, painful: true });
    const { movementResults } = useSession.getState();
    expect(movementResults).toHaveLength(1);
    expect(movementResults[0].painful).toBe(true);
  });

  it('gate verdict is SAFE when no answer is flagged', () => {
    useSession.getState().recordAnswer(yes('Q1'));
    expect(useSession.getState().runGate()).toBe('SAFE');
    expect(useSession.getState().gateVerdict).toBe('SAFE');
  });

  it('gate verdict is RED_FLAG for a flagged yes', () => {
    useSession.getState().recordAnswer(yes('Q_DANGER_A', true));
    expect(useSession.getState().runGate()).toBe('RED_FLAG');
  });

  it('flagged Not sure is never SAFE', () => {
    useSession.getState().recordAnswer({
      questionId: 'Q_DANGER_A',
      type: 'yesno',
      value: null,
      state: 'unknown',
      flagged: true,
    } as Answer);
    expect(useSession.getState().runGate()).toBe('CLARIFY');
  });

  it('reset clears everything', () => {
    const s = useSession.getState();
    s.setSelection({ regionId: 'shoulder_left', subRegionId: 'back', point: { x: 0, y: 0, z: 0 }, hitStructure: null, layer: 'bone' });
    s.recordAnswer(yes('Q1', true));
    s.runGate();
    s.reset();
    expect(useSession.getState().answers).toEqual([]);
    expect(useSession.getState().gateVerdict).toBeNull();
    expect(useSession.getState().selection).toBeNull();
  });
});

describe('gate stub', () => {
  it('returns SAFE with no fired rules when nothing is flagged', () => {
    expect(evaluateStub([yes('Q1')])).toEqual({ verdict: 'SAFE', firedRules: [] });
  });
});
