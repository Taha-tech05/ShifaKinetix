import { act, create } from 'react-test-renderer';
import { router } from 'expo-router';
import * as Router from 'expo-router';
import { SafetyQuestionnaire } from '../src/gate/SafetyQuestionnaire';
import Safe from '../src/app/report/safe';
import Urgent from '../src/app/report/urgent';
import { openSafetySession, SafetySession } from '../src/gate/safetySession';
import { questions, SafetyAnswer } from '../src/gate/evaluate';
import type { IntakeStore } from '../src/storage/intakeStore';
import { useSession } from '../src/store/session';
import { submitMovement, submitQuestionDurable } from '../src/flow/live';
import { SafetyStopNotice } from '../src/gate/SafetyStopNotice';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'fictional-intake' }));
jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), openSafetySession: jest.fn() }));
jest.mock('../src/components/Screen', () => ({ Screen: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => <>{children}{footer}</> }));
jest.mock('react-native', () => ({ ...jest.requireActual('./support/react-native'), TextInput: 'TextInput' }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Real questionnaire, coordinator, gate, store and SAFE handoff; only native IO and
// navigation are replaced. Real database transactions have a separate SQLite suite. Contract v2.
let session: SafetySession;
let tree: ReturnType<typeof create>;
let replace: jest.SpyInstance;
let saved: Map<string, SafetyAnswer>;
const wording = (id: string) => questions.find((q) => q.questionId === id)!.wording;
const text = () => JSON.stringify(tree.toJSON());
beforeEach(() => {
  useSession.getState().reset();
  useSession.getState().setMode('region');
  useSession.getState().setSelection({ regionId: 'shoulder_right', subRegionId: 'front',
    point: { x: 0, y: 1, z: 0 }, layer: 'muscle', hitStructure: null });
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'slowly', state: 'answered' });
  saved = new Map<string, SafetyAnswer>();
  session = new SafetySession({
    createIntake: async () => { saved.clear(); },
    cachedQuestions: async () => questions,
    answers: async () => [...saved.values()],
    saveAnswer: async (_id: string, answer: SafetyAnswer) => { saved.set(answer.questionId, answer); },
    saveContext: async () => undefined,
  } as unknown as IntakeStore);
  jest.mocked(openSafetySession).mockResolvedValue(session);
  replace = jest.spyOn(router, 'replace');
});
afterEach(() => { if (tree) act(() => tree.unmount()); session.dispose(); replace.mockRestore(); });
async function press(label: string) {
  const button = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
  expect(button).toBeDefined();
  expect(button.props.disabled).toBe(false);
  await act(async () => { button.props.onPress(); });
}
async function start() {
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check');
}
/** Answers the question now shown; asserts it is the expected one first. */
async function answer(id: string, label: string) {
  expect(text()).toContain(wording(id));
  if (questions.find((q) => q.questionId === id)!.type === 'number') {
    await act(async () => { tree.root.findByType('TextInput' as never).props.onChangeText(label); });
    await press('Save answer');
  } else await press(label);
}
const LOW_RISK: [string, string][] = [['chest', 'No'], ['breathing', 'No'], ['unable', 'No'], ['sensation', 'No'],
  ['inflammation', 'No'], ['illness', 'No'], ['pain_score', '3']];
async function lowRiskPath() {
  await start();
  for (const [id, label] of LOW_RISK) await answer(id, label);
}
const MOVES = ['sideways_raise', 'forward_raise', 'can_position_hold', 'outward_push_elbow_at_side', 'belly_press', 'hand_behind_back'];

test('the low-risk path asks seven short questions, never repeats how it started, and opens the movements', async () => {
  await lowRiskPath();
  expect(saved.get('onset')).toMatchObject({ value: 'gradual', state: 'answered' });
  expect(replace).toHaveBeenLastCalledWith('/report/safe');
  expect(useSession.getState().gateOutput).toMatchObject({ verdict: 'SAFE', level: 'ROUTINE' });
  expect(saved.size).toBe(8);
  await act(async () => { tree.update(<Safe />); });
  await press('Continue');
  expect(replace).toHaveBeenLastCalledWith('/report/movement?i=0');
});

