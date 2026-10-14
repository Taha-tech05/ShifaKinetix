import { useEffect, useState } from 'react';
import { AppText } from '../../../components/AppText';
import { Card } from '../../../components/Card';
import type { AuditTrail } from '../../../reports/validation';
import { DoctorRequired, useDoctorApi } from '../../../server/doctorAccess';
import { useServer } from '../../../server/connection';
import { Problem, ServerScreen } from '../../../server/ServerScreen';
import { colors } from '../../../theme';

const shortValue = (v: unknown): string => {
  if (v === null || v === undefined) return 'unknown';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
};

/** Read-only history of one assessment: every server gate run, every answer as received, every context snapshot, every doctor view. */
export default function DoctorAudit() {
  const doctor = useDoctorApi();
  const id = useServer((s) => s.lookupId);
  const [state, setState] = useState<{ audit?: AuditTrail; error?: string }>({});
  const api = doctor?.api;

  useEffect(() => {
    if (!api || !id) return;
    let active = true;
    api.audit(id)
      .then((audit) => { if (active) setState({ audit }); })
      .catch((e: unknown) => { if (active) setState({ error: e instanceof Error ? e.message : 'The audit trail could not be loaded.' }); });
    return () => { active = false; };
  }, [api, id]);

  if (!doctor || !id) return <DoctorRequired title="Audit trail" />;
  const a = state.audit;
  return (
    <ServerScreen title="Audit trail">
      <AppText variant="secondary" color={colors.muted}>{`Assessment ${id}. Read-only. Draft, awaiting clinician review.`}</AppText>
      {!a && !state.error ? <AppText accessibilityRole="alert">Loading the audit trail…</AppText> : null}
      <Problem text={state.error ? `Audit trail unavailable. ${state.error}` : ''} />
      {a ? (
        <>
          <Card>
            <AppText variant="bodyStrong" color={colors.navy}>{`Server gate runs (${a.gateRuns.length})`}</AppText>
            <AppText variant="secondary" color={colors.muted}>{`Rule version ${a.ruleVersion}`}</AppText>
            {a.gateRuns.map((r) => (
              <AppText key={r.id}>{`${r.ts} · ${r.cause} · ${r.verdict}${r.firedRules.length ? ` · ${r.firedRules.map((f) => `${f.ruleId} (${f.reason}; ${f.source})`).join('; ')}` : ''}`}</AppText>
            ))}
          </Card>
          <Card>
            <AppText variant="bodyStrong" color={colors.navy}>{`Answers as received (${a.answerHistory.length})`}</AppText>
            {a.answerHistory.map((x) => (
              <AppText key={x.seq}>{`#${x.seq} ${x.receivedAt} · ${x.questionId} = ${x.answer.state === 'unknown' ? 'unknown' : shortValue(x.answer.value)}`}</AppText>
            ))}
          </Card>
          <Card>
            <AppText variant="bodyStrong" color={colors.navy}>{`Context snapshots (${a.contextHistory.length})`}</AppText>
            {a.contextHistory.map((x) => (
              <AppText key={x.seq}>{`#${x.seq} ${x.receivedAt} · ${shortValue(x.context.regionId)} · ${Array.isArray(x.context.appAnswers) ? x.context.appAnswers.length : 0} app answers · ${Array.isArray(x.context.movements) ? x.context.movements.length : 0} movements`}</AppText>
            ))}
          </Card>
          <Card>
            <AppText variant="bodyStrong" color={colors.navy}>{`Doctor views (${a.doctorActions.length})`}</AppText>
            {a.doctorActions.map((d) => <AppText key={d.id}>{`${d.at} · ${d.doctorId} · ${d.action}`}</AppText>)}
          </Card>
        </>
      ) : null}
    </ServerScreen>
  );
}
