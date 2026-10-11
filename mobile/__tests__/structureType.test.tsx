import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import config from '../../shared/narrowing_config.json';
import bankFile from '../../shared/structure_type_bank_shoulder.json';
import LiveScreen from '../src/app/report/movement';
import Result from '../src/app/report/result';
import { narrow } from '../src/dev/narrowingStub';
import type { NarrowingInput } from '../src/dev/narrowingStub';
import { evaluate } from '../src/gate/evaluate';
import { Q_BONE_TENDER_AFTER_TRAUMA, Q_NUMB_OR_WEAK, Q_ONSET_SUDDEN_TRAUMA, structuredGateInputs } from '../src/flow/gateInputs';
import { firstMuscleStep, liveSteps, nextStepIndex, submitMovement, submitQuestion, totalSteps } from '../src/flow/live';
import { en } from '../src/i18n/en';
import { roman } from '../src/i18n/roman';
import { ur } from '../src/i18n/ur';
import { setLanguage } from '../src/i18n';
import { approxAreaIds, layerFor } from '../src/narrowing/approxArea';
import { STRUCTURE } from '../src/narrowing/config';
import { evaluateLive } from '../src/narrowing/live';
import { categoryScores, structureState } from '../src/narrowing/structureType';
import { CATEGORIES, structureIds, structureQuestions } from '../src/narrowing/structureBank';
import { looksDoubleBarrelled } from '../src/narrowing/bank';
import { buildMovementResult } from '../src/movement/result';
import { REGION_MAP } from '../src/regions/regionMap';
import type { BodySelection } from '../src/regions/types';
import { useSession } from '../src/store/session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('../src/components/movement/MovementStage', () => ({ MovementStage: () => null }));
jest.mock('../src/components/Screen', () => ({
  Screen: (props: { banner?: unknown; children?: unknown; footer?: unknown }) => require('react').createElement('Screen', {}, props.banner, props.children, props.footer),
}));
jest.mock('../src/dev/narrowingStub', () => {
  const actual = jest.requireActual('../src/dev/narrowingStub');
  return { ...actual, narrow: jest.fn(actual.narrow) };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs') as typeof import('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path') as typeof import('path');
const src = (f: string) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');

const selection: BodySelection = { regionId: 'shoulder_right', subRegionId: 'top', point: { x: -0.17, y: 1.4, z: -0.03 }, hitStructure: null, layer: 'muscle' };
const narrowSpy = narrow as unknown as jest.Mock;
const realRunGate = useSession.getState().runGate;

type A = { questionId: string; type: string; value: unknown; state: 'answered' | 'unknown' };
const yes = (id: string): A => ({ questionId: id, type: 'yesno', value: true, state: 'answered' });
const no = (id: string): A => ({ questionId: id, type: 'yesno', value: false, state: 'answered' });
const unsure = (id: string): A => ({ questionId: id, type: 'yesno', value: null, state: 'unknown' });
const input = (answers: A[], over: Partial<NarrowingInput> = {}): NarrowingInput => ({
  layer: 'muscle',
  regionId: 'shoulder_right',
  subRegionId: 'top',
  point: selection.point,
  hitMeshName: null,
  depthAnswer: null,
  movementResults: [],
  ...over,
  answers,
});
const textOf = (root: ReactTestInstance): string => {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string) => (typeof n === 'string' ? out.push(n) : n.children.forEach((c) => walk(c as ReactTestInstance | string)));
  walk(root);
  return out.join(' | ');
};
const render = (el: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  return tree;
};
const press = (tree: ReturnType<typeof create>, label: string) => {
  const el = tree.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
  if (!el) throw new Error(`no button "${label}" in: ${textOf(tree.root)}`);
  act(() => el.props.onPress());
};

// answers under which each type leads (placeholder table in shared/structure_type_bank_shoulder.json)
const MUSCLE = [yes('Q_ST_PASSIVE_BETTER'), no('Q_ST_BONE_POINT'), no('Q_ST_TINGLE')];
const NERVE = [yes('Q_ST_TINGLE'), yes('Q_ST_NECK')];
const BONE = [yes('Q_ST_BONE_POINT'), no('Q_ST_PASSIVE_BETTER')];
const JOINT = [yes('Q_ST_STUCK_ASSISTED'), yes('Q_ST_CROSS_BODY')];

beforeEach(() => {
  setLanguage('en');
  useSession.setState({ runGate: realRunGate });
  useSession.getState().reset();
  useSession.getState().setSelection(selection);
  useSession.getState().setMode('region');
  useSession.setState({ gateVerdict: 'SAFE' });
  narrowSpy.mockClear();
});

describe('structure bank: fixed questions, one idea each, labelled as a placeholder', () => {
  it('has the questions from the brief, each yes / no / unknown, none double-barrelled', () => {
    const ids = structureIds();
    for (const id of ['Q_ST_BONE_POINT', 'Q_ST_PASSIVE_BETTER', 'Q_ST_STUCK_ASSISTED', 'Q_ST_NIGHT', 'Q_ST_NECK', 'Q_ST_TINGLE', 'Q_ST_NUMB', 'Q_ST_CATCH', 'Q_ST_CLICK', 'Q_ST_GIVEWAY', 'Q_ST_CROSS_BODY']) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lang of ['en', 'ur', 'roman'] as const) for (const q of structureQuestions(lang)) expect(q.text.length).toBeGreaterThan(5);
    for (const q of structureQuestions('en')) {
      expect(q.type).toBe('yesno');
      expect(looksDoubleBarrelled(q.text)).toBe(false);
    }
  });

  it('is labelled placeholder, never claims validation, and keeps its constants in shared/', () => {
    expect(bankFile.label).toBe('placeholder - draft from published sources, awaiting clinician review');
    expect(JSON.stringify(bankFile)).not.toMatch(/doctor-validated/i);
    for (const q of bankFile.questions) expect(q.label).toBe(bankFile.label);
    expect(STRUCTURE.leadMargin).toBe(config.structureType.leadMargin);
    expect(STRUCTURE.maxQuestions).toBe(config.structureType.maxQuestions);
    expect(STRUCTURE.minNonUnknownAnswers).toBe(config.structureType.minNonUnknownAnswers);
    for (const f of ['narrowing/structureType.ts', 'narrowing/live.ts', 'flow/live.ts', 'app/report/movement.tsx', 'app/report/result.tsx']) expect(src(f)).not.toContain(String(config.structureType.leadMargin));
  });

  it('every category in the expected-response table is one of the four, and each has a question that supports it', () => {
    const used = new Set<string>();
    for (const q of bankFile.questions) for (const side of [q.yes, q.no]) for (const c of Object.keys(side)) used.add(c);
    expect([...used].sort()).toEqual([...CATEGORIES].sort());
  });
});

