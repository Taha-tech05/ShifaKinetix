// The live flow saves before it narrows. Real gate, adapter, session store, SafeGuard and live driver; only the saved intake
// (openSafetySession) is replaced, so the tests control when the save finishes and whether it fails.
import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
import type { ComponentType } from 'react';
import { evaluate, SafetyAnswer } from '../src/gate/evaluate';
import { openSafetySession } from '../src/gate/safetySession';
import { goBackDurable, PERSIST_FAILED_ROUTE, submitMovementDurable, submitQuestionDurable } from '../src/flow/live';
import { setLanguage } from '../src/i18n';
import { narrow } from '../src/dev/narrowingStub';
import { useSession } from '../src/store/session';
import LiveScreen from '../src/app/report/movement';
import Result from '../src/app/report/result';
import { router } from 'expo-router';
import { lowRiskAnswers } from './support/safetyAnswers';

jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), openSafetySession: jest.fn() }));
jest.mock('../src/components/movement/MovementStage', () => ({ MovementStage: () => null }));
jest.mock('../src/components/Screen', () => ({
  Screen: (props: { banner?: unknown; children?: unknown; footer?: unknown }) => require('react').createElement('Screen', {}, props.banner, props.children, props.footer),
}));
jest.mock('../src/dev/narrowingStub', () => {
  const actual = jest.requireActual('../src/dev/narrowingStub');
  return { ...actual, narrow: jest.fn(actual.narrow) };
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const narrowSpy = narrow as unknown as jest.Mock;
const open = jest.mocked(openSafetySession);
const negatives = (): SafetyAnswer[] => lowRiskAnswers();
const selection = { regionId: 'shoulder_right', subRegionId: 'front' as const, point: { x: 0, y: 1, z: 0 }, layer: 'muscle' as const, hitStructure: null };
const no = (id: string) => ({ questionId: id, type: 'yesno', value: false, state: 'answered' as const });

function seed() {
  useSession.getState().setMode('region');
  useSession.getState().setSelection(selection);
  for (const a of negatives()) useSession.getState().recordAnswer(a);
  useSession.getState().runGate();
}

/** A checkpoint the test finishes (or fails) by hand. */
function pendingCheckpoint() {
  let done!: () => void;
  let fail!: (e: Error) => void;
  const checkpoint = jest.fn(
    () =>
      new Promise((resolve, reject) => {
        done = () => resolve(useSession.getState().gateOutput ?? evaluate(negatives()));
        fail = reject;
      }),
  );
  open.mockResolvedValue({ checkpoint } as unknown as Awaited<ReturnType<typeof openSafetySession>>);
  return { checkpoint, finish: () => done(), fail: (e = new Error('disk full')) => fail(e) };
}
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  setLanguage('en');
  useSession.getState().reset();
  jest.clearAllMocks();
});