test('the basics pain score is reused too: six questions to answer', async () => {
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_PAIN_NOW', type: 'scale0to10', value: 2, state: 'answered' });
  await start();
  for (const [id, label] of LOW_RISK.slice(0, 6)) await answer(id, label);
  expect(saved.get('pain_score')).toMatchObject({ value: 2, state: 'answered' });
  expect(text()).not.toContain(wording('onset'));
  expect(replace).toHaveBeenLastCalledWith('/report/safe');
});

test('a first Not sure on a hard-stop question explains it on the same card; a second one stops at unclear', async () => {
  await start();
  await press('Not sure');
  expect(saved.has('chest')).toBe(false);
  expect(text()).toContain('If you still cannot tell, choose Not sure again');
  expect(text()).toContain(questions[0].clarification);
  await press('Not sure');
  expect(saved.get('chest')).toMatchObject({ state: 'unknown', clarificationAttempted: true });
  expect(replace).toHaveBeenLastCalledWith('/report/unclear');
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
});

test('a Yes to an opening question asks its details; No to each continues', async () => {
  await start();
  for (const [id, label] of LOW_RISK.slice(0, 3)) await answer(id, label);
  await answer('sensation', 'Yes');
  await answer('numb', 'No');
  await answer('tingling', 'Yes, but it comes and goes');
  await answer('temperature', 'Neither');
  for (const [id, label] of LOW_RISK.slice(4)) await answer(id, label);
  expect(useSession.getState().gateOutput).toMatchObject({ verdict: 'SAFE', level: 'ROUTINE', score: 1 });
});

test('Not sure on an opening question asks about each part instead of stopping', async () => {
  await start();
  for (const [id, label] of LOW_RISK.slice(0, 3)) await answer(id, label);
  await answer('sensation', 'Not sure');
  expect(replace).not.toHaveBeenCalledWith('/report/unclear');
  await answer('numb', 'No');
  await answer('tingling', 'No');
  await answer('temperature', 'Neither');
  for (const [id, label] of LOW_RISK.slice(4)) await answer(id, label);
  expect(useSession.getState().gateVerdict).toBe('SAFE');
});

test('an injury start (from the basics) asks about shape, then advises a doctor soon and skips the movements', async () => {
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  await start();
  await answer('chest', 'No'); await answer('breathing', 'No'); await answer('unable', 'No');
  await answer('shape', 'No');
  for (const [id, label] of LOW_RISK.slice(3)) await answer(id, label);
  expect(useSession.getState().gateOutput).toMatchObject({ verdict: 'SAFE', level: 'SOON', score: 2 });
  await act(async () => { tree.update(<Safe />); });
  expect(text()).toContain('Please see a doctor in the next few days');
  expect(text()).toContain('The pain started after an injury or accident');
  expect(text()).toContain('We will skip the movement checks');
  await press('Continue');
  expect(replace).toHaveBeenLastCalledWith('/report/followup');
});

test('two signs together are urgent, with the reasons shown', async () => {
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_PAIN_NOW', type: 'scale0to10', value: 9, state: 'answered' });
  await start();
  await answer('chest', 'No'); await answer('breathing', 'No'); await answer('unable', 'No'); await answer('shape', 'No');
  await answer('sensation', 'No'); await answer('inflammation', 'No'); await answer('illness', 'No');
  // the reused pain score reaches the urgent threshold at once: no more questions are needed
  expect(text()).not.toContain(wording('bilateral'));
  expect(replace).toHaveBeenLastCalledWith('/report/urgent');
  expect(useSession.getState().gateOutput).toMatchObject({ verdict: 'RED_FLAG', level: 'URGENT', score: 4 });
  await act(async () => { tree.update(<Urgent />); });
  expect(text()).toContain('Please see a doctor now');
  expect(text()).toContain('Very bad pain');
});

test('chest tightness is an emergency: calling for help comes first', async () => {
  await start();
  await press('Yes');
  expect(replace).toHaveBeenLastCalledWith('/report/urgent');
  expect(useSession.getState().gateOutput?.level).toBe('EMERGENCY');
  await act(async () => { tree.update(<Urgent />); });
  expect(text()).toContain('Call emergency help now');
  expect(text().indexOf('1122')).toBeLessThan(text().indexOf('doctor'));
});

