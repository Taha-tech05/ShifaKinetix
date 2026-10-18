import { act, create } from 'react-test-renderer';
import { evaluate } from '../src/gate/evaluate';
import { evaluateSessionGate } from '../src/gate/sessionAdapter';
import { useSession } from '../src/store/session';
import { liveSteps, submitMovement, submitQuestion } from '../src/flow/live';
import { routeAfterSafe } from '../src/flow/intake';
import { SafeGuard } from '../src/flow/SafeGuard';
import { openSafetySession } from '../src/gate/safetySession';
import { SafetyStopNotice } from '../src/gate/SafetyStopNotice';
import { lowRiskAnswers } from './support/safetyAnswers';

// Only native persistence is replaced here; gate, session, guard and live driver are real. Contract v2.
jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), openSafetySession: jest.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const selection = { regionId: 'shoulder_right', subRegionId: 'front' as const,
  point: { x: 0, y: 1, z: 0 }, layer: 'muscle' as const, hitStructure: null };
const MOVES = ['sideways_raise', 'forward_raise', 'can_position_hold', 'outward_push_elbow_at_side', 'belly_press', 'hand_behind_back'];
const move = (movementId: string, flags: Partial<{ painful: boolean; weak: boolean; unableToDo: boolean; state: string }> = {}) =>
  ({ movementId, painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'done', ...flags });
function seed(changes = {}) {
  useSession.getState().setMode('region'); useSession.getState().setSelection(selection);
  for (const a of lowRiskAnswers(changes)) useSession.getState().recordAnswer(a);
  useSession.getState().runGate();
}
beforeEach(() => { useSession.getState().reset(); jest.clearAllMocks(); });

test('the basics answer that filled the safety answer is not asked again', () => {
  seed();
  const result = submitQuestion({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'slowly', state: 'answered' });
  expect(result.verdict).toBe('SAFE');
  expect(result.state).not.toBeNull();
});

test.each(['after_injury', 'suddenly'])('a changed basics answer (%s) asks one check before narrowing', async (value) => {
  seed();
  const result = submitQuestion({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value, state: 'answered' });
  expect(result.verdict).toBe('CLARIFY');
  expect(useSession.getState().gateOutput?.firedRules.map((r) => r.ruleId)).toEqual(['F_onset']);
  expect(result.state).toBeNull();
  expect(useSession.getState().narrowingTrail).toEqual([]);
  jest.mocked(openSafetySession).mockResolvedValue({ checkpoint: async () => useSession.getState().gateOutput! } as unknown as Awaited<ReturnType<typeof openSafetySession>>);
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<SafetyStopNotice />); });
  expect(JSON.stringify(tree.toJSON())).toContain('uncertainty, not a diagnosis');
  act(() => tree.unmount());
});

test('an empty intake or ordinary app answers cannot grant SAFE', () => {
  expect(useSession.getState().runGate()).toBe('CLARIFY');
  useSession.getState().recordAnswer({ questionId: 'Q_FORK_POINT', type: 'chooseone', value: 'exact', state: 'answered' });
  expect(useSession.getState().runGate()).toBe('CLARIFY');
  expect(evaluate(lowRiskAnswers()).verdict).toBe('SAFE');
});

test('malformed canonical values and unfamiliar danger IDs fail closed', () => {
  expect(evaluateSessionGate([...lowRiskAnswers({}, ['onset']),
    { questionId: 'onset', type: 'chooseone', value: 'gradual', state: 'answered' }]).verdict).toBe('RED_FLAG');
  expect(evaluateSessionGate([...lowRiskAnswers(), { questionId: 'Q_DANGER_NEW', type: 'yesno', value: false, state: 'answered' }]).verdict).toBe('RED_FLAG');
});

