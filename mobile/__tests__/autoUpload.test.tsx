const mockStore = { latestIntake: jest.fn(), pending: jest.fn(), syncOrdered: jest.fn() };
const mockSession = { activeId: 'intake-1' as string | null, checkpoint: jest.fn() };
jest.mock('../src/gate/safetySession', () => ({ openSafetySession: async () => mockSession }));
jest.mock('../src/storage/nativeStore', () => ({ openIntakeStore: async () => mockStore }));
// these screens are tested here only for the automatic upload: plain frames, no 3D model, no stop notice
jest.mock('../src/components/Screen', () => ({
  Screen: (props: { banner?: unknown; children?: unknown; footer?: unknown }) => require('react').createElement('Screen', {}, props.banner, props.children, props.footer),
}));
jest.mock('../src/gate/SafetyStopNotice', () => ({ SafetyStopNotice: () => null }));
jest.mock('../src/flow/SafeGuard', () => ({ SafeGuard: (p: { children: unknown }) => p.children }));
jest.mock('../src/components/movement/MovementStage', () => ({ MovementStage: () => null }));

import { act, create } from 'react-test-renderer';
import * as expoRouter from 'expo-router';
import Urgent from '../src/app/report/urgent';
import Unclear from '../src/app/report/unclear';
import Result from '../src/app/report/result';
import { AutoUploadNotice, autoUploadAssessment } from '../src/server/autoUpload';
import { useServer } from '../src/server/connection';
import { CONTENT_VERSION } from '../src/gate/evaluate';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
let request: jest.SpyInstance;
let push: jest.SpyInstance;
let tree: ReturnType<typeof create> | undefined;
const text = () => JSON.stringify(tree!.toJSON());
const urls = () => request.mock.calls.map((c) => String(c[0]));

const events = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'answer' as const, intakeId: 'intake-1', idempotencyKey: `intake-1:${i + 1}`,
  contentVersion: CONTENT_VERSION, answer: { questionId: 'injury', type: 'yesno', value: false, state: 'answered' } }));
function storeSending(n: number, remaining = 0) {
  mockStore.syncOrdered.mockImplementation(async (_id: string, _who: string, send: (e: unknown) => Promise<void>) => {
    for (const e of events(n)) await send(e);
    return { sent: n, remaining };
  });
}
/** A server like the real one: dev sign-in gives the account's fixed role, events are acknowledged, the gate answers. */
function server(opts: { role?: 'patient' | 'doctor'; devLogin?: number; gate?: 'SAFE' | 'RED_FLAG' | 'CLARIFY'; down?: boolean } = {}) {
  const { role = 'patient', devLogin = 200, gate = 'SAFE', down = false } = opts;
  request.mockImplementation(async (url: string, init: { body?: string }) => {
    if (down) throw new Error('Network request failed');
    if (url.endsWith('/health')) return json({ status: 'ok' });
    if (url.endsWith('/auth/dev-login')) return devLogin === 200 ? json({ token: 't', user: { id: 'demo-patient', role } }) : json({}, devLogin);
    if (url.endsWith('/auth/me')) return json({ id: 'demo-patient', role });
    if (url.endsWith('/sync/answers')) {
      const e = JSON.parse(init.body as string);
      return json({ status: 'stored', idempotencyKey: e.idempotencyKey, intakeId: e.intakeId, contentVersion: CONTENT_VERSION, eventSeq: 1, answerValid: true, gate: { verdict: 'SAFE', firedRules: [] } });
    }
    if (url.endsWith('/gate')) return json({ verdict: gate, firedRules: gate === 'SAFE' ? [] : [{ ruleId: 'R', reason: 'r', source: 's', matchedAnswers: [] }] });
    return json({}, 404);
  });
}
async function mount(el: React.ReactElement) { await act(async () => { tree = create(el); }); await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); }

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_AUTO_UPLOAD;
  request = jest.spyOn(globalThis, 'fetch');
  push = jest.spyOn(expoRouter.router, 'push');
  mockSession.activeId = 'intake-1'; mockSession.checkpoint.mockReset().mockResolvedValue(undefined);
  mockStore.latestIntake.mockReset().mockResolvedValue('intake-1'); mockStore.pending.mockReset().mockResolvedValue([]);
  mockStore.syncOrdered.mockReset();
  useServer.getState().disconnect();
  useServer.setState({ baseUrl: 'https://demo.example' });
});
afterEach(() => {
  if (tree) act(() => tree!.unmount());
  tree = undefined; request.mockRestore(); push.mockRestore();
  useServer.getState().disconnect();
  process.env.EXPO_PUBLIC_AUTO_UPLOAD = 'off';
});