describe('category scores: unknown contributes nothing and never lowers a category', () => {
  it('adding "Not sure" and skipped answers changes no score and no order', () => {
    const base = categoryScores([yes('Q_ST_TINGLE'), no('Q_ST_BONE_POINT')]);
    const more = categoryScores([yes('Q_ST_TINGLE'), no('Q_ST_BONE_POINT'), unsure('Q_ST_NECK'), unsure('Q_ST_NIGHT'), unsure('Q_ST_CATCH'), unsure('Q_ST_PASSIVE_BETTER')]);
    expect(more).toEqual(base);
  });

  it('a real answer can lower a category, so unknown and no are different', () => {
    const nerve = (a: A[]) => categoryScores(a).find((c) => c.category === 'NERVE_NECK')!.strength;
    expect(nerve([yes('Q_ST_TINGLE'), no('Q_ST_NECK')])).toBeLessThan(nerve([yes('Q_ST_TINGLE')]));
    expect(nerve([yes('Q_ST_TINGLE'), unsure('Q_ST_NECK')])).toBe(nerve([yes('Q_ST_TINGLE')]));
  });

  it('the answer must be a clear yes or no to count', () => {
    expect(categoryScores([{ questionId: 'Q_ST_TINGLE', type: 'yesno', value: 'maybe', state: 'answered' }]).every((c) => c.strength === 0)).toBe(true);
  });

  it('the narrowing output carries the four categories (kind "category") after the muscles', () => {
    const out = narrow(input(MUSCLE));
    const cats = out.candidates.filter((c) => c.kind === 'category');
    expect(cats.map((c) => c.muscleId).sort()).toEqual([...CATEGORIES].sort());
    expect(out.candidates.filter((c) => c.kind !== 'category').length).toBeLessThanOrEqual(3);
    for (const c of out.candidates.filter((x) => x.kind !== 'category')) expect(REGION_MAP.structures[c.muscleId]).toBeDefined();
  });
});