test('narrowing questions about numbness and tingling never re-open the safety questions', () => {
  seed();
  for (const value of [true, null]) {
    expect(evaluateSessionGate([...lowRiskAnswers(), { questionId: 'Q_ST_NUMB', type: 'yesno', value, state: value === null ? 'unknown' : 'answered' }]).verdict).toBe('SAFE');
  }
  // and they are not asked: the safety answers give them
  expect(liveSteps('region').some((s) => s.id === 'Q_ST_NUMB' || s.id === 'Q_ST_TINGLE')).toBe(false);
});

test('weak, painful or skipped movements go to narrowing, never back to the safety questions', () => {
  seed();
  expect(submitMovement(move('sideways_raise', { weak: true, painful: true }), 'weak').verdict).toBe('SAFE');
  expect(submitMovement(move('forward_raise', { state: 'unknown' }), 'skip').verdict).toBe('SAFE');
  expect(useSession.getState().narrowingTrail.length).toBe(2);
});

test('a failed movement does not interrupt the set; one check comes after the whole set', () => {
  seed();
  const first = submitMovement(move('sideways_raise', { unableToDo: true }), 'unable');
  expect(first.verdict).toBe('SAFE'); expect(first.route).toBeNull();
  for (const id of MOVES.slice(1, 5)) expect(submitMovement(move(id), 'no pain').verdict).toBe('SAFE');
  const last = submitMovement(move('hand_behind_back'), 'no pain');
  expect(last.verdict).toBe('CLARIFY'); expect(last.route).toBe('/report/reask'); expect(last.state).toBeNull();
  expect(useSession.getState().gateOutput?.firedRules.map((r) => r.ruleId)).toEqual(['F_unable']);
});

test('the SOON care level keeps the questions but skips the movements', () => {
  seed({ onset: 'injury', shape: false });
  expect(useSession.getState().gateOutput).toMatchObject({ verdict: 'SAFE', level: 'SOON', score: 2 });
  expect(useSession.getState().movementsBlocked).toBe(true);
  expect(routeAfterSafe('region', true)).toBe('/report/followup');
  const steps = liveSteps('region');
  expect(steps.some((s) => s.kind === 'movement')).toBe(false);
  expect(steps[0].kind).toBe('structure');
  // a SOON intake can still be narrowed from its answers
  const result = submitQuestion({ questionId: steps[0].id, type: 'yesno', value: false, state: 'answered' });
  expect(result.verdict).toBe('SAFE'); expect(result.state).not.toBeNull();
});

test('a ROUTINE intake keeps the movements', () => {
  seed();
  expect(useSession.getState().gateOutput?.level).toBe('ROUTINE');
  expect(liveSteps('region').filter((s) => s.kind === 'movement')).toHaveLength(6);
  expect(routeAfterSafe('region', false)).toBe('/report/movement?i=0');
});

test('SafeGuard waits for durable confirmation, then hides children immediately after an answer changes', async () => {
  seed();
  let resolve!: (out: ReturnType<typeof evaluate>) => void;
  const checkpoint = jest.fn(() => new Promise<ReturnType<typeof evaluate>>((r) => { resolve = r; }));
  jest.mocked(openSafetySession).mockResolvedValue({ checkpoint } as unknown as Awaited<ReturnType<typeof openSafetySession>>);
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<SafeGuard>protected movement</SafeGuard>); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('protected movement');
  await act(async () => { resolve(evaluate(lowRiskAnswers())); });
  expect(JSON.stringify(tree.toJSON())).toContain('protected movement');
  act(() => useSession.getState().recordAnswer({ questionId: 'chest', type: 'yesno', value: true, state: 'answered' }));
  expect(JSON.stringify(tree.toJSON())).not.toContain('protected movement');
  act(() => tree.unmount());
});

test('SafeGuard does not show movements when storage fails', async () => {
  seed();
  jest.mocked(openSafetySession).mockRejectedValue(new Error('disk unavailable'));
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<SafeGuard>protected movement</SafeGuard>); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('protected movement');
  expect(JSON.stringify(tree.toJSON())).toContain('/report/danger');
  act(() => tree.unmount());
});
