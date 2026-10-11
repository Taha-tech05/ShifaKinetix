import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import * as router from 'expo-router';
import LiveScreen from '../src/app/report/movement';
import Result from '../src/app/report/result';
import FeelRoute from '../src/app/report/feel';
import FollowUpRoute from '../src/app/report/followup';
import { narrow } from '../src/dev/narrowingStub';
import { discriminatorQuestions } from '../src/narrowing/bank';
import { answered } from '../src/questions/answer';
import type { BodySelection } from '../src/regions/types';
import { useSession } from '../src/store/session';
import { submitMovement, submitQuestion } from '../src/flow/live';
import { buildMovementResult } from '../src/movement/result';
import { setLanguage } from '../src/i18n';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockStage = jest.fn();
jest.mock('../src/components/movement/MovementStage', () => ({
  MovementStage: (props: Record<string, unknown>) => {
    mockStage(props);
    return null;
  },
}));
// The page frame needs the native safe-area module; a plain frame keeps the banner, the content and the footer.
jest.mock('../src/components/Screen', () => ({
  Screen: (props: { banner?: unknown; children?: unknown; footer?: unknown }) => require('react').createElement('Screen', {}, props.banner, props.children, props.footer),
}));
jest.mock('../src/dev/narrowingStub', () => {
  const actual = jest.requireActual('../src/dev/narrowingStub');
  return { ...actual, narrow: jest.fn(actual.narrow) };
});

const selection: BodySelection = { regionId: 'shoulder_right', subRegionId: 'top', point: { x: -0.17, y: 1.4, z: -0.03 }, hitStructure: null, layer: 'muscle' };
const narrowSpy = narrow as unknown as jest.Mock;
const realRunGate = useSession.getState().runGate;
const q = (id: string) => discriminatorQuestions().find((x) => x.questionId === id)!;

const textOf = (root: ReactTestInstance): string => {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') out.push(n);
    else n.children.forEach((c) => walk(c as ReactTestInstance | string));
  };
  walk(root);
  return out.join(' | ');
};
const button = (tree: ReturnType<typeof create>, label: string) =>
  tree.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label)[0];
const yes = (id: string) => ({ questionId: id, type: 'yesno', value: true, state: 'answered' as const });
const no = (id: string) => ({ questionId: id, type: 'yesno', value: false, state: 'answered' as const });
const press = (tree: ReturnType<typeof create>, label: string) => {
  const el = button(tree, label);
  if (!el) throw new Error(`no button "${label}" in: ${textOf(tree.root)}`);
  act(() => {
    el.props.onPress();
  });
};
/** The structure-type questions come first. These two answers make muscle or tendon lead, so the movements (or muscle questions) follow. */
const passStructure = (tree: ReturnType<typeof create>) => {
  press(tree, 'No'); // a sore spot on a bone?
  press(tree, 'Yes'); // does it go higher with the other hand's help?
  narrowSpy.mockClear(); // two answers are enough for muscle or tendon to lead by the margin
};
/** Region mode asks the movements first. To test the muscle steps, make muscle or tendon lead before the screen opens. */
const seedMuscleLeads = () => {
  for (const id of ['Q_ST_BONE_POINT', 'Q_ST_TINGLE', 'Q_ST_NECK', 'Q_ST_NUMB']) submitQuestion(no(id)); // muscle or tendon leads, no muscle is favoured
  narrowSpy.mockClear();
};
const render = (el: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  return tree;
};

beforeEach(() => {
  setLanguage('en');
  useSession.setState({ runGate: realRunGate });
  useSession.getState().reset();
  useSession.getState().setSelection(selection);
  useSession.getState().setMode('region');
  useSession.setState({ gateVerdict: 'SAFE' });
  narrowSpy.mockClear();
  mockStage.mockClear();
});

