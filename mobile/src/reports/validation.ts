import type { GateOutput } from '../gate/evaluate';
import type { DoctorReport } from './doctorReport';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string';
export function validGate(v: unknown): v is GateOutput {
  return record(v) && ['SAFE', 'CLARIFY', 'RED_FLAG'].includes(v.verdict as string)
    && Array.isArray(v.firedRules) && v.firedRules.every((r: unknown) => record(r)
      && text(r.ruleId) && text(r.reason) && text(r.source)
      && Array.isArray(r.matchedAnswers) && r.matchedAnswers.every(text))
    && (v.verdict !== 'SAFE' || v.firedRules.length === 0);
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
