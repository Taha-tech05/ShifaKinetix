jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), openSafetySession: () => new Promise(() => {}) }));
import { questions } from '../src/gate/evaluate';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { isCluster, narrow, unknownCount } from '../src/dev/narrowingStub';
import type { NarrowingInput } from '../src/dev/narrowingStub';
import { dangerQuestions, unknownDangerQuestions } from '../src/flow/dangerQuestions';
import {
  FORK_QUESTION_ID,
  forkResult,
  isSafe,
  routeAfterGate,
  routeAfterMovement,
  routeAfterSafe,
  runNarrowing,
  suggestDoctor,
} from '../src/flow/intake';
import { SafeGuard } from '../src/flow/SafeGuard';
import { REGION_MAP } from '../src/regions/regionMap';
import { SHOULDER_REGIONS } from '../src/regions/shoulder';
import type { BodySelection } from '../src/regions/types';
import { answered, unknown } from '../src/questions/answer';
import { useSession } from '../src/store/session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const selection: BodySelection = {
  regionId: 'shoulder_right',
  subRegionId: 'back',
  point: { x: -0.15, y: 1.33, z: -0.09 },
  hitStructure: { meshName: REGION_MAP.structures.infraspinatus_muscle_right.meshNames[0], name: 'Infraspinatus Muscle', kind: 'muscle' },
  layer: 'muscle',
};

beforeEach(() => useSession.getState().reset());

describe('fork', () => {
  it('"Yes, I can point exactly" is exact mode', () => {
    const r = forkResult('exact');
    expect(r.mode).toBe('exact');
    expect(r.answer).toMatchObject({ questionId: FORK_QUESTION_ID, state: 'answered', value: 'exact' });
  });
  it('"No, my whole shoulder hurts" is region mode', () => {
    expect(forkResult('region').mode).toBe('region');
  });
  it('"Not sure" is region mode and is stored as unknown, never as a yes or a no', () => {
    const r = forkResult('unsure');
    expect(r.mode).toBe('region');
    expect(r.answer).toMatchObject({ state: 'unknown', value: null });
  });
});

describe('gate routing', () => {
  it('RED_FLAG goes to the urgent screen', () => {
    expect(routeAfterGate('RED_FLAG', false)).toBe('/report/urgent');
    expect(routeAfterGate('RED_FLAG', true)).toBe('/report/urgent');
  });
  it('CLARIFY goes to the re-ask once, then to "see a doctor"', () => {
    expect(routeAfterGate('CLARIFY', false)).toBe('/report/reask');
    expect(routeAfterGate('CLARIFY', true)).toBe('/report/unclear');
  });
  it('SAFE goes to the safe screen, then to questions (exact) or movements (region)', () => {
    expect(routeAfterGate('SAFE', false)).toBe('/report/safe');
    expect(routeAfterSafe('exact')).toBe('/report/followup');
    expect(routeAfterSafe('region')).toBe('/report/movement?i=0');
  });
  it('six movements, then the follow-up questions', () => {
    expect(routeAfterMovement(0)).toBe('/report/movement?i=1');
    expect(routeAfterMovement(4)).toBe('/report/movement?i=5');
    expect(routeAfterMovement(5)).toBe('/report/followup');
  });
});

describe('movements and narrowing are unreachable unless the verdict is SAFE', () => {
  const base = () => {
    const s = useSession.getState();
    s.setMode('region');
    s.setSelection(selection);
    return useSession.getState();
  };

  it('only SAFE counts as safe', () => {
    expect(isSafe('SAFE')).toBe(true);
    for (const v of ['RED_FLAG', 'CLARIFY', null] as const) expect(isSafe(v)).toBe(false);
  });

  it('narrowing does not run without a verdict, or on RED_FLAG or CLARIFY', () => {
    const state = base();
    expect(runNarrowing(state)).toBeNull();
    for (const gateVerdict of ['RED_FLAG', 'CLARIFY'] as const) expect(runNarrowing({ ...state, gateVerdict })).toBeNull();
  });

  it('narrowing runs on SAFE and returns candidates', () => {
    const out = runNarrowing({ ...base(), gateVerdict: 'SAFE' });
    expect(out).not.toBeNull();
    expect(out!.candidates.length).toBeGreaterThanOrEqual(1);
  });

  it('a screen guarded by SafeGuard shows a redirect, not its content, unless the verdict is SAFE', () => {
    const render = () => {
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(<SafeGuard>{'protected content' as unknown as React.ReactNode}</SafeGuard>);
      });
      return tree;
    };
    const redirects = (tree: ReturnType<typeof create>) => tree.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Redirect').map((n) => n.props.href);

    expect(redirects(render())).toEqual(['/report/danger']); // no verdict yet
    act(() => useSession.setState({ gateVerdict: 'RED_FLAG' }));
    expect(redirects(render())).toEqual(['/report/urgent']);
    act(() => useSession.setState({ gateVerdict: 'CLARIFY', reaskDone: false }));
    expect(redirects(render())).toEqual(['/report/reask']);
    act(() => useSession.setState({ gateVerdict: 'CLARIFY', reaskDone: true }));
    expect(redirects(render())).toEqual(['/report/unclear']);
    act(() => useSession.setState({ gateVerdict: 'SAFE' }));
    const pending = render();
    expect(redirects(pending)).toEqual([]);
    expect(JSON.stringify(pending.toJSON())).not.toContain('protected content');
  });
});

