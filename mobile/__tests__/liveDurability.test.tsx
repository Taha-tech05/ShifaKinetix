// The live flow saves before it narrows. Real gate, adapter, session store, SafeGuard and live driver; only the saved intake
// (openSafetySession) is replaced, so the tests control when the save finishes and whether it fails.
import { act, create } from 'react-test-renderer';
import { createElement } from 'react';
import type { ComponentType } from 'react';
import { evaluate, questions, SafetyAnswer } from '../src/gate/evaluate';
import { openSafetySession } from '../src/gate/safetySession';
import { goBackDurable, PERSIST_FAILED_ROUTE, submitMovementDurable, submitQuestionDurable } from '../src/flow/live';
import { setLanguage } from '../src/i18n';
import { narrow } from '../src/dev/narrowingStub';
import { useSession } from '../src/store/session';
import LiveScreen from '../src/app/report/movement';
import Result from '../src/app/report/result';

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
const negatives = (): SafetyAnswer[] =>
  questions
    .filter((q) => q.required)
    .map((q) => ({ questionId: q.questionId, type: q.type as SafetyAnswer['type'], value: q.type === 'choice' ? 'normal' : false, state: 'answered' }));
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

  it('a movement: a new inability still stops the flow, after the save', async () => {
    seed();
    const cp = pendingCheckpoint();
    const promise = submitMovementDurable({ movementId: 'sideways_raise', painful: false, weak: false, unableToDo: true, measuredAngle: null, state: 'done' }, 'unable');
    await flush();
    expect(narrowSpy).not.toHaveBeenCalled();
    cp.finish();
    const out = await promise;
    expect(out.verdict).toBe('RED_FLAG');
    expect(out.route).toBe('/report/urgent');
    expect(out.state).toBeNull();
    expect(useSession.getState().narrowingTrail).toEqual([]);
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
