import testCases from '../../shared/gate_test_cases.json';
import { Answer, evaluate } from '../src/gate/evaluate';

describe('gate (placeholder data, draft, awaiting clinician review)', () => {
  test.each(testCases.cases)('$caseId: $description', (c) => {
    const result = evaluate(c.answers as Answer[]);
    expect(result.verdict).toBe(c.expectedVerdict);
    if ('mustNotBe' in c) {
      expect(result.verdict).not.toBe(c.mustNotBe);
    }
  });
});
