import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import config from '../../shared/narrowing_config.json';
import bankFile from '../../shared/narrowing_bank_shoulder.json';
import { narrow } from '../src/dev/narrowingStub';
import type { NarrowingInput, NarrowingOutput } from '../src/dev/narrowingStub';
import { routeAfterGate } from '../src/flow/intake';
import { Q_ONSET_SUDDEN_TRAUMA, Q_UNABLE_TO_MOVE_ARM, structuredGateInputs } from '../src/flow/gateInputs';
import { liveSteps, nextStepIndex, submitMovement, submitQuestion, totalSteps } from '../src/flow/live';
import { evaluate } from '../src/gate/evaluate';
import { getLanguage, setLanguage } from '../src/i18n';
import { buildMovementResult } from '../src/movement/result';
import { discriminatorIds, discriminatorQuestions, looksDoubleBarrelled, questionText, supportsOf } from '../src/narrowing/bank';
import { bandOf, NARROWING } from '../src/narrowing/config';
import { counts, evaluateLive } from '../src/narrowing/live';
import { evidenceFrom, strengthOf } from '../src/narrowing/scoring';
import { answered, unknown } from '../src/questions/answer';
import { REGION_MAP } from '../src/regions/regionMap';
import type { BodySelection } from '../src/regions/types';
import { narrowingInputFrom, useSession } from '../src/store/session';
import { CandidateStrip } from '../src/components/narrowing/CandidateStrip';
import { en } from '../src/i18n/en';
import { ur } from '../src/i18n/ur';
import { roman } from '../src/i18n/roman';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The narrowing function is counted, but the real one runs.
jest.mock('../src/dev/narrowingStub', () => {
  const actual = jest.requireActual('../src/dev/narrowingStub');
  return { ...actual, narrow: jest.fn(actual.narrow) };
});
// The 3D stage needs the GL runtime; a stand-in is enough for the screens.
jest.mock('../src/components/movement/MovementStage', () => ({ MovementStage: () => null }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');
const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

const selection: BodySelection = {
  regionId: 'shoulder_right',
  subRegionId: 'top',
  point: { x: -0.17, y: 1.4, z: -0.03 },
  hitStructure: null,
  layer: 'muscle',
};
const narrowSpy = narrow as unknown as jest.Mock;
const realRunGate = useSession.getState().runGate; // tests below replace it; every test starts with the real one

const painful = (movementId: string) => buildMovementResult(movementId, { kind: 'felt', pain: true, weak: false, couldNot: false });
const fine = (movementId: string) => buildMovementResult(movementId, { kind: 'felt', pain: false, weak: false, couldNot: false });
const skipped = (movementId: string) => buildMovementResult(movementId, { kind: 'skip' });
const q = (id: string) => discriminatorQuestions().find((x) => x.questionId === id)!;
/** Structure-type answers under which muscle or tendon leads, so that muscles may be shown (shared/structure_type_bank_shoulder.json). */
const MT = (): NarrowingInput['answers'] => [
  { questionId: 'Q_ST_PASSIVE_BETTER', type: 'yesno', value: true, state: 'answered' },
  { questionId: 'Q_ST_BONE_POINT', type: 'yesno', value: false, state: 'answered' },
  { questionId: 'Q_ST_TINGLE', type: 'yesno', value: false, state: 'answered' },
];
const input = (over: Partial<NarrowingInput> = {}): NarrowingInput => ({
  layer: 'muscle',
  regionId: 'shoulder_right',
  subRegionId: 'top',
  point: selection.point,
  hitMeshName: null,
  depthAnswer: null,
  movementResults: [],
  ...over,
  answers: [...(MT() ?? []), ...(over.answers ?? [])],
});

beforeEach(() => {
  useSession.setState({ runGate: realRunGate });
  useSession.getState().reset();
  useSession.getState().setSelection(selection);
  useSession.getState().setMode('region');
  useSession.setState({ gateVerdict: 'SAFE' });
  narrowSpy.mockClear();
});
afterEach(() => setLanguage('en'));

describe('the bank: one idea per question, fixed, labelled as a placeholder', () => {
  it('has no double-barrelled question, in any language', () => {
    for (const lang of ['en', 'ur', 'roman'] as const) {
      for (const text of discriminatorQuestions(lang).map((x) => x.text)) expect(text.length).toBeGreaterThan(5);
    }
    for (const x of discriminatorQuestions('en')) expect(looksDoubleBarrelled(x.text)).toBe(false);
    expect(looksDoubleBarrelled('Is it worse lifting overhead or rotating outward?')).toBe(true);
  });

  it('the example from the brief is split into two questions with one idea each', () => {
    expect(questionText('Q_DQ_OVERHEAD', 'en')).toBe('Is it worse when you lift your arm overhead?');
    expect(questionText('Q_DQ_ROTATE_OUT', 'en')).toBe('Is it worse when you turn your arm outward?');
    expect(bankFile.audit.split[0].into).toEqual(['Q_DQ_OVERHEAD', 'Q_DQ_ROTATE_OUT']);
  });

  it('ids are unique, every supported muscle exists on both sides, answers are yes / no / not sure', () => {
    const ids = discriminatorIds();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      for (const side of ['right', 'left'] as const) {
        const s = supportsOf(id, side);
        expect(s.length).toBeGreaterThan(0);
        for (const m of s) {
          expect(REGION_MAP.structures[m]?.kind).toBe('muscle');
          expect(REGION_MAP.structures[m].side).toBe(side);
        }
      }
    }
    for (const x of discriminatorQuestions()) expect(x.type).toBe('yesno');
  });

  it('is labelled placeholder and never claims clinical validation', () => {
    expect(bankFile.label).toBe('placeholder - draft from published sources, awaiting clinician review');
    expect(config.label).toBe('placeholder - draft from published sources, awaiting clinician review');
    expect(JSON.stringify(bankFile) + JSON.stringify(config)).not.toMatch(/doctor-validated/i);
    for (const x of discriminatorQuestions()) expect(x.label).toBe(bankFile.label);
  });

  it('the margin, the cap and the minimum answers come from shared/ (one source of truth)', () => {
    expect(NARROWING.leadMargin).toBe(config.leadMargin);
    expect(NARROWING.maxQuestions).toBe(config.maxQuestions);
    expect(NARROWING.minNonUnknownAnswers).toBe(config.minNonUnknownAnswers);
    expect(NARROWING.minNonUnknownAnswers).toBeGreaterThanOrEqual(2);
    for (const f of ['narrowing/live.ts', 'flow/live.ts', 'dev/narrowingStub.ts', 'narrowing/scoring.ts', 'app/report/movement.tsx', 'app/report/result.tsx']) {
      expect(src(f)).not.toMatch(new RegExp(`\\b${config.leadMargin}\\b`)); // no copy of the number
    }
    const structureSteps = liveSteps('region').filter((x) => x.kind === 'structure').length;
    expect(totalSteps('region')).toBe(Math.min(config.structureType.maxQuestions, structureSteps) + Math.min(config.maxQuestions, liveSteps('region').length - structureSteps));
  });
});

describe('unknown (Not sure, Skip) is never a "no" and never lowers a candidate', () => {
  it('a skipped movement is not a criterion at all', () => {
    expect(evidenceFrom([skipped('sideways_raise')], [], 'right')).toEqual([]);
    expect(skipped('sideways_raise').state).toBe('unknown');
  });

  it('adding skips and "Not sure" answers changes no candidate, no strength, no order', () => {
    const base = [painful('sideways_raise'), fine('forward_raise')];
    const baseAnswers = [answered(q('Q_DQ_OVERHEAD'), true)];
    const a = narrow(input({ movementResults: base, answers: baseAnswers }));
    const more = narrow(
      input({
        movementResults: [...base, skipped('can_position_hold'), skipped('belly_press'), buildMovementResult('hand_behind_back', { kind: 'unsure' })],
        answers: [...baseAnswers, unknown(q('Q_DQ_ROTATE_OUT')), unknown(q('Q_DQ_NIGHT'))],
      }),
    );
    expect(more).toEqual(a);
  });

  it('a real "no" does lower a candidate, so unknown and no are different', () => {
    const yes = narrow(input({ movementResults: [painful('sideways_raise')] })).candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    const no = narrow(input({ movementResults: [painful('sideways_raise')], answers: [answered(q('Q_DQ_NIGHT'), false)] })).candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    const unsure = narrow(input({ movementResults: [painful('sideways_raise')], answers: [unknown(q('Q_DQ_NIGHT'))] })).candidates.find((c) => c.muscleId === 'supraspinatus_muscle_right')!;
    expect(no.confidence).toBeLessThan(yes.confidence);
    expect(unsure.confidence).toBe(yes.confidence);
  });

  it('the strength formula has no input for how many answers were unknown', () => {
    expect(strengthOf.length).toBe(3); // matched, unmatched, prior
    expect(strengthOf(2, 0, 0.02)).toBeGreaterThan(strengthOf(1, 0, 0.02));
    expect(strengthOf(1, 1, 0.02)).toBeLessThan(strengthOf(1, 0, 0.02));
  });
});

describe('the narrowing interface is unchanged (a replacement can drop the optional extras)', () => {
  it('takes one input and returns {candidates: [{muscleId, confidence, reason}], cluster}', () => {
    const real = jest.requireActual('../src/dev/narrowingStub') as { narrow: (i: NarrowingInput) => NarrowingOutput };
    expect(real.narrow.length).toBe(1);
    const out = real.narrow(input());
    expect(typeof out.cluster).toBe('boolean');
    for (const c of out.candidates) {
      expect(typeof c.muscleId).toBe('string');
      expect(typeof c.confidence).toBe('number');
      expect(typeof c.reason).toBe('string');
    }
  });

  it('the live engine still works when the narrowing returns no matched / unmatched fields and no categories', () => {
    narrowSpy.mockImplementationOnce(() => ({ candidates: [{ muscleId: 'supraspinatus_muscle_right', confidence: 0.9, reason: 'x' }], cluster: false }));
    const s = evaluateLive(input({ movementResults: [painful('sideways_raise'), painful('can_position_hold')] }));
    expect(s.candidates.map((c) => c.muscleId)).toEqual(['supraspinatus_muscle_right']); // shown as possible so far
    expect(s.provisional).toBe(true);
    expect(s.stop).toBe(false); // nothing matched is reported, so it never claims "enough"
  });
});

describe('live narrowing: when the list appears, when it stops', () => {
  const bare = (over: Partial<NarrowingInput> = {}): NarrowingInput => ({ ...input(), answers: [], ...over });

  it('shows provisional candidates from the first screen, seeded from the tapped area, with no bands before two real answers', () => {
    let s = evaluateLive(bare());
    expect(s.candidates.length).toBeGreaterThan(0);
    expect(s.candidates.length).toBeLessThanOrEqual(3);
    expect(s.provisional).toBe(true);
    expect(s.bandsVisible).toBe(false);
    expect(s.status).toBe('narrowing');
    s = evaluateLive(bare({ movementResults: [painful('sideways_raise'), skipped('forward_raise'), skipped('can_position_hold')] }));
    expect(counts(bare({ movementResults: [painful('sideways_raise'), skipped('forward_raise'), skipped('can_position_hold')] }))).toEqual({ asked: 3, nonUnknown: 1 });
    expect(s.candidates.length).toBeGreaterThan(0); // after a skip too, without waiting for the end
    expect(s.bandsVisible).toBe(false);
    s = evaluateLive(bare({ movementResults: [painful('sideways_raise'), painful('can_position_hold')] }));
    expect(s.bandsVisible).toBe(true); // two answers that are not unknown (movements and questions together)
    expect(s.provisional).toBe(true);
  });

  it('the tapped muscle is the seed in exact mode, and the candidates are the muscles of the tapped area otherwise', () => {
    const mesh = REGION_MAP.structures.teres_minor_muscle_right.meshNames[0];
    expect(evaluateLive(bare({ hitMeshName: mesh, subRegionId: 'back' })).candidates[0].muscleId).toBe('teres_minor_muscle_right');
    const area = new Set(['supraspinatus_muscle_right', 'acromial_part_of_deltoid_muscle_right', 'descending_part_of_trapezius_muscle_right', 'levator_scapulae_right', 'omohyoid_muscle_right']);
    for (const c of evaluateLive(bare({ subRegionId: 'top' })).candidates) expect(area.has(c.muscleId)).toBe(true);
  });

  it('stops early when the top candidate leads by the margin with enough matched criteria: one muscle', () => {
    const s = evaluateLive(input({ movementResults: [painful('sideways_raise'), painful('can_position_hold')], answers: [answered(q('Q_DQ_NIGHT'), true)] }));
    expect(s.status).toBe('enough');
    expect(s.stop).toBe(true);
    expect(s.cluster).toBe(false);
    expect(s.candidates).toHaveLength(1);
    expect(s.candidates[0].muscleId).toBe('supraspinatus_muscle_right');
    expect(s.candidates[0].matched.length).toBeGreaterThanOrEqual(NARROWING.minMatchedCriteria);
  });

  it('does not stop on a single match even if nothing else competes (not enough matched criteria)', () => {
    const s = evaluateLive(input({ movementResults: [painful('sideways_raise'), fine('belly_press')] }));
    expect(s.stop).toBe(false);
    expect(s.status).toBe('continue');
  });

  it('keeps going while two muscles are close (no separation)', () => {
    const s = evaluateLive(input({ movementResults: [painful('sideways_raise')], answers: [answered(q('Q_DQ_OVERHEAD'), true)] }));
    expect(s.stop).toBe(false);
    expect(s.candidates.length).toBeGreaterThan(1);
    expect(s.cluster).toBe(true);
  });

  it('stops at the cap, and not-separated candidates are shown as one cluster, not as one muscle', () => {
    const results = [painful('sideways_raise'), skipped('forward_raise'), skipped('can_position_hold'), skipped('outward_push_elbow_at_side'), skipped('belly_press'), skipped('hand_behind_back')];
    const answers = [answered(q('Q_DQ_OVERHEAD'), true), unknown(q('Q_DQ_ROTATE_OUT')), unknown(q('Q_DQ_ROTATE_IN'))];
    const s = evaluateLive(input({ movementResults: results, answers }));
    expect(s.asked).toBe(NARROWING.maxQuestions);
    expect(s.status).toBe('capped');
    expect(s.stop).toBe(true);
    expect(s.cluster).toBe(true);
    expect(s.candidates.length).toBeGreaterThan(1);
    const before = evaluateLive(input({ movementResults: results.slice(0, 5), answers: [answers[0]] }));
    expect(before.stop).toBe(false); // one question fewer: not at the cap
  });

  it('when the question set is finished the candidates stop being provisional', () => {
    const results = ['sideways_raise', 'forward_raise', 'can_position_hold', 'outward_push_elbow_at_side', 'belly_press', 'hand_behind_back'].map(skipped);
    const s = evaluateLive(input({ movementResults: results, answers: [unknown(q('Q_DQ_OVERHEAD')), unknown(q('Q_DQ_NIGHT')), unknown(q('Q_DQ_CARRY'))] }));
    expect(s.stop).toBe(true);
    expect(s.provisional).toBe(false);
  });

  it('bands are qualitative: low, moderate, higher', () => {
    expect(bandOf(0.1)).toBe('low');
    expect(bandOf(NARROWING.bands.moderateFrom)).toBe('moderate');
    expect(bandOf(NARROWING.bands.higherFrom)).toBe('higher');
    expect(bandOf(1)).toBe('higher');
  });

  it('works for the left side with the matching left muscles', () => {
    const s = evaluateLive(input({ regionId: 'shoulder_left', movementResults: [painful('sideways_raise'), painful('can_position_hold')], answers: [answered(q('Q_DQ_NIGHT'), true)] }));
    expect(s.candidates[0].muscleId).toBe('supraspinatus_muscle_left');
  });
});

describe('the live driver: narrowing and the gate run after every answer', () => {
  it('calls the narrowing after every movement and question, including skips and "Not sure"', () => {
    submitMovement(painful('sideways_raise'), 'pain');
    submitMovement(skipped('forward_raise'), 'skip');
    submitMovement(buildMovementResult('can_position_hold', { kind: 'unsure' }), 'unsure');
    submitQuestion(answered(q('Q_DQ_OVERHEAD'), true));
    submitQuestion(unknown(q('Q_DQ_ROTATE_OUT')));
    expect(narrowSpy).toHaveBeenCalledTimes(5);
  });

  it('runs the gate after every answer, through the existing interface', () => {
    const runGate = jest.fn(() => 'SAFE' as const);
    useSession.setState({ runGate });
    submitMovement(painful('sideways_raise'), 'pain');
    submitMovement(skipped('forward_raise'), 'skip');
    submitQuestion(answered(q('Q_DQ_NIGHT'), false));
    submitQuestion(unknown(q('Q_DQ_CARRY')));
    expect(runGate).toHaveBeenCalledTimes(4);
  });

  it('RED_FLAG stops the flow and routes where the existing code routes; no narrowing runs', () => {
    useSession.setState({ runGate: jest.fn(() => 'RED_FLAG' as const) });
    const out = submitMovement(painful('sideways_raise'), 'pain');
    expect(out.verdict).toBe('RED_FLAG');
    expect(out.route).toBe(routeAfterGate('RED_FLAG', false));
    expect(out.route).toBe('/report/urgent');
    expect(out.state).toBeNull();
    expect(narrowSpy).not.toHaveBeenCalled();
    expect(nextStepIndex('region', 0, out)).toBeNull();
  });

  it('CLARIFY routes to the re-ask like the rest of the flow', () => {
    useSession.setState({ runGate: jest.fn(() => 'CLARIFY' as const) });
    expect(submitQuestion(unknown(q('Q_DQ_NIGHT'))).route).toBe('/report/reask');
  });

  it('the real gate stub sees the structured inputs (answers plus the derived onset and unable-to-move)', () => {
    useSession.getState().recordAnswer({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value: 'after_injury', state: 'answered' });
    const seen: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stub = require('../src/gate/stub') as typeof import('../src/gate/stub');
    const spy = jest.spyOn(stub, 'evaluateStub').mockImplementation((answers) => {
      seen.push(...answers.map((a) => a.questionId));
      return { verdict: 'SAFE', firedRules: [] };
    });
    submitMovement(buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: true }), 'couldNot');
    spy.mockRestore();
    expect(seen).toContain(Q_ONSET_SUDDEN_TRAUMA);
    expect(seen).toContain(Q_UNABLE_TO_MOVE_ARM);
    expect(seen).toContain('Q_BASICS_HOW');
  });

  it('stores one snapshot per answer, in order, and the last one is the live state', () => {
    submitMovement(painful('sideways_raise'), 'pain');
    submitMovement(skipped('forward_raise'), 'skip');
    submitQuestion(answered(q('Q_DQ_NIGHT'), true));
    const s = useSession.getState();
    expect(s.narrowingTrail.map((x) => x.afterId)).toEqual(['sideways_raise', 'forward_raise', 'Q_DQ_NIGHT']);
    expect(s.narrowingTrail.map((x) => x.answer)).toEqual(['pain', 'unknown', 'yes']);
    expect(s.narrowingTrail.map((x) => x.step)).toEqual([1, 2, 3]);
    expect(s.narrowingTrail.every((x) => x.gateVerdict === 'SAFE')).toBe(true);
    expect(s.liveState).toEqual(s.narrowingTrail[2].state);
    s.reset();
    expect(useSession.getState().narrowingTrail).toEqual([]);
    expect(useSession.getState().liveState).toBeNull();
  });

  it('the narrowing input carries the answers for the discriminator questions', () => {
    useSession.getState().recordAnswer(answered(q('Q_DQ_NIGHT'), true));
    expect(narrowingInputFrom(useSession.getState())!.answers).toEqual([expect.objectContaining({ questionId: 'Q_DQ_NIGHT', value: true })]);
  });
});

