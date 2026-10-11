import { act, create } from 'react-test-renderer';
import { evaluate, questions, SafetyAnswer } from '../src/gate/evaluate';
import { evaluateSessionGate } from '../src/gate/sessionAdapter';
import { useSession } from '../src/store/session';
import { submitMovement, submitQuestion } from '../src/flow/live';
import { SafeGuard } from '../src/flow/SafeGuard';
import { openSafetySession } from '../src/gate/safetySession';

// Only native persistence is replaced here; gate, session, guard and live driver are real.
jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), openSafetySession: jest.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const negatives = (): SafetyAnswer[] => questions.filter((q) => q.required).map((q) => ({
  questionId: q.questionId, type: q.type as SafetyAnswer['type'], value: q.type === 'choice' ? 'normal' : false, state: 'answered',
}));
const selection = { regionId: 'shoulder_right', subRegionId: 'front' as const,
  point: { x: 0, y: 1, z: 0 }, layer: 'muscle' as const, hitStructure: null };
function seed() {
  useSession.getState().setMode('region'); useSession.getState().setSelection(selection);
  for (const a of negatives()) useSession.getState().recordAnswer(a);
  useSession.getState().runGate();
}
beforeEach(() => { useSession.getState().reset(); jest.clearAllMocks(); });

test('an empty intake or ordinary app answers cannot grant SAFE', () => {
  expect(useSession.getState().runGate()).toBe('CLARIFY');
  useSession.getState().recordAnswer({ questionId: 'Q_FORK_POINT', type: 'chooseone', value: 'exact', state: 'answered' });
  expect(useSession.getState().runGate()).toBe('CLARIFY');
  expect(evaluate(negatives()).verdict).toBe('SAFE');
});
test.each(['Q_ONSET_SUDDEN_TRAUMA', 'Q_UNABLE_TO_MOVE_ARM', 'Q_BONE_TENDER_AFTER_TRAUMA', 'Q_NUMB_OR_WEAK'])('%s positive never disappears', (questionId) => {
  const out = evaluateSessionGate([...negatives(), { questionId, type: 'yesno', value: true, state: 'answered' }]);
  expect(out.verdict).toBe('RED_FLAG');
  expect(out.firedRules.some((r) => r.matchedAnswers.includes(questionId))).toBe(true);
});
test('malformed canonical values and unfamiliar danger IDs fail closed', () => {
  expect(evaluateSessionGate([...negatives().filter((a) => a.questionId !== 'temperature'),
    { questionId: 'temperature', type: 'chooseone', value: 'normal', state: 'answered' }]).verdict).toBe('RED_FLAG');
  expect(evaluateSessionGate([...negatives(), { questionId: 'Q_DANGER_NEW', type: 'yesno', value: false, state: 'answered' }]).verdict).toBe('RED_FLAG');
});
test('unknown sensory evidence cannot be erased by a previous negative safety answer', () => {
  seed();
  const result = submitQuestion({ questionId: 'Q_ST_NUMB', type: 'yesno', value: null, state: 'unknown' });
  expect(result.verdict).toBe('CLARIFY'); expect(result.state).toBeNull();
  expect(useSession.getState().narrowingTrail).toEqual([]);
});
test('an unresolved app signal still stops after clarification instead of silently clearing', () => {
  const answers = negatives().map((a) => a.questionId === 'numb' ? { ...a, clarificationAttempted: true } : a);
  expect(evaluateSessionGate([...answers, { questionId: 'Q_ST_NUMB', type: 'yesno', value: null, state: 'unknown' }]).verdict).toBe('RED_FLAG');
});
test('real live driver stops before narrowing for new movement inability', () => {
  seed();
  const result = submitMovement({ movementId: 'sideways_raise', painful: false, weak: false, unableToDo: true, measuredAngle: null, state: 'done' }, 'unable');
  expect(result.verdict).toBe('RED_FLAG'); expect(result.route).toBe('/report/urgent');
  expect(result.state).toBeNull(); expect(useSession.getState().narrowingTrail).toEqual([]);
  expect(useSession.getState().gateOutput?.firedRules.length).toBeGreaterThan(0);
});
test('a skipped movement remains uncertain even alongside a completed movement', () => {
  seed(); const s = useSession.getState();
  s.recordMovement({ movementId: 'one', painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'done' });
  s.recordMovement({ movementId: 'two', painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'unknown' });
  expect(s.runGate()).toBe('CLARIFY');
});
test('SafeGuard waits for durable confirmation, then hides children immediately after an answer changes', async () => {
  seed();
  let resolve!: (out: ReturnType<typeof evaluate>) => void;
  const checkpoint = jest.fn(() => new Promise<ReturnType<typeof evaluate>>((r) => { resolve = r; }));
  jest.mocked(openSafetySession).mockResolvedValue({ checkpoint } as unknown as Awaited<ReturnType<typeof openSafetySession>>);
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<SafeGuard>protected movement</SafeGuard>); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('protected movement');
  await act(async () => { resolve(evaluate(negatives())); });
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
