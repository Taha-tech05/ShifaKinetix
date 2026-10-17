import type { DoctorReport } from '../reports/doctorReport';
import { validAudit, validDoctorReport, validGate, validPatientReport } from '../reports/validation';
import type { AuditTrail, PatientReport } from '../reports/validation';
import type { OrderedSyncEvent } from './intakeStore';

/** The API address rules: https, or http only for localhost / private network addresses in development. Returns it without a trailing slash. */
export function checkBaseUrl(baseUrl: string, allowLocalHttp: boolean): string {
  const url = new URL(baseUrl);
  const octets = url.hostname.split('.').map(Number);
  const privateIp = /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)
    && octets.every((n) => n >= 0 && n <= 255)
    && (octets[0] === 10 || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
  const local = ['localhost', '127.0.0.1'].includes(url.hostname) || privateIp;
  if (url.username || url.password || url.search || url.hash
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && allowLocalHttp && local))) {
    throw new Error('Use an HTTPS API address, or a local development server.');
  }
  return url.href.replace(/\/$/, '');
}

export interface ApiIdentity { id: string; role: 'patient' | 'doctor' }
export class ApiClient {
  readonly baseUrl: string;
  constructor(baseUrl: string, private readonly token: string, private readonly request: typeof fetch = fetch,
    allowLocalHttp = false, private readonly timeoutMs = 15000) {
    this.baseUrl = checkBaseUrl(baseUrl, allowLocalHttp);
    if (!token.trim() || /[\r\n]/.test(token)) throw new Error('An access token is required.');
  }
  /** Development sign-in (the server answers 404 unless it was started with SHIFA_DEV_LOGIN=1). The role is only a request: the server fixes it per account. */
  static async devLogin(baseUrl: string, userId: string, role: 'patient' | 'doctor', request: typeof fetch = fetch,
    allowLocalHttp = false, timeoutMs = 15000): Promise<{ token: string; identity: ApiIdentity }> {
    const base = checkBaseUrl(baseUrl, allowLocalHttp);
    if (!userId.trim()) throw new Error('Enter a user name.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(`${base}/auth/dev-login`, { method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: userId.trim(), role }) });
      if (response.status === 404) throw new Error('Development sign-in is switched off on this server. Paste a server-issued access token instead.');
      if (response.status === 409) throw new Error('That user name already belongs to an account with a different role.');
      if (!response.ok) throw new Error(`Sign-in failed (${response.status}).`);
      const v = await response.json() as { token?: unknown; user?: { id?: unknown; role?: unknown } } | null;
      if (!v || typeof v.token !== 'string' || !v.token.trim() || !v.user || typeof v.user.id !== 'string'
        || !['patient', 'doctor'].includes(v.user.role as string)) throw new Error('The server sign-in response was not valid.');
      return { token: v.token, identity: { id: v.user.id, role: v.user.role as ApiIdentity['role'] } };
    } finally { clearTimeout(timer); }
  }
  /** Is a server answering at this address? Only {"status":"ok"} counts. */
  static async health(baseUrl: string, request: typeof fetch = fetch, allowLocalHttp = false, timeoutMs = 8000): Promise<void> {
    const base = checkBaseUrl(baseUrl, allowLocalHttp);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(`${base}/health`, { redirect: 'error', signal: controller.signal });
      const v = response.ok ? await response.json() as { status?: unknown } | null : null;
      if (!v || v.status !== 'ok') throw new Error('No ShifaKinetix server answered at this address.');
    } finally { clearTimeout(timer); }
  }
  private async json(path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.request(`${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${this.token.trim()}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Your server session has expired. Sign in again; saved data is retained.');
        if (response.status === 403) throw new Error('This account is not allowed to access this assessment.');
        if (response.status === 409) throw new Error('The server rejected this event version or key. Saved data is retained.');
        throw new Error(`Server request failed (${response.status}). Retry later; saved data is retained.`);
      }
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async identity(): Promise<ApiIdentity> {
    const v = await this.json('/auth/me') as ApiIdentity | null;
    if (!v || typeof v.id !== 'string' || !v.id || !['patient', 'doctor'].includes(v.role)) {
      throw new Error('Server identity could not be verified.');
    }
    return { id: v.id, role: v.role };
  }
  async send(event: OrderedSyncEvent) {
    const { kind, ...body } = event;
    const value = await this.json(`/sync/${kind === 'context' ? 'context' : 'answers'}`, body);
    const ack = value as Record<string, unknown> | null;
    if (!ack || !['stored', 'duplicate'].includes(ack.status as string)
      || ack.intakeId !== event.intakeId || ack.idempotencyKey !== event.idempotencyKey
      || ack.contentVersion !== event.contentVersion || !Number.isInteger(ack.eventSeq) || Number(ack.eventSeq) <= 0
      || !validGate(ack.gate) || (kind === 'answer' && ack.answerValid !== true)) {
      throw new Error('The server did not confirm this saved event. Upload paused; data retained.');
    }
  }
  async gate(intakeId: string) {
    const value = await this.json(`/intakes/${encodeURIComponent(intakeId)}/gate`);
    if (!validGate(value)) throw new Error('Invalid server safety response.');
    return value;
  }
  /** The patient-safe report. Anything beyond the allowed fields (a differential, a score, a condition name) is rejected whole. */
  async patientReport(intakeId: string): Promise<PatientReport> {
    const value = await this.json(`/intakes/${encodeURIComponent(intakeId)}/report`);
    if (!validPatientReport(value) || value.intakeId !== intakeId) throw new Error('The server report was not in the expected form, so it is not shown.');
    return value;
  }
  async doctorReport(intakeId: string): Promise<DoctorReport> {
    // Server identity and endpoint enforcement, never the app's role picker.
    if ((await this.identity()).role !== 'doctor') throw new Error('Doctor access required.');
    const value = await this.json(`/intakes/${encodeURIComponent(intakeId)}/doctor-report`);
    if (!validDoctorReport(value) || value.intakeId !== intakeId) throw new Error('Invalid doctor report response.');
    return value;
  }
  /** The doctor-only history of one assessment. The server enforces the role; the check here only saves a pointless request. */
  async audit(intakeId: string): Promise<AuditTrail> {
    if ((await this.identity()).role !== 'doctor') throw new Error('Doctor access required.');
    const value = await this.json(`/intakes/${encodeURIComponent(intakeId)}/audit`);
    if (!validAudit(value) || value.intakeId !== intakeId) throw new Error('Invalid audit response.');
    return value;
  }
}