describe('structured gate inputs', () => {
  const how = (value: string | null, state: 'answered' | 'unknown' = 'answered') => ({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value, state });

  it('sudden or injury onset is a yes/no answer in the shared format', () => {
    for (const v of ['after_injury', 'suddenly']) {
      expect(structuredGateInputs([how(v)], [])).toEqual([{ questionId: Q_ONSET_SUDDEN_TRAUMA, type: 'yesno', value: true, state: 'answered' }]);
    }
    expect(structuredGateInputs([how('slowly')], [])).toEqual([{ questionId: Q_ONSET_SUDDEN_TRAUMA, type: 'yesno', value: false, state: 'answered' }]);
  });

  it('"Not sure" on the onset stays unknown (never false); not asked means no entry', () => {
    expect(structuredGateInputs([how(null, 'unknown')], [])).toEqual([{ questionId: Q_ONSET_SUDDEN_TRAUMA, type: 'yesno', value: null, state: 'unknown' }]);
    expect(structuredGateInputs([], [])).toEqual([]);
  });

  it('unable to move the arm: yes from a "could not do it", no only from real answers, unknown from skips', () => {
    expect(structuredGateInputs([], [buildMovementResult('sideways_raise', { kind: 'felt', pain: false, weak: false, couldNot: true })])).toEqual([{ questionId: Q_UNABLE_TO_MOVE_ARM, type: 'yesno', value: true, state: 'answered' }]);
    expect(structuredGateInputs([], [fine('sideways_raise')])).toEqual([{ questionId: Q_UNABLE_TO_MOVE_ARM, type: 'yesno', value: false, state: 'answered' }]);
    expect(structuredGateInputs([], [skipped('sideways_raise'), buildMovementResult('forward_raise', { kind: 'unsure' })])).toEqual([{ questionId: Q_UNABLE_TO_MOVE_ARM, type: 'yesno', value: null, state: 'unknown' }]);
  });

  it('the gate accepts them and, with the current rules, does not react (no gate rule was added)', () => {
    const inputs = structuredGateInputs([how('after_injury')], [buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: true })]);
    expect(evaluate(inputs)).toEqual({ verdict: 'SAFE', firedRules: [] });
  });
});