describe('the structure step decides before any muscle is shown', () => {
  it('before two answers that are not unknown there is no leading type, however many were skipped', () => {
    expect(structureState([]).status).toBe('narrowing');
    expect(structureState([yes('Q_ST_TINGLE'), unsure('Q_ST_NECK'), unsure('Q_ST_NIGHT')]).status).toBe('narrowing');
    expect(structureState([yes('Q_ST_TINGLE'), unsure('Q_ST_NECK'), unsure('Q_ST_NIGHT')]).scores).toEqual([]);
  });

  it('muscle or tendon leading by the margin allows muscles', () => {
    const s = evaluateLive(input(MUSCLE, { movementResults: [buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), buildMovementResult('can_position_hold', { kind: 'felt', pain: true, weak: false, couldNot: false })] }));
    expect(s.structure.leader).toBe('MUSCLE_TENDON');
    expect(s.muscleAllowed).toBe(true);
    expect(s.outcome).toBe('muscle');
    expect(s.candidates.length).toBeGreaterThan(0);
  });

  it.each([
    ['nerve or neck', NERVE, 'NERVE_NECK'],
    ['bone', BONE, 'BONE'],
    ['joint or capsule', JOINT, 'JOINT_CAPSULE'],
  ] as const)('when %s leads there is a category result and NO muscle list, even with muscle evidence', (_n, answers, leader) => {
    const moves = [buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), buildMovementResult('can_position_hold', { kind: 'felt', pain: true, weak: false, couldNot: false })];
    const s = evaluateLive(input(answers, { movementResults: moves }));
    expect(s.structure.leader).toBe(leader);
    expect(s.outcome).toBe('category');
    expect(s.categoryResult).toBe(leader);
    expect(s.stop).toBe(true);
    expect(s.muscleAllowed).toBe(false);
    expect(s.candidates).toEqual([]);
  });

  it('mixed answers (no category stands out): no muscle list, the flow keeps asking until the cap, then "unclear"', () => {
    const mixed = [yes('Q_ST_TINGLE'), yes('Q_ST_CROSS_BODY'), yes('Q_ST_PASSIVE_BETTER')];
    const during = evaluateLive(input(mixed));
    expect(during.structure.leader).toBeNull();
    expect(during.outcome).toBe('pending');
    expect(during.candidates).toEqual([]);
    expect(during.stop).toBe(false);
    const filler = structureIds().filter((id) => !mixed.some((a) => a.questionId === id)).slice(0, STRUCTURE.maxQuestions - mixed.length).map(unsure);
    const capped = evaluateLive(input([...mixed, ...filler]));
    expect(capped.structure.asked).toBe(STRUCTURE.maxQuestions);
    expect(capped.outcome).toBe('category');
    expect(capped.categoryResult).toBe('UNCLEAR');
    expect(capped.candidates).toEqual([]);
    expect(capped.stop).toBe(true);
  });

  it('a muscle is never forced: with only unknown answers nothing is shown', () => {
    const s = evaluateLive(input(structureIds().slice(0, 8).map(unsure)));
    expect(s.candidates).toEqual([]);
    expect(s.outcome).toBe('category');
    expect(s.categoryResult).toBe('UNCLEAR');
  });

  it('a narrowing without structure types (a replacement) leaves the muscle flow as it was', () => {
    narrowSpy.mockImplementationOnce(() => ({ candidates: [{ muscleId: 'supraspinatus_muscle_right', confidence: 0.9, reason: 'x', matched: ['a', 'b'] }], cluster: false }));
    const s = evaluateLive(input([], { movementResults: [buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), buildMovementResult('can_position_hold', { kind: 'felt', pain: true, weak: false, couldNot: false })] }));
    expect(s.muscleAllowed).toBe(true);
    expect(s.candidates[0].muscleId).toBe('supraspinatus_muscle_right');
  });

  it('bands only: every category has a band and a strength for the bar', () => {
    const s = evaluateLive(input(NERVE));
    for (const c of s.structure.categories) {
      expect(['low', 'moderate', 'higher']).toContain(c.band);
      expect(c.strength).toBeGreaterThanOrEqual(0);
      expect(c.strength).toBeLessThanOrEqual(1);
    }
  });
});