describe('answers are saved before the gate and the narrowing run', () => {
  it('a question answer: nothing is narrowed until the checkpoint has finished, then the narrowing runs', async () => {
    seed();
    const cp = pendingCheckpoint();
    const promise = submitQuestionDurable(no('Q_ST_BONE_POINT') as never);
    await flush();
    expect(cp.checkpoint).toHaveBeenCalledTimes(1);
    expect(narrowSpy).not.toHaveBeenCalled();
    expect(useSession.getState().narrowingTrail).toEqual([]);
    // the answer is stored before the save, so it is part of what is saved
    expect(useSession.getState().answers.some((a) => a.questionId === 'Q_ST_BONE_POINT')).toBe(true);
    cp.finish();
    const out = await promise;
    expect(out.persistFailed).toBeUndefined();
    expect(out.verdict).toBe('SAFE');
    expect(out.state).not.toBeNull();
    expect(useSession.getState().narrowingTrail).toHaveLength(1);
  });

  it('a movement: one failed movement does not interrupt the movement set (contract v2), after the save', async () => {
    seed();
    const cp = pendingCheckpoint();
    const promise = submitMovementDurable({ movementId: 'sideways_raise', painful: false, weak: false, unableToDo: true, measuredAngle: null, state: 'done' }, 'unable');
    await flush();
    expect(narrowSpy).not.toHaveBeenCalled();
    cp.finish();
    const out = await promise;
    expect(out.verdict).toBe('SAFE');
    expect(out.route).toBeNull();
  });

  it('a movement: after the whole set, a failed movement asks one check about moving the arm, after the save', async () => {
    seed();
    const ids = ['sideways_raise', 'forward_raise', 'can_position_hold', 'outward_push_elbow_at_side', 'belly_press'];
    for (const [i, id] of ids.entries()) {
      useSession.getState().recordMovement({ movementId: id, painful: i === 0, weak: i === 1, unableToDo: i === 0, measuredAngle: null, state: 'done' });
    }
    const cp = pendingCheckpoint();
    const promise = submitMovementDurable({ movementId: 'hand_behind_back', painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'done' }, 'no pain');
    await flush();
    cp.finish();
    const out = await promise;
    expect(out.verdict).toBe('CLARIFY');
    expect(useSession.getState().gateOutput?.firedRules.map((r) => r.ruleId)).toEqual(['F_unable']);
    expect(out.route).toBe('/report/reask');
    expect(out.state).toBeNull();
  });

  it('back: the rewound answers are saved before the narrowing is recomputed', async () => {
    seed();
    const first = pendingCheckpoint();
    const answered = submitQuestionDurable(no('Q_ST_BONE_POINT') as never);
    await flush();
    first.finish();
    await answered;
    narrowSpy.mockClear();
    const cp = pendingCheckpoint();
    const back = goBackDurable();
    await flush();
    expect(cp.checkpoint).toHaveBeenCalledTimes(1);
    expect(narrowSpy).not.toHaveBeenCalled();
    cp.finish();
    const r = await back;
    expect(r.ok).toBe(true);
    expect(r.undone?.id).toBe('Q_ST_BONE_POINT');
    expect(narrowSpy).toHaveBeenCalled();
  });
});

describe('when the answer cannot be saved the flow stops and nothing is narrowed', () => {
  it('question, the write fails', async () => {
    seed();
    const cp = pendingCheckpoint();
    const promise = submitQuestionDurable(no('Q_ST_BONE_POINT') as never);
    await flush();
    cp.fail();
    const out = await promise;
    expect(out).toMatchObject({ persistFailed: true, route: PERSIST_FAILED_ROUTE, state: null });
    expect(narrowSpy).not.toHaveBeenCalled();
    expect(useSession.getState().narrowingTrail).toEqual([]);
  });

  it('question, movement and back when the storage cannot be opened', async () => {
    seed();
    open.mockRejectedValue(new Error('storage unavailable'));
    const q = await submitQuestionDurable(no('Q_ST_BONE_POINT') as never);
    expect(q).toMatchObject({ persistFailed: true, route: PERSIST_FAILED_ROUTE, state: null });
    const m = await submitMovementDurable({ movementId: 'sideways_raise', painful: true, weak: false, unableToDo: false, measuredAngle: null, state: 'done' }, 'pain');
    expect(m).toMatchObject({ persistFailed: true, route: PERSIST_FAILED_ROUTE, state: null });
    const b = await goBackDurable();
    expect(b).toMatchObject({ ok: true, route: PERSIST_FAILED_ROUTE, state: null });
    expect(narrowSpy).not.toHaveBeenCalled();
    expect(useSession.getState().narrowingTrail).toEqual([]);
  });

  it('the stop route is the safety check that SafeGuard also uses when saved answers cannot be verified', () => {
    expect(PERSIST_FAILED_ROUTE).toBe('/report/danger');
  });
});

