import { act, create } from 'react-test-renderer';
import ServerSync from '../src/app/server/sync';
import { useServer } from '../src/server/connection';
import { isCleared, moreCautious, shownVerdict } from '../src/server/verdict';
import { ApiClient } from '../src/storage/apiClient';
import { CONTENT_VERSION } from '../src/gate/evaluate';
import type { Verdict } from '../src/gate/evaluate';
import { useSession } from '../src/store/session';

const mockStore = { latestIntake: jest.fn(), pending: jest.fn(), syncOrdered: jest.fn() };
const mockSession = { activeId: 'intake-1' as string | null, checkpoint: jest.fn() };
jest.mock('../src/gate/safetySession', () => ({ openSafetySession: async () => mockSession }));
jest.mock('../src/storage/nativeStore', () => ({ openIntakeStore: async () => mockStore }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const V: Verdict[] = ['SAFE', 'CLARIFY', 'RED_FLAG'];

describe('moreCautious', () => {
  test.each(V.flatMap((a) => V.map((b) => [a, b] as const)))('%s with %s', (a, b) => {
    const order = { SAFE: 0, CLARIFY: 1, RED_FLAG: 2 };
    expect(moreCautious(a, b)).toBe(order[a] >= order[b] ? a : b);
  });
  test.each([[null], [undefined], ['safe'], [''], [42], [{}]])('a missing or unknown verdict (%p) is never SAFE', (bad) => {
    expect(moreCautious('SAFE', bad)).toBe('CLARIFY');
    expect(moreCautious(bad, 'SAFE')).toBe('CLARIFY');
    expect(moreCautious(bad, bad)).toBe('CLARIFY');
    expect(moreCautious('RED_FLAG', bad)).toBe('RED_FLAG');
  });
  test('only a verdict both sides gave can be cleared', () => {
    expect(isCleared(shownVerdict('SAFE', 'SAFE'))).toBe(true);
    expect(isCleared(shownVerdict('SAFE', null))).toBe(false);
    expect(isCleared(shownVerdict(null, 'SAFE'))).toBe(false);
    expect(isCleared(shownVerdict('SAFE', 'CLARIFY'))).toBe(false);
    expect(isCleared(shownVerdict('RED_FLAG', 'SAFE'))).toBe(false);
  });
});

let request: jest.SpyInstance;
let tree: ReturnType<typeof create>;
const text = () => JSON.stringify(tree.toJSON());
function connect(role: 'patient' | 'doctor' = 'patient') {
  useServer.setState({ status: 'connected', baseUrl: 'https://demo.example', identity: { id: 'demo', role },
    api: new ApiClient('https://demo.example', 'tok', fetch, false, 200), error: '' });
}
async function render() { await act(async () => { tree = create(<ServerSync />); }); }
async function press(label: string) {
  const b = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
  expect(b).toBeDefined();
  await act(async () => { b.props.onPress(); });
}
const ack = (event: { idempotencyKey: string; intakeId: string }, seq: number) =>
  json({ status: 'stored', idempotencyKey: event.idempotencyKey, intakeId: event.intakeId, contentVersion: CONTENT_VERSION,
    eventSeq: seq, answerValid: true, gate: { verdict: 'SAFE', firedRules: [] } });
const events = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'answer' as const, intakeId: 'intake-1', idempotencyKey: `intake-1:${i + 1}`,
  contentVersion: CONTENT_VERSION, answer: { questionId: 'injury', type: 'yesno', value: false, state: 'answered' } }));
/** A store that "sends" `n` events through the real ApiClient, then reports how many are left. */
function storeSending(n: number, remaining = 0) {
  mockStore.syncOrdered.mockImplementation(async (_id: string, _who: string, send: (e: unknown) => Promise<void>) => {
    for (const e of events(n)) await send(e);
    return { sent: n, remaining };
  });
}
function serverAnswers(serverVerdict: Verdict | 'fail') {
  request.mockImplementation(async (url: string, init: { body?: string }) => {
    if (url.endsWith('/auth/me')) return json({ id: 'demo', role: 'patient' });
    if (url.endsWith('/sync/answers')) return ack(JSON.parse(init.body as string), 1);
    if (url.endsWith('/gate')) return serverVerdict === 'fail' ? json({}, 503) : json({ verdict: serverVerdict, firedRules: serverVerdict === 'SAFE' ? [] : [{ ruleId: 'R', reason: 'r', source: 's', matchedAnswers: [] }] });
    return json({}, 404);
  });
}

beforeEach(() => {
  request = jest.spyOn(globalThis, 'fetch');
  mockSession.activeId = 'intake-1'; mockSession.checkpoint.mockReset().mockResolvedValue(undefined);
  mockStore.latestIntake.mockReset().mockResolvedValue('intake-1'); mockStore.pending.mockReset().mockResolvedValue([{}, {}]);
  mockStore.syncOrdered.mockReset();
  useSession.setState({ gateVerdict: 'SAFE' });
});
afterEach(() => { if (tree) act(() => tree.unmount()); request.mockRestore(); useServer.getState().disconnect(); useSession.setState({ gateVerdict: null }); });