describe('what the patient sees: bands only, no numbers, no percentages', () => {
  const texts = (node: ReactTestInstance): string[] => {
    const out: string[] = [];
    const walk = (n: ReactTestInstance | string) => {
      if (typeof n === 'string') out.push(n);
      else n.children.forEach((c) => walk(c as ReactTestInstance | string));
    };
    walk(node);
    return out;
  };

  it('no new UI string has a percent sign or probability wording, in any language (apart from the caption that says it is not one)', () => {
    for (const d of [en, ur, roman]) {
      const caption = d.live.matchCaption; // the caption that says it is NOT a probability
      const strings = [...Object.values(d.live).filter((v): v is string => typeof v === 'string'), ...Object.values(d.live.band), ...Object.values(d.result), ...Object.values(d.movement)];
      for (const s of strings) {
        expect(s).not.toMatch(/%|٪/);
        expect(s.split(caption).join('')).not.toMatch(/percent|probab|chance|likelihood|odds|فیصد|امکان|ہونے کا/i);
      }
    }
    expect(en.live.matchCaption).toBe('match strength, not a probability');
  });

  it('the screens and components contain no percent sign in a string', () => {
    for (const f of ['components/narrowing/CandidateStrip.tsx', 'components/narrowing/MatchBar.tsx', 'components/narrowing/LeaderLabels.tsx', 'app/report/movement.tsx', 'app/report/result.tsx']) {
      expect(src(f)).not.toContain('%');
    }
  });

  it('the strip shows only the band word and the muscle name, never a number', () => {
    const state = evaluateLive(input({ movementResults: [painful('sideways_raise'), painful('can_position_hold')], answers: [answered(q('Q_DQ_NIGHT'), true)] }));
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<CandidateStrip state={state} />);
    });
    const all = texts(tree.root).join(' ');
    expect(all).not.toMatch(/\d/);
    expect(all).not.toMatch(/%/);
    expect(all).toContain('Supraspinatus');
    expect(all).toMatch(/Low|Moderate|Higher/);
    expect(all).toContain("Thanks, that's enough to go on");
    expect(all).toContain('Not a diagnosis');
    expect(all).toContain('Estimate');
    expect(all).toContain('match strength, not a probability');
  });

  it('before two answers the strip says "Still narrowing - keep going", names the possible muscles, and shows no band', () => {
    const state = evaluateLive({ ...input({ movementResults: [painful('sideways_raise')] }), answers: [] });
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<CandidateStrip state={state} />);
    });
    const all = texts(tree.root).join(' ');
    expect(all).toContain('Still narrowing - keep going');
    expect(all).toContain('Possible so far');
    expect(all).toMatch(/Supraspinatus|Deltoid/);
    expect(all).not.toMatch(/Low|Moderate|Higher/);
    expect(all).not.toMatch(/probability/);
  });

  it('no screen shows a rank number or a numbered list of candidates', () => {
    expect(src('app/report/result.tsx')).not.toMatch(/rank|\{i \+ 1\}/);
  });
});

