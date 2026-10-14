import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../__storage_tests__/sqlite';
import { SafetySession } from '../src/gate/safetySession';
import { questions, SafetyAnswer } from '../src/gate/evaluate';
import { useSession } from '../src/store/session';
import { ApiClient } from '../src/storage/apiClient';
import * as SafetyCoordinator from '../src/gate/safetySession';
import { submitMovementDurable, goBackDurable } from '../src/flow/live';
import { loadCases } from '../src/server/cases';

// Run through scripts/check_mobile_sync.py: no mocked HTTP, gate, store or database.
const url = process.env.SHIFA_TEST_API_URL!;
let directory: string;
let opened: ReturnType<typeof openDatabase>;
let session: SafetySession;
let patient: ApiClient;
let doctor: ApiClient;
let otherPatient: ApiClient;
let sequence = 0;
let intakeId: string;
async function login(id: string, role: 'patient' | 'doctor') {
  const response = await fetch(`${url}/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: id, role }) });
  if (!response.ok) throw new Error('Disposable demo sign-in failed.');
  return new ApiClient(url, (await response.json()).token, fetch, true);
}
const negative = (id: string): SafetyAnswer => {
  const q = questions.find((q) => q.questionId === id)!;
  return { questionId: id, type: q.type as SafetyAnswer['type'], value: q.type === 'choice' ? 'normal' : false, state: 'answered' };
};
async function upload() { return opened.store.syncOrdered(intakeId, 'fictional-patient', (e) => patient.send(e)); }
beforeAll(async () => {
  if (!url) throw Error('Run scripts/check_mobile_sync.py to start the isolated server.');
  patient = await login('fictional-patient', 'patient');
  doctor = await login('fictional-doctor', 'doctor');
  otherPatient = await login('fictional-other', 'patient');
});
beforeEach(async () => {
  useSession.getState().reset();
  directory = mkdtempSync(join(tmpdir(), 'shifa-http-'));
  opened = openDatabase(join(directory, 'mobile.db')); await opened.store.initialize();
  useSession.getState().setMode('region');
  useSession.getState().setSelection({ regionId: 'shoulder_right', subRegionId: 'front',
    point: { x: 0, y: 1, z: 0 }, layer: 'muscle', hitStructure: null });
  useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
  session = new SafetySession(opened.store); intakeId = `http-intake-${++sequence}`;
  await session.start(intakeId);
  for (const q of questions.filter((q) => q.required)) await session.save(negative(q.questionId));
  expect((await session.checkpoint()).verdict).toBe('SAFE');
}, 30000);
afterEach(() => { jest.restoreAllMocks(); session.dispose(); opened.db.close(); rmSync(directory, { recursive: true, force: true }); });

test('offline injury clarification survives restart/upload and roles protect reports', async () => {
  session.dispose(); useSession.getState().reset(); opened.db.close();
  opened = openDatabase(join(directory, 'mobile.db')); await opened.store.initialize();
  session = new SafetySession(opened.store);
  expect((await session.resumeLatest()).verdict).toBe('SAFE');
  expect((await upload()).remaining).toBe(0);
  expect(await patient.gate(intakeId)).toEqual(useSession.getState().gateOutput);
  expect((await doctor.doctorReport(intakeId)).intakeId).toBe(intakeId);
  await expect(patient.doctorReport(intakeId)).rejects.toThrow('Doctor access');
  await expect(otherPatient.gate(intakeId)).rejects.toThrow('not allowed');
}, 30000);

test('old negatives never clear new raw weakness; fresh saved follow-ups restore identical SAFE', async () => {
  useSession.getState().recordMovement({ movementId: 'sideways_raise', painful: false, weak: true,
    unableToDo: false, measuredAngle: 80, state: 'answered' });
  expect((await session.checkpoint()).verdict).toBe('CLARIFY');
  await upload();
  expect(await patient.gate(intakeId)).toEqual(useSession.getState().gateOutput);
  for (const id of ['unable', 'numb', 'tingling']) await session.save(negative(id));
  expect((await session.checkpoint()).verdict).toBe('SAFE');
  await upload();
  expect(await patient.gate(intakeId)).toEqual(useSession.getState().gateOutput);
  // Evidence changes after an earlier review require a new review on both sides.
  useSession.getState().recordMovement({ movementId: 'sideways_raise', painful: true, weak: true,
    unableToDo: false, measuredAngle: 60, state: 'answered' });
  expect((await session.checkpoint()).verdict).toBe('CLARIFY');
  await upload();
  expect(await patient.gate(intakeId)).toEqual(useSession.getState().gateOutput);
}, 30000);

test('lost HTTP acknowledgement retries safely; repeated uncertainty and confirmed danger block differential', async () => {
  const first = (await opened.store.pending(intakeId))[0];
  await expect(opened.store.syncOrdered(intakeId, 'fictional-patient', async (event) => {
    await patient.send(event); throw Error('connection lost after server commit');
  })).rejects.toThrow('connection lost');
  expect((await opened.store.pending(intakeId))[0].id).toBe(first.id);
  await upload(); expect((await patient.gate(intakeId)).verdict).toBe('SAFE');
  await session.save({ ...negative('numb'), value: null, state: 'unknown', clarificationAttempted: true });
  await upload();
  expect(await patient.gate(intakeId)).toEqual(useSession.getState().gateOutput);
  expect((await doctor.doctorReport(intakeId)).differential).toEqual([]);
  await session.save({ ...negative('numb'), value: true }); await upload();
  expect((await patient.gate(intakeId)).verdict).toBe('RED_FLAG');
  expect((await doctor.doctorReport(intakeId)).differential).toEqual([]);
}, 30000);

test('live movement/back history and narrowing snapshots survive restart and reach doctor-only audit', async () => {
  jest.spyOn(SafetyCoordinator, 'openSafetySession').mockResolvedValue(session);
  expect((await submitMovementDurable({ movementId: 'sideways_raise', painful: false, weak: false,
    unableToDo: false, measuredAngle: 90, state: 'answered' }, 'no pain')).verdict).toBe('SAFE');
  await session.checkpoint();
  expect((await goBackDurable()).ok).toBe(true);
  await session.checkpoint();
  const before = useSession.getState();
  expect(before.history[0].supersededAt).toBeDefined();
  expect(before.narrowingTrail).toHaveLength(2);
  session.dispose(); useSession.getState().reset(); opened.db.close();
  opened = openDatabase(join(directory, 'mobile.db')); await opened.store.initialize();
  session = new SafetySession(opened.store); await session.resumeLatest();
  expect(useSession.getState().history).toEqual(before.history);
  expect(useSession.getState().narrowingTrail).toEqual(before.narrowingTrail);
  await upload();
  const signIn = await fetch(`${url}/auth/dev-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'fictional-doctor', role: 'doctor' }) });
  const response = await fetch(`${url}/intakes/${intakeId}/audit`, {
    headers: { Authorization: `Bearer ${(await signIn.json()).token}` },
  });
  expect(response.status).toBe(200);
  const audit = await response.json();
  const latest = audit.contextHistory.at(-1).context;
  expect(latest.history).toEqual(before.history);
  expect(latest.narrowingTrail).toEqual(before.narrowingTrail);
  expect(latest.clientGate).toEqual(before.gateOutput);
  expect(audit.answerHistory).toHaveLength(questions.filter((q) => q.required).length);
  expect(audit.gateRuns.length).toBeGreaterThan(0);
}, 30000);