describe('steps: structure questions first, the rest are skipped once muscle leads', () => {
  it('the structure questions come first, in every mode, then movements (region) and muscle questions', () => {
    for (const mode of ['region', 'exact'] as const) {
      const steps = liveSteps(mode);
      const firstOther = steps.findIndex((s) => s.kind !== 'structure');
      expect(steps.slice(0, firstOther).every((s) => s.kind === 'structure')).toBe(true);
      expect(firstMuscleStep(mode)).toBe(firstOther);
      expect(totalSteps(mode)).toBeGreaterThan(STRUCTURE.maxQuestions);
    }
    expect(liveSteps('exact').some((s) => s.kind === 'movement')).toBe(false);
  });

  it('after muscle leads, the remaining structure questions are skipped; otherwise the next structure question follows', () => {
    submitQuestion(no('Q_ST_BONE_POINT') as never);
    const out = submitQuestion(yes('Q_ST_PASSIVE_BETTER') as never);
    expect(out.state?.muscleAllowed).toBe(true);
    expect(nextStepIndex('region', 1, out)).toBe(firstMuscleStep('region'));
    useSession.getState().reset();
    useSession.getState().setSelection(selection);
    useSession.setState({ gateVerdict: 'SAFE' });
    const first = submitQuestion(yes('Q_ST_TINGLE') as never);
    expect(nextStepIndex('region', 2, first)).toBe(3);
  });
});

