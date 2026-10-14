import { act, create } from 'react-test-renderer';
import DoctorLookup from '../src/app/server/doctor';
import DoctorReportRoute from '../src/app/server/doctor/report';
import DoctorAudit from '../src/app/server/doctor/audit';
import { useServer } from '../src/server/connection';
import { ApiClient } from '../src/storage/apiClient';
import { validAudit } from '../src/reports/validation';
import { useSettings } from '../src/store/settings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

const REPORT = { audience: 'doctor', label: 'draft, awaiting clinician review', intakeId: 'intake-1',
  facts: [{ label: 'Tapped region', value: 'shoulder_right_front' }], gate: { verdict: 'SAFE', firedRules: [] },
  differential: [{ condition: 'Subacromial impingement', reason: 'five of five features', source: 'Michener 2009' }] };
const AUDIT = { intakeId: 'intake-1', ruleVersion: 'shoulder-2',
  gateRuns: [{ id: 1, ts: '2026-10-14T10:00:00+00:00', cause: 'answer_sync', verdict: 'CLARIFY',
    firedRules: [{ ruleId: 'R_TEST', reason: 'an unanswered question', source: 'Test source' }], matchedAnswers: [], ruleVersion: 'shoulder-2' }],
  answerHistory: [{ seq: 1, receivedAt: '2026-10-14T10:00:01+00:00', questionId: 'injury', answer: { questionId: 'injury', state: 'answered', value: false },
    contentVersion: 'shoulder-2', idempotencyKey: 'k1' }],
  contextHistory: [{ seq: 1, receivedAt: '2026-10-14T10:00:02+00:00', context: { regionId: 'shoulder_right_front', appAnswers: [], movements: [{}, {}] },
    contentVersion: 'shoulder-2', idempotencyKey: 'k2' }],
  doctorActions: [{ id: 1, at: '2026-10-14T10:05:00+00:00', doctorId: 'demo-doctor', action: 'viewed_audit' }] };

describe('validAudit', () => {
  test('accepts the server shape', () => expect(validAudit(AUDIT)).toBe(true));
  test.each([
    [{ ...AUDIT, gateRuns: [{ ...AUDIT.gateRuns[0], verdict: 'OK' }] }], [{ ...AUDIT, answerHistory: [{ seq: 'x' }] }], [{ ...AUDIT, doctorActions: null }],
    [{ ...AUDIT, ruleVersion: 3 }], [null], [[]],
  ])('rejects malformed %#', (bad) => expect(validAudit(bad)).toBe(false));
});

let request: jest.SpyInstance;
let tree: ReturnType<typeof create>;
const text = () => JSON.stringify(tree.toJSON());
function connect(role: 'patient' | 'doctor', lookupId = 'intake-1') {
  useServer.setState({ status: 'connected', baseUrl: 'https://demo.example', identity: { id: 'demo', role },
    api: new ApiClient('https://demo.example', 'tok', fetch, false, 200), error: '', lookupId });
}
function serverRole(role: 'patient' | 'doctor', routes: Record<string, [unknown, number?]> = {}) {
  request.mockImplementation(async (url: string) => {
    if (url.endsWith('/auth/me')) return json({ id: 'demo', role });
    for (const [suffix, [body, status]] of Object.entries(routes)) if (url.endsWith(suffix)) return json(body, status ?? 200);
    return json({}, 404);
  });
}
async function render(el: React.ReactElement) { await act(async () => { tree = create(el); }); }
const urls = () => request.mock.calls.map((c) => String(c[0]));

beforeEach(() => { request = jest.spyOn(globalThis, 'fetch'); });
afterEach(() => { if (tree) act(() => tree.unmount()); request.mockRestore(); useServer.getState().disconnect(); });

describe('who may open the doctor screens', () => {
  test.each([['lookup', <DoctorLookup key="a" />], ['report', <DoctorReportRoute key="b" />], ['audit', <DoctorAudit key="c" />]])(
    'a patient account sees "Doctor access required" on the %s screen and nothing is requested', async (_n, el) => {
      connect('patient'); serverRole('patient');
      await render(el);
      expect(text()).toContain('Doctor access required.');
      expect(text()).not.toContain('Subacromial');
      expect(urls().filter((u) => !u.endsWith('/auth/me'))).toEqual([]);
    });
  test.each([['lookup', <DoctorLookup key="a" />], ['report', <DoctorReportRoute key="b" />], ['audit', <DoctorAudit key="c" />]])(
    'not connected: the %s screen says so and requests nothing', async (_n, el) => {
      await render(el);
      expect(text()).toContain('Not connected to the server.');
      expect(request).not.toHaveBeenCalled();
    });
  test('the app role setting cannot make anyone a doctor', async () => {
    useSettings.setState({ signedIn: true });
    connect('patient'); serverRole('patient', { '/doctor-report': [REPORT] });
    await render(<DoctorReportRoute />);
    expect(text()).toContain('Doctor access required.');
    expect(urls().some((u) => u.endsWith('/doctor-report'))).toBe(false);
  });
});

