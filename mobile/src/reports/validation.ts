import type { GateOutput } from '../gate/evaluate';
import type { DoctorReport } from './doctorReport';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
const LEVELS = ['EMERGENCY', 'URGENT', 'SOON', 'ROUTINE'];
const points = (r: Record<string, unknown>) => typeof r.points === 'number' && Number.isFinite(r.points);
/** A gate output (contract v2). SAFE may list weighted signs (with points) for its SOON level, never a stop or a missing answer. */
export function validGate(v: unknown): v is GateOutput {
  return record(v) && ['SAFE', 'CLARIFY', 'RED_FLAG'].includes(v.verdict as string)
    && (v.level === undefined || v.level === null || LEVELS.includes(v.level as string))
    && Array.isArray(v.firedRules) && v.firedRules.every((r: unknown) => record(r)
      && text(r.ruleId) && text(r.reason) && text(r.source)
      && Array.isArray(r.matchedAnswers) && r.matchedAnswers.every(text)
      && (r.points === undefined || points(r)) && (r.level === undefined || LEVELS.includes(r.level as string)))
    && (v.verdict !== 'SAFE' || v.firedRules.every((r) => record(r) && points(r) && r.level === undefined));
}
export function validDoctorReport(v: unknown): v is DoctorReport {
  return record(v) && v.audience === 'doctor' && v.label === 'draft, awaiting clinician review'
    && text(v.intakeId) && validGate(v.gate)
    && Array.isArray(v.facts) && v.facts.every((f: unknown) => record(f) && text(f.label) && text(f.value))
    && Array.isArray(v.differential) && v.differential.every((d: unknown) => record(d)
      && text(d.condition) && text(d.reason) && text(d.source))
    && (v.gate.verdict === 'SAFE' || v.differential.length === 0);
}

export interface PatientReport {
  audience: 'patient';
  intakeId: string;
  banner: string;
  talkToDoctor: true;
  status: 'READY' | 'REFER' | 'INCOMPLETE';
  /** READY only. */
  musclesThatMayBeInvolved?: string[];
  cluster?: boolean;
  guidance?: string;
  /** REFER and INCOMPLETE only. */
  message?: string;
}
const PATIENT_KEYS = ['audience', 'intakeId', 'banner', 'talkToDoctor', 'status', 'musclesThatMayBeInvolved', 'cluster', 'guidance', 'message'];
/**
 * The patient report, checked against an allow-list of fields. Anything else (a differential, a condition name, a score, fired
 * rules, a write-up) makes the whole response invalid, so the patient app can neither receive nor show it.
 */
export function validPatientReport(v: unknown): v is PatientReport {
  if (!record(v) || Object.keys(v).some((k) => !PATIENT_KEYS.includes(k))) return false;
  if (v.audience !== 'patient' || !text(v.intakeId) || !text(v.banner) || v.talkToDoctor !== true) return false;
  if (v.status === 'READY') {
    return Array.isArray(v.musclesThatMayBeInvolved) && v.musclesThatMayBeInvolved.every(text)
      && typeof v.cluster === 'boolean' && text(v.guidance) && v.message === undefined;
  }
  if (v.status === 'REFER' || v.status === 'INCOMPLETE') {
    return text(v.message) && v.message.length > 0 && v.musclesThatMayBeInvolved === undefined
      && v.cluster === undefined && v.guidance === undefined;
  }
  return false;
}

export interface AuditTrail {
  intakeId: string;
  ruleVersion: string;
  gateRuns: { id: number; ts: string; cause: string; verdict: 'SAFE' | 'CLARIFY' | 'RED_FLAG'; firedRules: { ruleId: string; reason: string; source: string }[]; ruleVersion: string }[];
  answerHistory: { seq: number; receivedAt: string; questionId: string; answer: Record<string, unknown>; contentVersion: string; idempotencyKey: string }[];
  contextHistory: { seq: number; receivedAt: string; context: Record<string, unknown>; contentVersion: string; idempotencyKey: string }[];
  doctorActions: { id: number; at: string; doctorId: string; action: string }[];
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const list = (v: unknown, each: (item: Record<string, unknown>) => boolean): boolean =>
  Array.isArray(v) && v.every((item: unknown) => record(item) && each(item));
/** The doctor's history of one assessment, checked field by field. Anything unexpected makes the whole response invalid. */
export function validAudit(v: unknown): v is AuditTrail {
  return record(v) && text(v.intakeId) && text(v.ruleVersion)
    && list(v.gateRuns, (r) => num(r.id) && text(r.ts) && text(r.cause) && ['SAFE', 'CLARIFY', 'RED_FLAG'].includes(r.verdict as string) && text(r.ruleVersion)
      && list(r.firedRules, (f) => text(f.ruleId) && text(f.reason) && text(f.source)))
    && list(v.answerHistory, (a) => num(a.seq) && text(a.receivedAt) && text(a.questionId) && record(a.answer) && text(a.contentVersion) && text(a.idempotencyKey))
    && list(v.contextHistory, (c) => num(c.seq) && text(c.receivedAt) && record(c.context) && text(c.contentVersion) && text(c.idempotencyKey))
    && list(v.doctorActions, (d) => num(d.id) && text(d.at) && text(d.doctorId) && text(d.action));
}