describe('sourced red-flag questions and the real gate', () => {
  it('uses the sourced questions from shared/questions_shoulder.json', () => {
    const qs = dangerQuestions();
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(qs.some((q) => q.isKeyDangerQuestion)).toBe(true);
    for (const q of qs) expect(q.source).toMatch(/^https:\/\//);
  });

  it('a "yes" to a key danger question is RED_FLAG', () => {
    const s = useSession.getState();
    const [a] = dangerQuestions().filter((q) => q.isKeyDangerQuestion);
    s.recordAnswer(answered(a, true));
    expect(useSession.getState().runGate()).toBe('RED_FLAG');
  });

  it('"not sure" to a key danger question is CLARIFY and comes back for the re-ask, never SAFE', () => {
    const s = useSession.getState();
    const [a] = dangerQuestions().filter((q) => q.isKeyDangerQuestion);
    s.recordAnswer(unknown(a));
    expect(useSession.getState().runGate()).toBe('CLARIFY');
    expect(unknownDangerQuestions(useSession.getState().answers).map((q) => q.questionId)).toEqual([a.questionId]);
  });

  it('resolved clarification can be SAFE; repeated uncertainty requires review', () => {
    const s = useSession.getState();
    for(const q of questions.filter(q => q.required)) s.recordAnswer({questionId:q.questionId,type:q.type,value:null,state:'unknown'});
    expect(s.runGate()).toBe('CLARIFY');
    for(const q of questions.filter(q => q.required)) s.recordAnswer({questionId:q.questionId,type:q.type,value:null,state:'unknown',clarificationAttempted:true});
    expect(s.runGate()).toBe('CLARIFY');
    for(const q of questions.filter(q => q.required)) s.recordAnswer({questionId:q.questionId,type:q.type,value:q.type==='choice'?'normal':false,state:'answered',clarificationAttempted:true});
    expect(s.runGate()).toBe('SAFE');
  });
});

describe('dummy narrowing', () => {
  const input = (over: Partial<NarrowingInput> = {}): NarrowingInput => ({
    layer: 'muscle',
    regionId: 'shoulder_right',
    subRegionId: 'back',
    point: selection.point,
    hitMeshName: selection.hitStructure!.meshName,
    depthAnswer: { state: 'answered', value: 'deep_inside' },
    movementResults: [],
    ...over,
  });

  it('returns 1 to 3 candidates with the agreed shape, for every side and sub-region', () => {
    for (const r of SHOULDER_REGIONS) {
      const out = narrow(input({ regionId: r.regionId, subRegionId: r.subRegionId, hitMeshName: null }));
      out.candidates = out.candidates.filter((c) => c.kind !== 'category'); // the muscles; the structure types are tested in structureType.test.tsx
      expect(out.candidates.length).toBeGreaterThanOrEqual(1);
      expect(out.candidates.length).toBeLessThanOrEqual(3);
      expect(typeof out.cluster).toBe('boolean');
      for (const c of out.candidates) {
        expect(REGION_MAP.structures[c.muscleId]).toBeDefined();
        expect(c.confidence).toBeGreaterThan(0);
        expect(c.confidence).toBeLessThanOrEqual(1);
        expect(c.reason).toMatch(/may be involved/i);
        expect(c.reason).not.toMatch(/diagnos|you have|caused by/i);
      }
    }
  });

  it('is deterministic', () => {
    expect(narrow(input())).toEqual(narrow(input()));
  });

  it('unknown answers never change the candidates: a skip or "Not sure" is not a "no" and lowers nothing', () => {
    const base = narrow(input());
    const unsure = narrow(input({ depthAnswer: { state: 'unknown', value: null }, movementResults: [{ movementId: 'sideways_raise', painful: false, weak: false, unableToDo: false, measuredAngle: null, state: 'unknown' }] }));
    expect(unsure).toEqual(base); // same muscles, same strengths, same order
    expect(unknownCount(input())).toBe(0);
  });

  it('puts the muscle under the finger first in exact mode', () => {
    const mesh = REGION_MAP.structures.teres_minor_muscle_right.meshNames[0];
    expect(narrow(input({ hitMeshName: mesh })).candidates[0].muscleId).toBe('teres_minor_muscle_right');
  });

  it('returns a cluster when two candidates tie, and suggests a doctor', () => {
    expect(isCluster([{ confidence: 0.6 }, { confidence: 0.59 }])).toBe(true);
    expect(isCluster([{ confidence: 0.6 }, { confidence: 0.4 }])).toBe(false);
    expect(isCluster([{ confidence: 0.6 }])).toBe(false);
    expect(suggestDoctor({ candidates: [{ muscleId: 'a', confidence: 0.8, reason: '' }], cluster: true })).toBe(true);
  });

  it('low confidence suggests a doctor; high confidence without a cluster does not', () => {
    expect(suggestDoctor({ candidates: [{ muscleId: 'a', confidence: 0.3, reason: '' }], cluster: false })).toBe(true);
    expect(suggestDoctor({ candidates: [{ muscleId: 'a', confidence: 0.8, reason: '' }], cluster: false })).toBe(false);
    expect(suggestDoctor({ candidates: [], cluster: false })).toBe(true);
  });
});

describe('every screen that needs the verdict SAFE is wrapped in SafeGuard', () => {
  // A source check, so a new or edited screen cannot silently open movements or the result without the gate.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'report', f), 'utf8');
  it.each(['movement.tsx', 'feel.tsx', 'followup.tsx', 'result.tsx', 'choice.tsx', 'assistant.tsx', 'safe.tsx'])('%s', (file) => {
    expect(read(file)).toContain('<SafeGuard>');
  });
});