describe('the gate runs on every answer with structured inputs (no rule added)', () => {
  it('every structure-type answer runs the gate and the narrowing, skips included', () => {
    const runGate = jest.fn(() => 'SAFE' as const);
    useSession.setState({ runGate });
    submitQuestion(no('Q_ST_BONE_POINT') as never);
    submitQuestion(unsure('Q_ST_NECK') as never);
    submitQuestion(yes('Q_ST_TINGLE') as never);
    expect(runGate).toHaveBeenCalledTimes(3);
    expect(narrowSpy).toHaveBeenCalledTimes(3);
  });

  it('RED_FLAG on a structure answer stops the flow and routes to the doctor path; no narrowing runs', () => {
    useSession.setState({ runGate: jest.fn(() => 'RED_FLAG' as const) });
    const out = submitQuestion(yes('Q_ST_BONE_POINT') as never);
    expect(out.route).toBe('/report/urgent');
    expect(out.state).toBeNull();
    expect(narrowSpy).not.toHaveBeenCalled();
  });

  const how = (value: string) => ({ questionId: 'Q_BASICS_HOW', type: 'chooseone', value, state: 'answered' as const });
  const move = (o: { pain?: boolean; weak?: boolean; couldNot?: boolean }) => buildMovementResult('sideways_raise', { kind: 'felt', pain: !!o.pain, weak: !!o.weak, couldNot: !!o.couldNot });
  const find = (list: { questionId: string }[], id: string) => list.find((a) => a.questionId === id);

  it('trauma, bone tenderness after trauma, numbness or weakness and inability to lift are structured answers', () => {
    const g = structuredGateInputs([how('after_injury'), yes('Q_ST_BONE_POINT'), yes('Q_ST_NUMB')], [move({ couldNot: true })]);
    expect(find(g, Q_ONSET_SUDDEN_TRAUMA)).toMatchObject({ type: 'yesno', value: true, state: 'answered' });
    expect(find(g, Q_BONE_TENDER_AFTER_TRAUMA)).toMatchObject({ type: 'yesno', value: true, state: 'answered' });
    expect(find(g, Q_NUMB_OR_WEAK)).toMatchObject({ type: 'yesno', value: true, state: 'answered' });
    expect(find(g, 'Q_UNABLE_TO_MOVE_ARM')).toMatchObject({ type: 'yesno', value: true, state: 'answered' });
  });

  it('bone tenderness after trauma: no from a real no, unknown (never false) from a skip', () => {
    expect(find(structuredGateInputs([how('slowly'), yes('Q_ST_BONE_POINT')], []), Q_BONE_TENDER_AFTER_TRAUMA)).toMatchObject({ value: false, state: 'answered' });
    expect(find(structuredGateInputs([how('after_injury'), no('Q_ST_BONE_POINT')], []), Q_BONE_TENDER_AFTER_TRAUMA)).toMatchObject({ value: false, state: 'answered' });
    expect(find(structuredGateInputs([how('after_injury'), unsure('Q_ST_BONE_POINT')], []), Q_BONE_TENDER_AFTER_TRAUMA)).toMatchObject({ value: null, state: 'unknown' });
    expect(find(structuredGateInputs([unsure('Q_BASICS_HOW'), yes('Q_ST_BONE_POINT')], []), Q_BONE_TENDER_AFTER_TRAUMA)).toMatchObject({ value: null, state: 'unknown' });
    expect(find(structuredGateInputs([how('after_injury')], []), Q_BONE_TENDER_AFTER_TRAUMA)).toBeUndefined(); // not asked: absent
  });

  it('numbness or weakness: yes from tingling, numbness or a weak movement; no only from real noes; unknown from skips', () => {
    expect(find(structuredGateInputs([yes('Q_ST_TINGLE')], []), Q_NUMB_OR_WEAK)).toMatchObject({ value: true });
    expect(find(structuredGateInputs([no('Q_ST_TINGLE')], [move({ weak: true })]), Q_NUMB_OR_WEAK)).toMatchObject({ value: true });
    expect(find(structuredGateInputs([no('Q_ST_TINGLE'), no('Q_ST_NUMB')], [move({})]), Q_NUMB_OR_WEAK)).toMatchObject({ value: false, state: 'answered' });
    expect(find(structuredGateInputs([no('Q_ST_TINGLE'), unsure('Q_ST_NUMB')], []), Q_NUMB_OR_WEAK)).toMatchObject({ value: null, state: 'unknown' });
    expect(find(structuredGateInputs([], []), Q_NUMB_OR_WEAK)).toBeUndefined();
  });

  it('the real gate accepts them and does not react (no gate rule was added)', () => {
    const g = structuredGateInputs([how('after_injury'), yes('Q_ST_BONE_POINT'), yes('Q_ST_TINGLE')], [move({ couldNot: true })]);
    expect(evaluate(g)).toEqual({ verdict: 'SAFE', firedRules: [] });
  });
});

describe('screens', () => {
  it('the live screen shows the category result, "Talk to a doctor or physio", and no muscle', () => {
    const tree = render(createElement(LiveScreen));
    // bone tenderness yes, passive no: bone leads
    press(tree, 'Yes');
    press(tree, 'No');
    const all = textOf(tree.root);
    expect(useSession.getState().liveState?.categoryResult).toBe('BONE');
    expect(all).toContain('This may not be a muscle problem');
    expect(all).toContain('Talk to a doctor or physio');
    expect(all).toContain('See result');
    expect(all).toContain('Not a diagnosis');
    expect(all).toContain('Estimate');
    expect(all).toContain('match strength, not a probability');
    expect(all).not.toMatch(/Supraspinatus|Deltoid|Infraspinatus/);
    expect(all).not.toMatch(/%/);
  });

  it('the result is titled "Structures that may be involved" and equals the last live state (nothing is computed again)', () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    submitQuestion(yes('Q_ST_NECK') as never);
    const live = useSession.getState().liveState!;
    expect(live.categoryResult).toBe('NERVE_NECK');
    narrowSpy.mockClear();
    const tree = render(createElement(Result));
    const all = textOf(tree.root);
    expect(narrowSpy).not.toHaveBeenCalled();
    expect(all).toContain('Structures that may be involved');
    expect(all).toContain('This may not be a muscle problem');
    expect(all).toContain('Nerve or neck');
    expect(all).toContain('Talk to a doctor or physio');
    expect(all).toContain('Matched: Do you feel tingling in your arm?');
    expect(all).toContain('approximate');
    expect(all).not.toMatch(/%/);
    expect(all).not.toMatch(/Supraspinatus/);
  });

  it('muscle result: the strip and the result still list muscles when muscle or tendon leads', () => {
    for (const a of MUSCLE) submitQuestion(a as never);
    submitMovement(buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), 'pain');
    submitMovement(buildMovementResult('can_position_hold', { kind: 'felt', pain: true, weak: false, couldNot: false }), 'pain');
    const all = textOf(render(createElement(Result)).root);
    expect(all).toContain('Supraspinatus');
    expect(all).toContain('Muscle or tendon');
  });

  it('the old muscle-only title is gone', () => {
    expect(en.result.title).toBe('Structures that may be involved');
    expect(ur.result.title).not.toBe(en.result.title);
    expect(roman.result.title).not.toBe(en.result.title);
  });
});

