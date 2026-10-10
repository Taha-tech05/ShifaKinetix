import { GateOutput } from '../gate/evaluate';

export interface DoctorReport {
  audience: 'doctor';
  label: 'draft, awaiting clinician review';
  intakeId: string;
  facts: { label: string; value: string }[];
  gate: GateOutput;
  differential: { condition: string; reason: string; source: string }[];
}
export interface DoctorReportAccess {
  // Integrator supplies identity from authenticated server session, never a role picker.
  role: 'doctor' | 'patient' | 'anonymous';
  load: () => Promise<DoctorReport>;
}

export async function authorizedReport(access: DoctorReportAccess): Promise<DoctorReport> {
  if (access.role !== 'doctor') throw new Error('Doctor access required.');
  const report = await access.load();
  if (report.audience !== 'doctor' || report.label !== 'draft, awaiting clinician review') {
    throw new Error('Unexpected report audience or review status.');
  }
  return report;
}