describe('right-to-left and Roman Urdu: layout does not depend on fixed text boxes', () => {
  it('chips and rows wrap and grow, they are not fixed-height boxes', () => {
    const fixed = /(?<![A-Za-z])height:\s*(\d+(\.\d+)?)/g;
    for (const f of ['components/narrowing/CandidateStrip.tsx', 'components/narrowing/LeaderLabels.tsx', 'app/report/movement.tsx', 'app/report/result.tsx']) {
      const hits = [...src(f).matchAll(fixed)].map((m) => Number(m[1]));
      // only thin decorations may have a fixed height (a line, a dot)
      for (const h of hits) expect(h).toBeLessThanOrEqual(8);
    }
    expect(src('app/report/movement.tsx')).toContain("flexWrap: 'wrap'");
    expect(src('components/narrowing/CandidateStrip.tsx')).toContain("flexWrap: 'wrap'");
  });

  it('every new key exists in English, Urdu and Roman Urdu', () => {
    const keys = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : keys(v as Record<string, unknown>, `${p}${k}.`)));
    expect(keys(ur.live)).toEqual(keys(en.live));
    expect(keys(roman.live)).toEqual(keys(en.live));
    expect(ur.live.stillNarrowing).not.toBe(en.live.stillNarrowing);
    expect(roman.live.enough).not.toBe(en.live.enough);
  });

  it('the Urdu strings are marked as needing a native speaker review', () => {
    expect(src('i18n/ur.ts')).toMatch(/NEEDS NATIVE SPEAKER REVIEW/);
    expect(src('i18n/roman.ts')).toMatch(/NATIVE SPEAKER REVIEW/i);
    expect(bankFile.note).toMatch(/need a native speaker/i);
    void getLanguage;
  });
});
