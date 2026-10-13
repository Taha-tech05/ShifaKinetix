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