describe('no narrowing before the guard has confirmed the saved SAFE verdict', () => {
  const screens: [string, ComponentType][] = [
    ['the live screen', LiveScreen],
    ['the result screen', Result],
  ];
  it.each(screens)('%s computes nothing while the saved answers are being verified', async (_name, Screen) => {
    seed();
    const cp = pendingCheckpoint();
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(createElement(Screen));
    });
    expect(cp.checkpoint).toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('Verifying saved safety answers');
    expect(narrowSpy).not.toHaveBeenCalled();
    await act(async () => {
      cp.finish();
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain('Verifying saved safety answers');
    expect(narrowSpy).toHaveBeenCalled();
    act(() => tree.unmount());
  });

  it('a failed verification shows no screen content and computes nothing', async () => {
    seed();
    open.mockRejectedValue(new Error('storage unavailable'));
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(createElement(LiveScreen));
    });
    expect(JSON.stringify(tree.toJSON())).toContain('/report/danger');
    expect(narrowSpy).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });
});

describe('real screen and guard during a delayed live save', () => {
  async function mountedScreen() {
    seed();
    let delay: Promise<void> = Promise.resolve();
    let finish!: () => void;
    let fail!: (e: Error) => void;
    open.mockResolvedValue({ checkpoint: async () => {
      await delay;
      useSession.getState().runGate();
      return useSession.getState().gateOutput!;
    } } as never);
    let tree!: ReturnType<typeof create>;
    await act(async () => { tree = create(<LiveScreen />); });
    narrowSpy.mockClear();
    return { tree, hold: () => { delay = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; }); },
      finish: () => finish(), fail: () => fail(new Error('disk full')) };
  }
  async function press(tree: ReturnType<typeof create>, label: string) {
    const button = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
    expect(button).toBeDefined();
    await act(async () => { button.props.onPress(); });
  }
  it('waits without redirecting, then advances after a saved negative movement', async () => {
    const cp = await mountedScreen();
    await press(cp.tree, 'I tried it'); cp.hold();
    await press(cp.tree, 'No pain');
    expect(JSON.stringify(cp.tree.toJSON())).toContain('Saving and verifying');
    expect(JSON.stringify(cp.tree.toJSON())).not.toContain('/report/danger');
    expect(JSON.stringify(cp.tree.toJSON())).not.toContain('Raise your arm forward');
    expect(narrowSpy).not.toHaveBeenCalled();
    await act(async () => { cp.finish(); });
    expect(JSON.stringify(cp.tree.toJSON())).toContain('Raise your arm forward');
    expect(useSession.getState().narrowingTrail).toHaveLength(1);
    act(() => cp.tree.unmount());
  });
  it('a delayed skipped movement waits for the save, then continues without re-asking safety questions (contract v2)', async () => {
    const cp = await mountedScreen(); const replace = jest.spyOn(router, 'replace'); cp.hold();
    await press(cp.tree, 'Skip');
    expect(JSON.stringify(cp.tree.toJSON())).toContain('Saving and verifying');
    expect(narrowSpy).not.toHaveBeenCalled();
    await act(async () => { cp.finish(); });
    expect(useSession.getState().gateVerdict).toBe('SAFE');
    expect(replace).not.toHaveBeenCalledWith('/report/reask');
    expect(JSON.stringify(cp.tree.toJSON())).toContain('Raise your arm forward');
    act(() => cp.tree.unmount()); replace.mockRestore();
  });
  it('a failed live save redirects without narrowing', async () => {
    const cp = await mountedScreen(); cp.hold();
    await press(cp.tree, 'I tried it'); await press(cp.tree, 'No pain');
    await act(async () => { cp.fail(); });
    expect(JSON.stringify(cp.tree.toJSON())).toContain('/report/danger');
    expect(narrowSpy).not.toHaveBeenCalled();
    act(() => cp.tree.unmount());
  });
  it('resetting the session cannot reuse the previous waiting-state clearance', async () => {
    const cp = await mountedScreen();
    act(() => useSession.getState().reset());
    expect(JSON.stringify(cp.tree.toJSON())).toContain('/report/danger');
    act(() => cp.tree.unmount());
  });
});