describe('approximate area for structures that have no mesh', () => {
  it('a joint or capsule is shown by the shoulder capsule and ligaments; a nerve by the neck-side muscles; a bone by its bones', () => {
    for (const side of ['right', 'left'] as const) {
      const joint = approxAreaIds('JOINT_CAPSULE', side, null);
      expect(joint.length).toBeGreaterThan(2);
      expect(joint.some((id) => /glenohumeral/.test(id))).toBe(true);
      const neck = approxAreaIds('NERVE_NECK', side, null);
      expect(neck.length).toBeGreaterThan(0);
      const bone = approxAreaIds('BONE', side, 'top');
      expect(bone.length).toBeGreaterThan(0);
      for (const id of [...joint, ...neck, ...bone]) {
        expect(REGION_MAP.structures[id].side).toBe(side);
        expect(REGION_MAP.structures[id].meshNames.length).toBeGreaterThan(0);
      }
      expect(layerFor(bone)).toBe('bone');
      expect(layerFor(joint)).toBe('muscle');
    }
    expect(approxAreaIds('MUSCLE_TENDON', 'right', null)).toEqual([]);
  });

  it('the screens label it "approximate area" (the stage appends it to the leader label)', () => {
    expect(src('components/movement/MovementStage.tsx')).toContain("t('live.approxArea')");
    expect(en.live.approxArea).toBe('approximate area');
    expect(en.live.approxNote).toMatch(/approximate/);
  });
});

describe('strings: bands only, no percent, three languages', () => {
  it('no new string has a percent sign or probability wording (apart from the caption that says it is not one)', () => {
    for (const d of [en, ur, roman]) {
      const strings = [...Object.values(d.live).filter((v): v is string => typeof v === 'string'), ...Object.values(d.live.category), ...Object.values(d.live.band)];
      for (const s of strings) {
        expect(s).not.toMatch(/%|٪/);
        expect(s.split(d.live.matchCaption).join('')).not.toMatch(/percent|probab|chance|likelihood|odds|فیصد|امکان/i);
      }
    }
  });

  it('every new key exists in English, Urdu and Roman Urdu; the machine-written ones are flagged for native review', () => {
    const keys = (o: Record<string, unknown>, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [p + k] : keys(v as Record<string, unknown>, `${p}${k}.`)));
    expect(keys(ur.live)).toEqual(keys(en.live));
    expect(keys(roman.live)).toEqual(keys(en.live));
    expect(Object.keys(en.live.category).sort()).toEqual(['BONE', 'JOINT_CAPSULE', 'MUSCLE_TENDON', 'NERVE_NECK', 'UNCLEAR']);
    expect(src('i18n/ur.ts')).toMatch(/NEEDS NATIVE SPEAKER REVIEW/);
    expect(bankFile.note).toMatch(/native speaker/i);
    for (const c of Object.values(bankFile.categories)) {
      expect(c.ur.length).toBeGreaterThan(1);
      expect(c.roman.length).toBeGreaterThan(1);
    }
  });

  it('the screens and components still contain no percent sign', () => {
    for (const f of ['components/narrowing/CandidateStrip.tsx', 'components/narrowing/MatchBar.tsx', 'components/narrowing/LeaderLabels.tsx', 'narrowing/approxArea.ts', 'app/report/movement.tsx', 'app/report/result.tsx']) expect(src(f)).not.toContain('%');
  });
});