describe('autoUploadAssessment', () => {
  test('signs in to the fixed demo patient by itself, uploads, and remembers the assessment', async () => {
    storeSending(2); server();
    const r = await autoUploadAssessment();
    expect(r).toEqual({ ok: true, intakeId: 'intake-1' });
    const login = request.mock.calls.find((c) => String(c[0]).endsWith('/auth/dev-login'))!;
    expect(JSON.parse(login[1].body)).toEqual({ userId: 'demo-patient', role: 'patient' });
    expect(urls().filter((u) => u.endsWith('/sync/answers'))).toHaveLength(2);
    expect(useServer.getState().recentIntakeIds).toEqual(['intake-1']);
  });
  test('an existing patient connection is reused (no second sign-in)', async () => {
    storeSending(1); server();
    await useServer.getState().signInDemo('patient');
    request.mockClear();
    expect((await autoUploadAssessment()).ok).toBe(true);
    expect(urls().some((u) => u.endsWith('/auth/dev-login'))).toBe(false);
  });
  test('a doctor connection is replaced by the patient account for the upload', async () => {
    storeSending(1); server({ role: 'doctor' });
    await useServer.getState().signInDemo('doctor');
    server({ role: 'patient' });
    expect((await autoUploadAssessment()).ok).toBe(true);
    expect(useServer.getState().identity?.role).toBe('patient');
  });
  test.each([
    ['the server is down', { down: true }, 'Network request failed'],
    ['development sign-in is off', { devLogin: 404 }, 'switched off'],
  ])('%s: a message, never a success', async (_n, opts, words) => {
    storeSending(1); server(opts);
    const r = await autoUploadAssessment();
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain(words);
    expect((r as { message: string }).message).toContain('not sent to the server');
    expect(useServer.getState().recentIntakeIds).toEqual([]);
  });
  test('a partial upload is a failure', async () => {
    storeSending(1, 2); server();
    const r = await autoUploadAssessment();
    expect(r.ok).toBe(false);
    expect((r as { message: string }).message).toContain('2 saved answer(s) were not confirmed');
  });
  test('no saved assessment is a failure and nothing is uploaded', async () => {
    mockSession.activeId = null; mockStore.latestIntake.mockResolvedValue(null); server();
    const r = await autoUploadAssessment();
    expect(r).toEqual({ ok: false, message: 'There is no saved assessment to send yet.' });
    expect(mockStore.syncOrdered).not.toHaveBeenCalled();
  });
  test('a server that does not acknowledge an event stops the upload', async () => {
    storeSending(1); server();
    request.mockImplementation(async (url: string) => url.endsWith('/health') ? json({ status: 'ok' }) : url.endsWith('/auth/dev-login') ? json({ token: 't', user: { id: 'demo-patient', role: 'patient' } }) : url.endsWith('/auth/me') ? json({ id: 'demo-patient', role: 'patient' }) : json({}, 503));
    expect((await autoUploadAssessment()).ok).toBe(false);
  });
});

describe('the end of the safety flow', () => {
  test.each([['urgent', <Urgent key="u" />, 'RED_FLAG'], ['unclear', <Unclear key="n" />, 'CLARIFY'], ['result', <Result key="r" />, 'SAFE']] as const)(
    'the %s screen uploads on its own and then opens the server report', async (_n, el, verdict) => {
      storeSending(2); server({ gate: verdict });
      await mount(el);
      expect(urls().filter((u) => u.endsWith('/sync/answers'))).toHaveLength(2);
      expect(push).toHaveBeenCalledWith('/server/report');
    });
  test.each([['urgent', <Urgent key="u" />], ['unclear', <Unclear key="n" />], ['result', <Result key="r" />]] as const)(
    'the %s screen stays put and says "not sent" when the server is down', async (_n, el) => {
      storeSending(1); server({ down: true });
      await mount(el);
      expect(push).not.toHaveBeenCalled();
      expect(text()).toContain('Not sent to the server');
      expect(text()).toContain('not sent to the server, so a doctor cannot see them yet');
      expect(text()).not.toContain('Sending your answers');
    });
  test('Try again uploads again once the server is back', async () => {
    storeSending(1); server({ down: true });
    await mount(<Urgent />);
    expect(push).not.toHaveBeenCalled();
    server();
    const retry = tree!.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === 'Try again')[0];
    await act(async () => { retry.props.onPress(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(push).toHaveBeenCalledWith('/server/report');
  });
  test('the upload happens once per screen, not on every render', async () => {
    storeSending(1); server();
    await mount(<Urgent />);
    await act(async () => { tree!.update(<Urgent />); });
    expect(mockStore.syncOrdered).toHaveBeenCalledTimes(1);
  });
  test('it can be switched off with EXPO_PUBLIC_AUTO_UPLOAD=off', async () => {
    process.env.EXPO_PUBLIC_AUTO_UPLOAD = 'off';
    server();
    await mount(<AutoUploadNotice />);
    expect(request).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(text()).toBe('null');
  });
  test('while it works the screen says so', async () => {
    storeSending(1);
    request.mockImplementation(() => new Promise<Response>(() => undefined));
    await act(async () => { tree = create(<Urgent />); });
    expect(text()).toContain('Sending your answers to the server');
  });
});