describe('live screen: one idea at a time, tap to answer', () => {
  it('region mode starts with the animated movements: caution line, instruction, "I tried it" and "Skip"', () => {
    const tree = render(createElement(LiveScreen));
    const all = textOf(tree.root);
    expect(all).toContain('Raise your arm sideways');
    expect(all).toContain('Move only as far as comfortable. Stop if pain is sharp or severe.');
    expect(button(tree, 'I tried it')).toBeDefined();
    expect(button(tree, 'Skip')).toBeDefined();
    expect(all).not.toContain('Is there one small spot on a bone');
  });

  it('all six movements come first; then the structure-type questions; muscle questions only if muscle or tendon leads', () => {
    const tree = render(createElement(LiveScreen));
    for (let i = 0; i < 6; i++) press(tree, 'Skip'); // six movements, skipped
    expect(textOf(tree.root)).toContain('Is there one small spot on a bone that is very sore when you press it?');
    press(tree, 'No');
    press(tree, 'Yes');
    expect(useSession.getState().liveState?.muscleAllowed).toBe(true);
    expect(textOf(tree.root)).toContain('Is it worse when you lift your arm overhead?');
  });

  it('the model is on top and takes the height that is left; it is the same stage on every step', () => {
    seedMuscleLeads();
    const tree = render(createElement(LiveScreen));
    const last = mockStage.mock.calls[mockStage.mock.calls.length - 1][0] as { height?: number; style: { flex: number; minHeight: number }; movement: { id: string }; paused: boolean };
    expect(last.height).toBeUndefined();
    expect(last.style).toMatchObject({ flex: 1 });
    expect(last.style.minHeight).toBeGreaterThanOrEqual(80);
    expect(last.movement.id).toBe('sideways_raise');
    expect(last.paused).toBe(false);
    expect(tree).toBeDefined();
  });

  it('"I tried it", then a chip: the answer is stored, the gate and narrowing run, and the next movement shows', () => {
    seedMuscleLeads();
    const tree = render(createElement(LiveScreen));
    press(tree, 'I tried it');
    expect(textOf(tree.root)).toContain('What did you feel?');
    press(tree, 'No pain');
    const s = useSession.getState();
    expect(s.movementResults).toEqual([expect.objectContaining({ movementId: 'sideways_raise', state: 'answered', painful: false })]);
    expect(s.narrowingTrail).toHaveLength(5); // 4 structure answers (seeded) + 1 movement
    expect(narrowSpy).toHaveBeenCalledTimes(1);
    expect(textOf(tree.root)).toContain('Raise your arm forward');
  });

  it('"Not sure" and "Skip" are stored as unknown, never as "no pain", and also run the narrowing', () => {
    seedMuscleLeads();
    const tree = render(createElement(LiveScreen));
    press(tree, 'I tried it');
    press(tree, 'Not sure');
    press(tree, 'Skip'); // second movement, skipped without trying
    const r = useSession.getState().movementResults;
    expect(r.map((x) => [x.movementId, x.state])).toEqual([
      ['sideways_raise', 'unknown'],
      ['forward_raise', 'unknown'],
    ]);
    expect(r.every((x) => x.painful === false && x.weak === false && x.unableToDo === false)).toBe(true); // only because there is no answer
    expect(narrowSpy).toHaveBeenCalledTimes(2);
    expect(useSession.getState().narrowingTrail.slice(4).map((x) => x.answer)).toEqual(['unknown', 'unknown']);
  });

  it('pain, weak and could-not-do-it can be combined and are sent with "Next"', () => {
    seedMuscleLeads();
    const tree = render(createElement(LiveScreen));
    press(tree, 'I tried it');
    press(tree, 'Pain');
    press(tree, 'Weak');
    press(tree, 'Next');
    expect(useSession.getState().movementResults[0]).toMatchObject({ painful: true, weak: true, unableToDo: false, state: 'answered' });
  });

  it('stops early with "Thanks, that\'s enough to go on" and offers the result', () => {
    seedMuscleLeads();
    const tree = render(createElement(LiveScreen));
    const move = (chips: string[]) => {
      press(tree, 'I tried it');
      chips.forEach((c) => press(tree, c));
      if (chips.length && chips[0] !== 'No pain' && chips[0] !== 'Not sure') press(tree, 'Next');
    };
    move(['Pain']); // sideways raise: deltoid and supraspinatus
    expect(useSession.getState().liveState?.provisional).toBe(true);
    expect(useSession.getState().liveState?.candidates.length).toBeGreaterThan(0); // highlighted after the first movement, not at the end
    expect(textOf(tree.root)).toContain('Possible so far');
    press(tree, 'Skip'); // forward raise skipped
    move(['Pain']); // can position: supraspinatus
    const state = useSession.getState().liveState!;
    expect(state.status).toBe('enough');
    expect(textOf(tree.root)).toContain("Thanks, that's enough to go on");
    expect(textOf(tree.root)).toContain('Supraspinatus');
    expect(button(tree, 'See result')).toBeDefined();
    expect(button(tree, 'I tried it')).toBeUndefined();
  });

  it('the stage is paused (hand at rest) on question steps and tints the current candidates', () => {
    useSession.getState().setMode('exact');
    const tree = render(createElement(LiveScreen));
    const last = () => mockStage.mock.calls[mockStage.mock.calls.length - 1][0] as { paused: boolean; highlightIds: string[] };
    expect(last().paused).toBe(true);
    expect(textOf(tree.root)).toContain('Is there one small spot on a bone that is very sore when you press it?');
    passStructure(tree);
    expect(textOf(tree.root)).toContain('Is it worse when you lift your arm overhead?');
    press(tree, 'Yes');
    press(tree, 'Yes'); // Q_DQ_ROTATE_OUT
    expect(last().highlightIds.length).toBeGreaterThan(0);
  });

  it('exact mode asks only questions; "Not sure" and "Skip" are unknown answers with a null value', () => {
    useSession.getState().setMode('exact');
    const tree = render(createElement(LiveScreen));
    passStructure(tree);
    press(tree, 'Not sure');
    press(tree, 'Skip');
    const a = useSession.getState().answers.filter((x) => x.questionId.startsWith('Q_DQ_'));
    expect(a).toEqual([
      expect.objectContaining({ questionId: 'Q_DQ_OVERHEAD', state: 'unknown', value: null }),
      expect.objectContaining({ questionId: 'Q_DQ_ROTATE_OUT', state: 'unknown', value: null }),
    ]);
    expect(useSession.getState().movementResults).toEqual([]);
  });

  it('a red flag stops the flow and goes to the doctor path as the existing code does', () => {
    const replace = jest.spyOn(router.router, 'replace');
    useSession.setState({ runGate: jest.fn(() => 'RED_FLAG' as const) });
    const tree = render(createElement(LiveScreen));
    narrowSpy.mockClear(); // the first screen already seeded the candidates; an answer under a red flag must not narrow
    press(tree, 'I tried it');
    press(tree, 'No pain');
    expect(replace).toHaveBeenCalledWith('/report/urgent');
    expect(narrowSpy).not.toHaveBeenCalled();
    replace.mockRestore();
  });

  it('the old routes lead here and are still behind the gate', () => {
    for (const C of [FeelRoute, FollowUpRoute]) {
      expect(textOf(render(createElement(C)).root)).toBe('');
      const redirect = render(createElement(C)).root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Redirect')[0];
      expect(redirect.props.href).toBe('/report/movement');
    }
    useSession.setState({ gateVerdict: null });
    const blocked = render(createElement(FeelRoute)).root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Redirect')[0];
    expect(blocked.props.href).toBe('/report/danger');
  });
});