test('the server screens\' API calls work against the real server: sign-in, patient report without differential, doctor audit', async () => {
  await ApiClient.health(url, fetch, true);
  const login = await ApiClient.devLogin(url, 'fictional-patient', 'patient', fetch, true);
  expect(login.identity).toEqual({ id: 'fictional-patient', role: 'patient' });
  // asking for the other role does not change the account's role: the server refuses
  await expect(ApiClient.devLogin(url, 'fictional-patient', 'doctor', fetch, true)).rejects.toThrow('different role');
  await upload();
  const ready = await patient.patientReport(intakeId);
  expect(ready.status).toBe('READY');
  expect(JSON.stringify(ready)).not.toMatch(/differential|condition|score|firedRules/);
  await session.save({ ...negative('numb'), value: true }); await upload();
  const refer = await patient.patientReport(intakeId);
  expect(refer.status).toBe('REFER');
  expect(refer.musclesThatMayBeInvolved).toBeUndefined();
  await expect(otherPatient.patientReport(intakeId)).rejects.toThrow('not allowed');
  const audit = await doctor.audit(intakeId);
  expect(audit.intakeId).toBe(intakeId);
  expect(audit.gateRuns.length).toBeGreaterThan(0);
  await expect(patient.audit(intakeId)).rejects.toThrow('Doctor access');
  const direct = await fetch(`${url}/intakes/${intakeId}/audit`, { headers: { Authorization: `Bearer ${login.token}` } });
  expect(direct.status).toBe(403);
}, 30000);

test('the doctors latest cases come from the seeded demo cases, judged by the real server gate, urgent first', async () => {
  const rows = await loadCases(doctor, []);
  expect(rows.map((r) => [r.id, r.verdict])).toEqual([
    ['demo-case-danger', 'RED_FLAG'], ['demo-case-unsure', 'CLARIFY'], ['demo-case-safe', 'SAFE'],
  ]);
  const report = await doctor.doctorReport('demo-case-danger');
  expect(report.gate.verdict).toBe('RED_FLAG');
  expect(report.differential).toEqual([]);
  const safeReport = await doctor.patientReport('demo-case-safe').catch((e: Error) => e.message);
  expect(safeReport).toMatchObject({ status: 'READY' });
  expect(JSON.stringify(safeReport)).not.toMatch(/differential|condition|score|firedRules/);
}, 30000);
