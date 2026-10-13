import { authorizedReport, DoctorReport } from '../src/reports/doctorReport';

const report: DoctorReport = { audience: 'doctor', label: 'draft, awaiting clinician review',
  intakeId: 'fictional', facts: [{ label: 'Side', value: 'Right' }],
  gate: { verdict: 'SAFE', firedRules: [] }, differential: [] };

test.each(['patient', 'anonymous'] as const)('%s cannot invoke differential loader', async (role) => {
  const load = jest.fn(async () => report);
  await expect(authorizedReport({ role, load })).rejects.toThrow('Doctor access');
  expect(load).not.toHaveBeenCalled();
});
test('doctor gets the original server order without client ranking', async () => {
  expect(await authorizedReport({ role: 'doctor', load: async () => report })).toBe(report);
});
test('access denial from server propagates', async () => {
  await expect(authorizedReport({ role: 'doctor', load: async () => { throw new Error('403'); } })).rejects.toThrow('403');
});
