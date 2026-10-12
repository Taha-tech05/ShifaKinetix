import { act, create } from 'react-test-renderer';
import { router } from 'expo-router';
import { SafetyQuestionnaire } from '../src/gate/SafetyQuestionnaire';
import Safe from '../src/app/report/safe';
import { openSafetySession, SafetySession } from '../src/gate/safetySession';
import { questions, SafetyAnswer } from '../src/gate/evaluate';
import type { IntakeStore } from '../src/storage/intakeStore';
import { useSession } from '../src/store/session';

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
async function complete(uncertain = false) {
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check');
  for (const q of questions) {
    expect(JSON.stringify(tree.toJSON())).toContain(q.wording);
    if (uncertain) await press('Not sure');
    else if (q.type === 'yesno') await press('No');
    else if (q.type === 'choice') await press(q.options!.find((o) => o.value === 'normal' || o.value === 'right')?.label ?? q.options![0].label);
    else {
      await act(async () => { tree.root.findByType('TextInput' as never).props.onChangeText(String(q.min ?? 0)); });
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
});
test('a positive danger answer stops instead of opening movements', async () => {
  await act(async () => { tree = create(<SafetyQuestionnaire />); });
  await press('Start new safety check');
  await press('Yes');
  expect(replace).toHaveBeenLastCalledWith('/report/urgent');
  expect(useSession.getState().gateVerdict).toBe('RED_FLAG');
});