describe('every doctor screen carries the demo notice and the Doctor chip', () => {
  test.each([['lookup', <DoctorLookup key="a" />], ['audit', <DoctorAudit key="c" />]])('%s', async (_n, el) => {
    connect('doctor'); serverRole('doctor', { '/audit': [AUDIT] });
    await render(el);
    expect(text()).toContain('Demo only, not for real patients.');
    expect(text()).toContain('"Doctor"');
    expect(text()).not.toContain('"Patient"');
  });
  test('report screen (existing DoctorReportScreen)', async () => {
    connect('doctor'); serverRole('doctor', { '/doctor-report': [REPORT] });
    await render(<DoctorReportRoute />);
    expect(text()).toContain('Demo only, not for real patients.');
  });
});

describe('assessment lookup', () => {
  test('both actions need an ID and the typed ID is kept for the next screen', async () => {
    connect('doctor', '');
    await render(<DoctorLookup />);
    const button = (l: string) => tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === l)[0];
    expect(button('Doctor report').props.disabled).toBe(true);
    expect(button('Audit trail').props.disabled).toBe(true);
    await act(async () => { tree.root.findAll((n) => (n.type as unknown) === 'TextInput')[0].props.onChangeText('  intake-9  '); });
    expect(button('Doctor report').props.disabled).toBe(false);
    await act(async () => { button('Audit trail').props.onPress(); });
    expect(useServer.getState().lookupId).toBe('intake-9');
  });
});

describe('doctor report', () => {
  test('loads through the existing screen, from the endpoint, for the typed ID', async () => {
    connect('doctor', 'intake-1'); serverRole('doctor', { '/doctor-report': [REPORT] });
    await render(<DoctorReportRoute />);
    expect(text()).toContain('Doctor report');
    expect(text()).toContain('shoulder_right_front');
    expect(text()).toContain('Subacromial impingement');
    expect(urls().filter((u) => u.endsWith('/doctor-report'))).toEqual(['https://demo.example/intakes/intake-1/doctor-report']);
  });
  test('the report is requested once, not on every render', async () => {
    connect('doctor'); serverRole('doctor', { '/doctor-report': [REPORT] });
    await render(<DoctorReportRoute />);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(urls().filter((u) => u.endsWith('/doctor-report')).length).toBe(1);
  });
  test.each([[403], [404], [500]])('HTTP %i shows "unavailable" and no report content', async (status) => {
    connect('doctor'); serverRole('doctor', { '/doctor-report': [{ detail: {} }, status] });
    await render(<DoctorReportRoute />);
    expect(text()).toContain('Doctor report unavailable');
    expect(text()).not.toContain('Subacromial');
  });
  test('a differential on a not-SAFE gate is refused by the existing validation', async () => {
    connect('doctor'); serverRole('doctor', { '/doctor-report': [{ ...REPORT, gate: { verdict: 'CLARIFY', firedRules: [] } }] });
    await render(<DoctorReportRoute />);
    expect(text()).toContain('Doctor report unavailable');
    expect(text()).not.toContain('Subacromial');
  });
});

describe('audit trail', () => {
  test('shows gate runs, answers, snapshots and doctor views, read-only', async () => {
    connect('doctor'); serverRole('doctor', { '/audit': [AUDIT] });
    await render(<DoctorAudit />);
    expect(text()).toContain('Server gate runs (1)');
    expect(text()).toContain('R_TEST (an unanswered question; Test source)');
    expect(text()).toContain('injury = false');
    expect(text()).toContain('shoulder_right_front · 0 app answers · 2 movements');
    expect(text()).toContain('demo-doctor · viewed_audit');
    expect(urls().filter((u) => u.endsWith('/audit'))).toEqual(['https://demo.example/intakes/intake-1/audit']);
    expect(request.mock.calls.every((c) => (c[1]?.method ?? 'GET') === 'GET')).toBe(true);
  });
  test('an unknown answer is shown as unknown, never as a yes or a no', async () => {
    const a = { ...AUDIT, answerHistory: [{ ...AUDIT.answerHistory[0], answer: { questionId: 'injury', state: 'unknown', value: null } }] };
    connect('doctor'); serverRole('doctor', { '/audit': [a] });
    await render(<DoctorAudit />);
    expect(text()).toContain('injury = unknown');
  });
  test.each([[401], [403], [404], [500]])('HTTP %i is "unavailable" and shows no history', async (status) => {
    connect('doctor'); serverRole('doctor', { '/audit': [{ detail: {} }, status] });
    await render(<DoctorAudit />);
    expect(text()).toContain('Audit trail unavailable');
    expect(text()).not.toContain('Server gate runs');
  });
  test('a malformed audit response is rejected whole', async () => {
    connect('doctor'); serverRole('doctor', { '/audit': [{ ...AUDIT, gateRuns: 'x' }] });
    await render(<DoctorAudit />);
    expect(text()).toContain('Audit trail unavailable');
    expect(text()).not.toContain('Server gate runs');
  });
  test('an audit for another assessment is rejected', async () => {
    connect('doctor'); serverRole('doctor', { '/audit': [{ ...AUDIT, intakeId: 'other' }] });
    await render(<DoctorAudit />);
    expect(text()).toContain('Audit trail unavailable');
  });
  test('a network failure is "unavailable"', async () => {
    connect('doctor');
    request.mockRejectedValue(new Error('Network request failed'));
    await render(<DoctorAudit />);
    expect(text()).toContain('Audit trail unavailable');
    expect(text()).toContain('Network request failed');
  });
});