test('not connected: nothing about a result is shown', async () => {
  await render();
  expect(text()).toContain('Not connected to the server.');
  expect(text()).toContain('Demo only, not for real patients.');
  expect(text()).not.toContain('No safety stop found');
});
test('a doctor account cannot use the patient sync screen', async () => {
  connect('doctor'); await render();
  expect(text()).toContain('A patient account is required');
  expect(mockStore.syncOrdered).not.toHaveBeenCalled();
});
test('shows the saved assessment and waiting events, and the demo notice', async () => {
  connect(); await render();
  expect(text()).toContain('Assessment intake-1');
  expect(text()).toContain('2 saved event(s) waiting');
  expect(text()).toContain('Demo only, not for real patients.');
});
test('before any upload a SAFE phone verdict is shown as not confirmed, not as cleared', async () => {
  connect(); await render();
  expect(text()).toContain('Not cleared yet');
  expect(text()).not.toContain('No safety stop found');
});
test('phone SAFE and server SAFE after a confirmed upload is cleared', async () => {
  connect(); storeSending(2); serverAnswers('SAFE'); await render();
  await press('Upload saved assessment');
  expect(text()).toContain('No safety stop found by the phone or the server.');
  expect(text()).toContain('Upload confirmed by the server');
});
test('the server is more cautious than the phone: the server verdict wins', async () => {
  connect(); storeSending(1); serverAnswers('RED_FLAG'); await render();
  await press('Upload saved assessment');
  expect(text()).toContain('Urgent: please see a doctor now.');
  expect(text()).not.toContain('No safety stop found');
});
test('the phone is more cautious than the server: the phone verdict wins', async () => {
  useSession.setState({ gateVerdict: 'CLARIFY' });
  connect(); storeSending(1); serverAnswers('SAFE'); await render();
  await press('Upload saved assessment');
  expect(text()).toContain('Not cleared');
  expect(text()).not.toContain('No safety stop found');
});
test('a failed server request during upload is an error and is not cleared', async () => {
  connect(); storeSending(1);
  request.mockImplementation(async (url: string) => url.endsWith('/auth/me') ? json({ id: 'demo', role: 'patient' }) : json({}, 503));
  await render();
  await press('Upload saved assessment');
  expect(text()).toContain('Server request failed (503)');
  expect(text()).not.toContain('No safety stop found');
  expect(text()).toContain('Server: not confirmed');
});
test('a server that cannot be reached is an error and is not cleared', async () => {
  connect(); storeSending(1);
  request.mockImplementation(async (url: string) => {
    if (url.endsWith('/auth/me')) return json({ id: 'demo', role: 'patient' });
    throw new Error('Network request failed');
  });
  await render();
  await press('Upload saved assessment');
  expect(text()).toContain('Network request failed');
  expect(text()).not.toContain('No safety stop found');
});
test('a stalled server is stopped by the deadline and is not cleared', async () => {
  connect(); storeSending(1);
  request.mockImplementation((url: string, init: { signal: AbortSignal }) => String(url).endsWith('/auth/me')
    ? Promise.resolve(json({ id: 'demo', role: 'patient' }))
    : new Promise<Response>((_r, rej) => init.signal.addEventListener('abort', () => rej(new Error('The request was aborted')))));
  await render();
  await press('Upload saved assessment');
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  expect(text()).toContain('aborted');
  expect(text()).not.toContain('No safety stop found');
});
test('the gate read failing after a complete upload leaves the result unconfirmed', async () => {
  connect(); storeSending(1); serverAnswers('fail'); await render();
  await press('Upload saved assessment');
  expect(text()).toContain('Server request failed (503)');
  expect(text()).not.toContain('No safety stop found');
});
test('a partial upload is reported and is not cleared', async () => {
  connect(); storeSending(1, 3); serverAnswers('SAFE'); await render();
  await press('Upload saved assessment');
  expect(text()).toContain('1 uploaded, 3 still waiting');
  expect(text()).not.toContain('No safety stop found');
  expect(text()).toContain('Server: not confirmed');
});
test('if the server says the account is a different one, nothing is uploaded', async () => {
  connect();
  request.mockImplementation(async (url: string) => url.endsWith('/auth/me') ? json({ id: 'someone-else', role: 'patient' }) : json({}, 404));
  await render();
  await press('Upload saved assessment');
  expect(text()).toContain('Sign in again');
  expect(mockStore.syncOrdered).not.toHaveBeenCalled();
});
test('no saved assessment: upload is unavailable', async () => {
  mockSession.activeId = null; mockStore.latestIntake.mockResolvedValue(null);
  connect(); await render();
  expect(text()).toContain('No saved assessment yet');
  const b = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === 'Upload saved assessment')[0];
  expect(b.props.disabled).toBe(true);
});
