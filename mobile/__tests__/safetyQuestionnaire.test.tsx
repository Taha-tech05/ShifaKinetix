import { act, create } from 'react-test-renderer';
import { router } from 'expo-router';
import * as Router from 'expo-router';
import { SafetyQuestionnaire } from '../src/gate/SafetyQuestionnaire';
import Safe from '../src/app/report/safe';
import { openSafetySession, SafetySession } from '../src/gate/safetySession';
import { questions, SafetyAnswer } from '../src/gate/evaluate';
import type { IntakeStore } from '../src/storage/intakeStore';
import { useSession } from '../src/store/session';
import { submitQuestionDurable } from '../src/flow/live';
import { SafetyStopNotice } from '../src/gate/SafetyStopNotice';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'fictional-intake' }));
jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), openSafetySession: jest.fn() }));
jest.mock('../src/components/Screen', () => ({ Screen: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => <>{children}{footer}</> }));
jest.mock('react-native', () => ({ ...jest.requireActual('./support/react-native'), TextInput: 'TextInput' }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Real questionnaire, coordinator, gate, store and SAFE handoff; only native IO and
// navigation are replaced. Real database transactions have a separate SQLite suite.
let session: SafetySession;
let tree: ReturnType<typeof create>;
let replace: jest.SpyInstance;
beforeEach(() => {
  useSession.getState().reset();
  useSession.getState().setMode('region');
  useSession.getState().setSelection({ regionId: 'shoulder_right', subRegionId: 'front',
    point: { x: 0, y: 1, z: 0 }, layer: 'muscle', hitStructure: null });
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'slowly', state: 'answered' });
  const saved = new Map<string, SafetyAnswer>();
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
async function complete(uncertain = false, optionalUnknown = false, redness = false) {
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check');
  for (const q of questions) {
    expect(JSON.stringify(tree.toJSON())).toContain(q.wording);
    if (uncertain || (optionalUnknown && !q.required)) await press('Not sure');
    else if (q.type === 'yesno') await press(q.questionId === 'infection_risk' || (redness && q.questionId === 'redness') ? 'Yes' : 'No');
    else if (q.type === 'choice') await press(q.options!.find((o) => o.value === 'normal' || o.value === 'right')?.label ?? q.options![0].label);
    else {
      await act(async () => { tree.root.findByType('TextInput' as never).props.onChangeText(q.questionId === 'pain_score' ? '3' : String(q.min ?? 0)); });
      await press('Save answer');
    }
  }
}
test('all non-danger answers reach SAFE and Continue opens the movement flow', async () => {
  await complete();
  expect(replace).toHaveBeenLastCalledWith('/report/safe');
  expect(useSession.getState().gateVerdict).toBe('SAFE');
  await act(async () => { tree.update(<Safe />); });
  await press('Continue');
  expect(replace).toHaveBeenLastCalledWith('/report/movement?i=0');
});
test('uncertain answers request clarification, and repeated uncertainty stops', async () => {
  await complete(true);
  expect(replace).toHaveBeenLastCalledWith('/report/reask');
  await act(async () => { tree.update(<SafetyQuestionnaire clarify />); });
  await press('Not sure');
  expect(replace).toHaveBeenLastCalledWith('/report/unclear');
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
});

test.each(['after_injury', 'suddenly', null])('broad onset %s can be explicitly clarified/corrected and reach movements', async (value) => {
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value,
    state: value === null ? 'unknown' : 'answered' });
  await complete();
  expect(replace).not.toHaveBeenCalledWith('/report/urgent');
  expect(useSession.getState().answers.find((a) => a.questionId === 'Q_BASICS_HOW')?.value).toBe(value);
  expect(useSession.getState().gateVerdict).toBe('SAFE');
  await act(async () => { tree.update(<Safe />); });
  await press('Continue');
  expect(replace).toHaveBeenLastCalledWith('/report/movement?i=0');
});

test('confirmed accident/injury is still a stop, even with a low basics pain score', async () => {
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_PAIN_NOW', type: 'scale0to10', value: 1, state: 'answered' });
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check');
  expect(replace).not.toHaveBeenCalled();
  await press('No'); await press('No'); // chest and breathing
  expect(JSON.stringify(tree.toJSON())).toContain('An earlier answer needs a more specific safety check');
  await press('Yes'); // confirms injury
  expect(replace).toHaveBeenLastCalledWith('/report/urgent');
  expect(useSession.getState().gateOutput?.firedRules.some((r) => r.ruleId === 'R_injury')).toBe(true);
});

test('optional uncertainty does not prevent narrowing clearance', async () => {
  await complete(false, true);
  expect(useSession.getState().gateVerdict).toBe('SAFE');
});

test.each([
  ['No', 'SAFE', '/report/safe'],
  ['Yes', 'RED_FLAG', '/report/urgent'],
  ['Not sure', 'CLARIFY', '/report/unclear'],
])('redness makes uncertain infection risk a follow-up; %s resolves to %s', async (answer, verdict, destination) => {
  await complete(false, true, true);
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
  expect(replace).toHaveBeenLastCalledWith('/report/reask');
  await act(async () => { tree.update(<SafetyQuestionnaire clarify />); });
  expect(JSON.stringify(tree.toJSON())).toContain(questions.find((q) => q.questionId === 'infection_risk')!.wording);
  await press(answer);
  expect(useSession.getState().gateVerdict).toBe(verdict);
  expect(replace).toHaveBeenLastCalledWith(destination);
});

test('movement weakness requests precise follow-ups, then resolved answers reopen narrowing', async () => {
  await complete();
  act(() => {
    useSession.getState().recordMovement({ movementId: 'sideways_raise', painful: true, weak: true,
      unableToDo: false, measuredAngle: null, state: 'done' });
    useSession.getState().runGate();
  });
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
  await act(async () => { tree.update(<SafetyQuestionnaire clarify />); });
  for (const id of ['unable', 'tingling', 'numb']) {
    expect(JSON.stringify(tree.toJSON())).toContain(questions.find((q) => q.questionId === id)!.wording);
    await press('No');
  }
  expect(useSession.getState().gateVerdict).toBe('SAFE');
  const out = await submitQuestionDurable({ questionId: 'Q_ST_BONE_POINT', type: 'yesno', state: 'answered', value: false });
  expect(out.verdict).toBe('SAFE'); expect(out.state).not.toBeNull();
});
test('a positive danger answer stops instead of opening movements', async () => {
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check');
  await press('Yes');
  expect(replace).toHaveBeenLastCalledWith('/report/urgent');
  expect(useSession.getState().gateVerdict).toBe('RED_FLAG');
});

test('an accidentally entered danger answer can be reviewed without bypassing the remaining questions', async () => {
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check'); await press('Yes');
  await act(async () => { tree.update(<SafetyStopNotice />); });
  const push = jest.spyOn(router, 'push');
  await press(`Review: ${questions[0].wording}`);
  expect(push).toHaveBeenCalledWith('/report/danger?review=chest');
  const params = jest.spyOn(Router, 'useLocalSearchParams').mockReturnValue({ review: 'chest' });
  await act(async () => { tree.update(<SafetyQuestionnaire />); });
  await press('No');
  expect(useSession.getState().gateVerdict).toBe('CLARIFY');
  expect(JSON.stringify(tree.toJSON())).toContain(questions[1].wording);
  expect(replace).not.toHaveBeenCalledWith('/report/safe');
  params.mockRestore(); push.mockRestore();
});
