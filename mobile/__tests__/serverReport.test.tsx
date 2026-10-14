import { act, create } from 'react-test-renderer';
import ServerReport from '../src/app/server/report';
import { useServer } from '../src/server/connection';
import { ApiClient } from '../src/storage/apiClient';
import { validPatientReport } from '../src/reports/validation';
import type { Verdict } from '../src/gate/evaluate';
import { useSession } from '../src/store/session';

const mockStore = { latestIntake: jest.fn(), pending: jest.fn(), syncOrdered: jest.fn() };
const mockSession = { activeId: 'intake-1' as string | null, checkpoint: jest.fn() };
jest.mock('../src/gate/safetySession', () => ({ openSafetySession: async () => mockSession }));
jest.mock('../src/storage/nativeStore', () => ({ openIntakeStore: async () => mockStore }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const base = { audience: 'patient', intakeId: 'intake-1', banner: 'Demo only, not for real patients.', talkToDoctor: true };
const READY = { ...base, status: 'READY', musclesThatMayBeInvolved: ['supraspinatus', 'infraspinatus'], cluster: false, guidance: 'This is not a diagnosis.' };
const REFER = { ...base, status: 'REFER', message: 'Please talk to a doctor about your shoulder before trying any movements.' };
const INCOMPLETE = { ...base, status: 'INCOMPLETE', message: 'Please finish the safety questions before continuing.' };

describe('validPatientReport', () => {
  test.each([[READY], [REFER], [INCOMPLETE]])('accepts the three server shapes', (r) => expect(validPatientReport(r)).toBe(true));
  test.each([
    ['differential', { differential: [{ condition: 'Subacromial impingement', reason: 'r', source: 's' }] }],
    ['condition name', { condition: 'Rotator cuff tear' }],
    ['conditionId', { conditionId: 'rc_tear' }],
    ['score', { score: 0.8 }],
    ['rank', { rank: 1 }],
    ['firedRules', { firedRules: [] }],
    ['gate', { gate: { verdict: 'SAFE', firedRules: [] } }],
    ['write-up', { writeUp: 'text' }],
    ['narrowing', { narrowing: {} }],
    ['an unknown field', { anything: 1 }],
  ])('rejects a response carrying %s', (_name, extra) => {
    expect(validPatientReport({ ...READY, ...extra })).toBe(false);
    expect(validPatientReport({ ...REFER, ...extra })).toBe(false);
  });
  test.each([
    [{ ...READY, audience: 'doctor' }], [{ ...READY, status: 'SAFE' }], [{ ...READY, talkToDoctor: false }], [{ ...READY, musclesThatMayBeInvolved: [1] }],
    [{ ...READY, message: 'x' }], [{ ...REFER, musclesThatMayBeInvolved: ['x'] }], [{ ...REFER, message: '' }], [null], [[]], ['READY'],
  ])('rejects malformed %#', (bad) => expect(validPatientReport(bad)).toBe(false));
});

let request: jest.SpyInstance;
let tree: ReturnType<typeof create>;
const text = () => JSON.stringify(tree.toJSON());
function connect(role: 'patient' | 'doctor' = 'patient') {
  useServer.setState({ status: 'connected', baseUrl: 'https://demo.example', identity: { id: 'demo', role },
    api: new ApiClient('https://demo.example', 'tok', fetch, false, 200), error: '' });
}
async function render(phone: Verdict | null, body: unknown, status = 200) {
  useSession.setState({ gateVerdict: phone });
  request.mockImplementation(async () => json(body, status));
  await act(async () => { tree = create(<ServerReport />); });
}

beforeEach(() => {
  request = jest.spyOn(globalThis, 'fetch');
  mockSession.activeId = 'intake-1';
  mockStore.latestIntake.mockReset().mockResolvedValue('intake-1'); mockStore.pending.mockReset().mockResolvedValue([]);
});
afterEach(() => { if (tree) act(() => tree.unmount()); request.mockRestore(); useServer.getState().disconnect(); useSession.setState({ gateVerdict: null }); });

const NEVER_SHOWN = ['Subacromial', 'impingement', 'Rotator cuff', 'differential', 'score'];
test('phone SAFE and server READY: muscles are listed, with the demo and doctor notices', async () => {
  connect(); await render('SAFE', READY);
  expect(text()).toContain('Muscles that may be involved');
  expect(text()).toContain('Supraspinatus');
  expect(text()).toContain('No safety stop found by the phone or the server.');
  expect(text()).toContain('Demo only, not for real patients.');
  expect(text()).toContain('talk to a doctor');
  expect(request.mock.calls[0][0]).toBe('https://demo.example/intakes/intake-1/report');
});
test('server REFER is shown as urgent, with no muscles', async () => {
  connect(); await render('SAFE', REFER);
  expect(text()).toContain('Urgent: please see a doctor now.');
  expect(text()).toContain('Please talk to a doctor about your shoulder');
  expect(text()).not.toContain('Muscles that may be involved');
  expect(text()).not.toContain('No safety stop found');
});
test('server INCOMPLETE is not cleared and shows no muscles', async () => {
  connect(); await render('SAFE', INCOMPLETE);
  expect(text()).toContain('Not cleared');
  expect(text()).toContain('Please finish the safety questions');
  expect(text()).not.toContain('Muscles that may be involved');
  expect(text()).not.toContain('No safety stop found');
});
test.each([['CLARIFY', 'Not cleared'], ['RED_FLAG', 'Urgent']] as const)('server READY but the phone says %s: the more cautious result wins, no muscles', async (phone, words) => {
  connect(); await render(phone, READY);
  expect(text()).toContain(words);
  expect(text()).not.toContain('Muscles that may be involved');
  expect(text()).not.toContain('Supraspinatus');
  expect(text()).not.toContain('No safety stop found');
});
test('no phone verdict at all: the server READY is not enough to show muscles', async () => {
  connect(); await render(null, READY);
  expect(text()).not.toContain('Muscles that may be involved');
  expect(text()).not.toContain('No safety stop found');
});
test.each([[401, 'expired'], [403, 'not allowed'], [404, 'failed (404)'], [500, 'failed (500)'], [503, 'failed (503)']] as const)('HTTP %i is "report unavailable", not a result', async (status, words) => {
  connect(); await render('SAFE', { detail: { code: 'X', message: 'secret internals' } }, status);
  expect(text()).toContain('Report unavailable');
  expect(text()).toContain(words);
  expect(text()).toContain('not a result and not a clearance');
  expect(text()).not.toContain('Muscles that may be involved');
  expect(text()).not.toContain('No safety stop found');
  expect(text()).not.toContain('secret internals');
});
test('a network failure is "report unavailable"', async () => {
  connect(); useSession.setState({ gateVerdict: 'SAFE' });
  request.mockRejectedValue(new Error('Network request failed'));
  await act(async () => { tree = create(<ServerReport />); });
  expect(text()).toContain('Report unavailable');
  expect(text()).toContain('Network request failed');
  expect(text()).not.toContain('Muscles that may be involved');
});
test('a stalled server hits the deadline and is "report unavailable"', async () => {
  connect(); useSession.setState({ gateVerdict: 'SAFE' });
  request.mockImplementation((_u: string, init: { signal: AbortSignal }) => new Promise<Response>((_r, rej) =>
    init.signal.addEventListener('abort', () => rej(new Error('The request was aborted')))));
  await act(async () => { tree = create(<ServerReport />); });
  expect(text()).toContain('Loading the report');
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  expect(text()).toContain('Report unavailable');
  expect(text()).not.toContain('Muscles that may be involved');
});
test('a response that carries a differential is rejected whole: nothing from it is shown', async () => {
  connect();
  await render('SAFE', { ...READY, differential: [{ condition: 'Subacromial impingement', reason: 'five features', source: 'Michener 2009' }], score: 0.9 });
  expect(text()).toContain('Report unavailable');
  for (const word of NEVER_SHOWN) expect(text()).not.toContain(word);
  expect(text()).not.toContain('Supraspinatus');
});
test('a report for another assessment is rejected', async () => {
  connect(); await render('SAFE', { ...READY, intakeId: 'someone-elses' });
  expect(text()).toContain('Report unavailable');
  expect(text()).not.toContain('Muscles that may be involved');
});
test('a doctor account does not load the patient report', async () => {
  connect('doctor'); await render('SAFE', READY);
  expect(text()).toContain('A patient account is required');
  expect(request).not.toHaveBeenCalled();
});
test('not connected: nothing is requested', async () => {
  await render('SAFE', READY);
  expect(text()).toContain('Not connected to the server.');
  expect(request).not.toHaveBeenCalled();
  expect(text()).toContain('Demo only, not for real patients.');
});
test('no saved assessment: says so and requests nothing', async () => {
  mockSession.activeId = null; mockStore.latestIntake.mockResolvedValue(null);
  connect(); await render('SAFE', READY);
  expect(text()).toContain('No saved assessment yet');
  expect(request).not.toHaveBeenCalled();
});