test.each([
  ['No', 'SAFE', '/report/safe'],
  ['Yes', 'RED_FLAG', '/report/urgent'],
])('a red joint asks infection risk in the same flow; %s gives %s', async (risk, verdict, destination) => {
  await start();
  for (const [id, label] of LOW_RISK.slice(0, 4)) await answer(id, label);
  await answer('inflammation', 'Yes');
  await answer('temperature', 'Neither');
  await answer('swelling', 'Not swollen');
  await answer('redness', 'Yes');
  await answer('infection_risk', risk);
  if (verdict === 'SAFE') {
    await answer('fever', 'No');
    for (const [id, label] of LOW_RISK.slice(5)) await answer(id, label);
  }
  expect(useSession.getState().gateVerdict).toBe(verdict);
  expect(replace).toHaveBeenLastCalledWith(destination);
});

test('weak or painful movements after SAFE never bring the safety questions back', async () => {
  await lowRiskPath();
  act(() => {
    useSession.getState().recordMovement({ movementId: 'sideways_raise', painful: true, weak: true, unableToDo: false, measuredAngle: null, state: 'done' });
    useSession.getState().runGate();
  });
  expect(useSession.getState().gateVerdict).toBe('SAFE');
});

test('after the whole movement set, one failed movement asks a single check that refers to the earlier answer', async () => {
  await lowRiskPath();
  act(() => {
    MOVES.forEach((id, i) => submitMovement({ movementId: id, painful: i === 0, weak: false, unableToDo: i === 0, measuredAngle: null, state: 'done' }, 'x'));
  });
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
  await act(async () => { tree.update(<SafetyQuestionnaire clarify />); });
  expect(text()).toContain('Earlier you said you can move this arm');
  expect(text()).not.toContain('>Yes<');
  await press('It moves, but it is painful or limited');
  expect(useSession.getState().gateVerdict).toBe('SAFE');
  expect(replace).toHaveBeenLastCalledWith('/report/safe');
  const out = await submitQuestionDurable({ questionId: 'Q_ST_BONE_POINT', type: 'yesno', state: 'answered', value: false });
  expect(out.verdict).toBe('SAFE'); expect(out.state).not.toBeNull();
});

test('confirming the arm really cannot move is urgent', async () => {
  await lowRiskPath();
  act(() => {
    MOVES.forEach((id, i) => submitMovement({ movementId: id, painful: false, weak: false, unableToDo: i === 2, measuredAngle: null, state: 'done' }, 'x'));
  });
  await act(async () => { tree.update(<SafetyQuestionnaire clarify />); });
  await press('I really cannot lift or move it');
  expect(useSession.getState().gateOutput).toMatchObject({ verdict: 'RED_FLAG', level: 'URGENT' });
  expect(replace).toHaveBeenLastCalledWith('/report/urgent');
});

test('a changed basics answer asks one check about how it started, worded as a check', async () => {
  await lowRiskPath();
  act(() => {
    useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
    useSession.getState().runGate();
  });
  expect(useSession.getState().gateOutput?.firedRules.map((r) => r.ruleId)).toEqual(['F_onset']);
  await act(async () => { tree.update(<SafetyQuestionnaire clarify />); });
  expect(text()).toContain('In your first answers you said the pain started after an accident or injury');
  await press('Gradually');
  expect(useSession.getState().gateVerdict).toBe('SAFE');
});

test('an accidentally entered danger answer can be reviewed without bypassing the remaining questions', async () => {
  await start(); await press('Yes');
  await act(async () => { tree.update(<SafetyStopNotice />); });
  const push = jest.spyOn(router, 'push');
  await press(`Review: ${questions[0].wording}`);
  expect(push).toHaveBeenCalledWith('/report/danger?review=chest');
  const params = jest.spyOn(Router, 'useLocalSearchParams').mockReturnValue({ review: 'chest' });
  await act(async () => { tree.update(<SafetyQuestionnaire />); });
  await press('No');
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
  expect(text()).toContain(wording('breathing'));
  expect(replace).not.toHaveBeenCalledWith('/report/safe');
  params.mockRestore(); push.mockRestore();
});