describe('result screen = the last live state', () => {
  const run = () => {
    for (const [id, v] of [['Q_ST_BONE_POINT', false], ['Q_ST_TINGLE', false], ['Q_ST_NECK', false], ['Q_ST_NUMB', false]] as const) submitQuestion({ questionId: id, type: 'yesno', value: v, state: 'answered' });
    submitMovement(buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), 'pain');
    submitQuestion(answered(q('Q_DQ_OVERHEAD'), true));
    submitMovement(buildMovementResult('forward_raise', { kind: 'skip' }), 'skip');
  };

  it('shows exactly the candidates, bands and why of the last live state, without computing again', () => {
    run();
    const live = useSession.getState().liveState!;
    expect(live.candidates.length).toBeGreaterThan(0);
    narrowSpy.mockClear();
    const tree = render(createElement(Result));
    expect(narrowSpy).not.toHaveBeenCalled(); // no recomputation, so no drift
    const all = textOf(tree.root);
    const names = (id: string) => (jest.requireActual('../src/regions/regionMap') as typeof import('../src/regions/regionMap')).REGION_MAP.structures[id].name;
    for (const c of live.candidates) {
      expect(all).toContain(names(c.muscleId));
      expect(all).toContain({ low: 'Low', moderate: 'Moderate', higher: 'Higher' }[c.band]);
    }
    expect(all).toContain('Matched: Raise your arm sideways');
    const stage = mockStage.mock.calls[mockStage.mock.calls.length - 1][0] as { highlightIds: string[]; labelIds: string[]; paused: boolean };
    expect(stage.highlightIds).toEqual(live.candidates.map((c) => c.muscleId));
    expect(stage.labelIds).toEqual(stage.highlightIds);
    expect(stage.paused).toBe(true);
  });

  it('keeps the demo caution line and the "Not a diagnosis" and "Estimate" chips; no percent, no rank, no digits in the list', () => {
    run();
    const tree = render(createElement(Result));
    const all = textOf(tree.root);
    expect(all).toContain('Move only as far as comfortable. Stop if pain is sharp or severe.');
    expect(all).toContain('Not a diagnosis');
    expect(all).toContain('Estimate');
    expect(all).toContain('Structures that may be involved');
    expect(all).not.toMatch(/%/);
    expect(all).toContain('match strength, not a probability');
    const list = all.slice(all.indexOf('Structures that may be involved'));
    expect(list).not.toMatch(/\d/);
  });

  it('opened before the questions are finished it says the muscles are only possible so far; it does not claim a conclusion', () => {
    submitMovement(buildMovementResult('sideways_raise', { kind: 'skip' }), 'skip');
    const all = textOf(render(createElement(Result)).root);
    expect(useSession.getState().liveState?.provisional).toBe(true);
    expect(all).toContain('Possible so far');
    expect(all).not.toContain('may not be a muscle problem');
    expect(all).not.toContain('Matched:');
  });
});
