import { act, create } from 'react-test-renderer';
import { AssessmentSync } from '../src/gate/AssessmentSync';
import { openSafetySession } from '../src/gate/safetySession';

jest.mock('../src/gate/safetySession', () => ({ openSafetySession: jest.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReturnType<typeof create>;
let request: jest.SpyInstance;
async function press(label: string) {
  const button = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
  expect(button).toBeDefined(); expect(button.props.disabled).not.toBe(true);
  await act(async () => { button.props.onPress(); });
}
async function enter(label: string, value: string) {
  const input = tree.root.findAll((n) => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === label)[0];
  await act(async () => { input.props.onChangeText(value); });
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
beforeEach(async () => {
  jest.mocked(openSafetySession).mockResolvedValue({ activeId: 'demo-intake' } as Awaited<ReturnType<typeof openSafetySession>>);
  request = jest.spyOn(globalThis, 'fetch');
  await act(async () => { tree = create(<AssessmentSync />); });
  await press('Saved assessment and sync');
  await enter('API address', 'https://demo.example'); await enter('Access token', 'fictional-token');
});
afterEach(() => { act(() => tree.unmount()); request.mockRestore(); });
test('verified patient connection never offers differential access and clears token input', async () => {
  request.mockResolvedValue(json({ id: 'fictional-patient', role: 'patient' }));
  await press('Connect');
  expect(JSON.stringify(tree.toJSON())).toContain('Upload saved assessment');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Load doctor report');
  await press('Disconnect');
  const input = tree.root.findAll((n) => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Access token')[0];
  expect(input.props.value).toBe('');
});
test('server-authorized report loads and disconnect immediately removes it', async () => {
  request.mockImplementation(async (url) => String(url).endsWith('/auth/me')
    ? json({ id: 'fictional-doctor', role: 'doctor' })
    : json({ audience: 'doctor', label: 'draft, awaiting clinician review', intakeId: 'demo-intake',
      facts: [{ label: 'Test fact', value: 'fictional finding' }], gate: { verdict: 'SAFE', firedRules: [] }, differential: [] }));
  await press('Connect'); await press('Load doctor report');
  expect(JSON.stringify(tree.toJSON())).toContain('fictional finding');
  await press('Disconnect');
  expect(JSON.stringify(tree.toJSON())).not.toContain('fictional finding');
});
test('late doctor response cannot repopulate a disconnected screen', async () => {
  let resolve!: (response: Response) => void;
  request.mockImplementation(async (url) => String(url).endsWith('/auth/me')
    ? json({ id: 'fictional-doctor', role: 'doctor' })
    : new Promise<Response>((done) => { resolve = done; }));
  await press('Connect'); await press('Load doctor report'); await press('Disconnect');
  await act(async () => { resolve(json({ audience: 'doctor', label: 'draft, awaiting clinician review', intakeId: 'demo-intake',
    facts: [{ label: 'Secret fact', value: 'late finding' }], gate: { verdict: 'SAFE', firedRules: [] }, differential: [] })); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('late finding');
});
