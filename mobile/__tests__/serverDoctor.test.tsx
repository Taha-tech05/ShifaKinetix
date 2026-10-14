import { act, create } from 'react-test-renderer';
import DoctorLookup from '../src/app/server/doctor';
import * as expoRouter from 'expo-router';
import { candidateIds, loadCases } from '../src/server/cases';
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
  test.each([['cases', <DoctorLookup key="a" />], ['report', <DoctorReportRoute key="b" />], ['audit', <DoctorAudit key="c" />]])(
    'a patient account sees "Doctor access required" on the %s screen and nothing is requested', async (_n, el) => {
      connect('patient'); serverRole('patient');
      await render(el);
      expect(text()).toContain('Doctor access required.');
      expect(text()).not.toContain('Subacromial');
      expect(urls().filter((u) => !u.endsWith('/auth/me'))).toEqual([]);
    });
  test.each([['cases', <DoctorLookup key="a" />], ['report', <DoctorReportRoute key="b" />], ['audit', <DoctorAudit key="c" />]])(
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
  test.each([['cases', <DoctorLookup key="a" />], ['audit', <DoctorAudit key="c" />]])('%s', async (_n, el) => {
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

const GATE = (verdict: string) => ({ verdict, firedRules: verdict === 'SAFE' ? [] : [{ ruleId: 'R', reason: 'r', source: 's', matchedAnswers: [] }] });
/** The server's gate answers for the three demo cases; a case missing here is "not found" (404). */
function gates(table: Record<string, string | number>, role: 'patient' | 'doctor' = 'doctor') {
  request.mockImplementation(async (url: string) => {
    if (url.endsWith('/auth/me')) return json({ id: 'demo', role });
    const m = /\/intakes\/([^/]+)\/gate$/.exec(url);
    if (m) {
      const v = table[decodeURIComponent(m[1])];
      return typeof v === 'string' ? json(GATE(v)) : json({}, typeof v === 'number' ? v : 404);
    }
    return json({}, 404);
  });
}
const order = () => (JSON.stringify(tree.toJSON()).match(/"(?:Urgent|Not sure|Safe|Could not load)"/g) ?? []).map((x) => x.replace(/"/g, ''));

describe('latest cases', () => {
  const ALL = { 'demo-case-safe': 'SAFE', 'demo-case-danger': 'RED_FLAG', 'demo-case-unsure': 'CLARIFY' };
  test('lists the cases urgent first, judged by the server gate, with no ID typing', async () => {
    connect('doctor', ''); gates(ALL);
    await render(<DoctorLookup />);
    expect(order().slice(0, 3)).toEqual(['Urgent', 'Not sure', 'Safe']);
    expect(text()).toContain('Latest cases');
    expect(tree.root.findAll((n) => (n.type as unknown) === 'TextInput')).toHaveLength(0);
    expect(urls().filter((u) => u.endsWith('/gate')).sort()).toEqual(
      ['demo-case-danger', 'demo-case-safe', 'demo-case-unsure'].map((id) => `https://demo.example/intakes/${id}/gate`));
  });
  test('tapping a case opens its doctor report', async () => {
    connect('doctor', ''); gates(ALL);
    const push = jest.spyOn(expoRouter.router, 'push');
    await render(<DoctorLookup />);
    const danger = tree.root.findAll((n) => (n.type as unknown) === 'Pressable' && String(n.props.accessibilityLabel).startsWith('Urgent:'))[0];
    await act(async () => { danger.props.onPress(); });
    expect(useServer.getState().lookupId).toBe('demo-case-danger');
    expect(push).toHaveBeenCalledWith('/server/doctor/report');
    push.mockRestore();
  });
  test('cases uploaded from this phone are listed too, and ranked by their own verdict', async () => {
    connect('doctor', ''); useServer.setState({ recentIntakeIds: ['intake-77'] });
    gates({ ...ALL, 'demo-case-danger': 'SAFE', 'intake-77': 'RED_FLAG' });
    await render(<DoctorLookup />);
    expect(text()).toContain('Uploaded from this phone');
    expect(order()[0]).toBe('Urgent');
    expect(text().indexOf('intake-77')).toBeLessThan(text().indexOf('demo-case-unsure'));
  });
  test('a case the server could not judge is never shown as safe and is not placed after the safe ones', async () => {
    connect('doctor', ''); gates({ 'demo-case-safe': 'SAFE', 'demo-case-danger': 500, 'demo-case-unsure': 'CLARIFY' });
    await render(<DoctorLookup />);
    expect(order().slice(0, 3)).toEqual(['Not sure', 'Could not load', 'Safe']);
  });
  test('if no case can be loaded it says so and shows no verdict', async () => {
    connect('doctor', ''); request.mockImplementation(async (url: string) => url.endsWith('/auth/me') ? json({ id: 'demo', role: 'doctor' }) : json({}, 503));
    await render(<DoctorLookup />);
    expect(text()).toContain('None of the cases could be loaded');
    expect(text()).toContain('This is not a result');
    expect(order().every((x) => x === 'Could not load')).toBe(true);
    expect(text()).not.toContain('"Safe"');
  });
  test('a network failure is not a verdict either', async () => {
    connect('doctor', ''); request.mockRejectedValue(new Error('Network request failed'));
    await render(<DoctorLookup />);
    expect(text()).toContain('None of the cases could be loaded');
  });
  test('cases are not asked for as a patient', async () => {
    connect('patient', ''); gates(ALL, 'patient');
    await render(<DoctorLookup />);
    expect(text()).toContain('Doctor access required.');
    expect(urls().some((u) => u.endsWith('/gate'))).toBe(false);
  });
  test('the list logic: urgent, not sure, unjudged, then safe; ids are not repeated', async () => {
    expect(candidateIds(['demo-case-safe', 'x']).map((c) => c.id)).toEqual(['demo-case-safe', 'x', 'demo-case-danger', 'demo-case-unsure']);
    const api = new ApiClient('https://demo.example', 'tok', fetch, false, 200);
    gates({ a: 'SAFE', b: 'CLARIFY', c: 404, d: 'RED_FLAG', 'demo-case-safe': 'SAFE', 'demo-case-danger': 'SAFE', 'demo-case-unsure': 'SAFE' });
    const rows = await loadCases(api, ['a', 'b', 'c', 'd']);
    expect(rows.slice(0, 4).map((r) => r.verdict)).toEqual(['RED_FLAG', 'CLARIFY', null, 'SAFE']);
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
