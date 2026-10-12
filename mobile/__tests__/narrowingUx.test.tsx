// These are narrowing/UI unit tests with an injected gate; see safetyIntegration.test.tsx for the real gate.
jest.mock('../src/gate/sessionEvaluator', () => ({
  evaluateStoredSessionGate: (answers: unknown[]) => jest.requireActual('../src/gate/stub').evaluateStub(answers),
}));
jest.mock('../src/flow/SafeGuard', () => ({ SafeGuard: jest.requireActual('./support/narrowingGateFixture').FixtureSafeGuard }));
jest.mock('../src/gate/safetySession', () => ({ ...jest.requireActual('../src/gate/safetySession'), ...jest.requireActual('./support/safetyCheckpoint').savedSafetySession() }));
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import * as RN from 'react-native';
import * as router from 'expo-router';
import appConfig from '../../shared/app_config.json';
import config from '../../shared/narrowing_config.json';
import LiveScreen from '../src/app/report/movement';
import Result from '../src/app/report/result';
import { ASSISTANT_ENABLED } from '../src/config';
import { narrow } from '../src/dev/narrowingStub';
import { activeHistory, goBack, seedLiveState, submitMovement, submitQuestion } from '../src/flow/live';
import { fixedHeights, TOUCH_MIN, VIEWER_MIN } from '../src/flow/liveLayout';
import { setLanguage } from '../src/i18n';
import { buildMovementResult } from '../src/movement/result';
import { NARROWING, STRUCTURE } from '../src/narrowing/config';
import { evaluateLive } from '../src/narrowing/live';
import { structureIds } from '../src/narrowing/structureBank';
import { categoryScores } from '../src/narrowing/structureType';
import { narrowingInputFrom, useSession } from '../src/store/session';
import type { BodySelection } from '../src/regions/types';

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

const yes = (id: string) => ({ questionId: id, type: 'yesno', value: true as boolean | null, state: 'answered' as const });
const no = (id: string) => ({ questionId: id, type: 'yesno', value: false as boolean | null, state: 'answered' as const });
const unsure = (id: string) => ({ questionId: id, type: 'yesno', value: null as boolean | null, state: 'unknown' as 'answered' | 'unknown' });
const textOf = (root: ReactTestInstance): string => {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string) => (typeof n === 'string' ? out.push(n) : n.children.forEach((c) => walk(c as ReactTestInstance | string)));
  walk(root);
  return out.join(' | ');
};
const buttons = (tree: ReturnType<typeof create>, label: string) => tree.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label);
const press = async (tree: ReturnType<typeof create>, label: string) => {
  const el = buttons(tree, label)[0];
  if (!el) throw new Error(`no button "${label}" in: ${textOf(tree.root)}`);
  await act(async () => el.props.onPress());
};
const rendered: ReturnType<typeof create>[] = [];
afterEach(() => act(() => { for(const tree of rendered.splice(0)) tree.unmount(); }));
const render = (el: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
    rendered.push(tree);
  });
  return tree;
};
const state = () => useSession.getState().liveState!;

beforeEach(() => {
  setLanguage('en');
  useSession.setState({ runGate: realRunGate });
  useSession.getState().reset();
  useSession.getState().setSelection(selection);
  useSession.getState().setMode('exact');
  useSession.setState({ gateVerdict: 'SAFE' });
  narrowSpy.mockClear();
});

describe('fix 1: candidates are highlighted from the first screen and follow every answer', () => {
  it('exist before any answer, seeded from the tapped area, provisional, no bands', () => {
    const s = seedLiveState()!;
    expect(s.candidates.length).toBeGreaterThan(0);
    expect(s.candidates.length).toBeLessThanOrEqual(3);
    expect(s.provisional).toBe(true);
    expect(s.bandsVisible).toBe(false);
    expect(s.outcome).toBe('pending');
    expect(useSession.getState().liveState).toBeNull(); // nothing is stored for the seed
  });

  it('after the first answered question there are candidates, still provisional; after a skip too; bands only from two real answers', () => {
    submitQuestion(yes('Q_ST_NECK') as never);
    expect(state().candidates.length).toBeGreaterThan(0);
    expect(state().provisional).toBe(true);
    expect(state().bandsVisible).toBe(false);
    submitQuestion(unsure('Q_ST_NIGHT') as never); // a skip
    expect(state().candidates.length).toBeGreaterThan(0);
    expect(state().totalNonUnknown).toBe(1);
    expect(state().bandsVisible).toBe(false);
    submitQuestion(no('Q_ST_CATCH') as never);
    expect(state().totalNonUnknown).toBe(2);
    expect(state().bandsVisible).toBe(true);
    expect(NARROWING.minAnswersForBands).toBe(config.minAnswersForBands);
    expect(config.minAnswersForBands).toBe(2);
  });

  it('muscles are not gated on a structure category: a non-muscle leader does not hide them while asking', () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    submitQuestion(yes('Q_ST_NECK') as never);
    expect(state().structure.leader).toBe('NERVE_NECK');
    expect(state().candidates.length).toBeGreaterThan(0);
    expect(state().provisional).toBe(true);
    expect(state().stop).toBe(false);
  });

  it('the screen shows them from the first render, names without bands first, then with bands', async () => {
    const tree = render(createElement(LiveScreen));
    let all = textOf(tree.root);
    expect(all).toContain('Still narrowing - keep going');
    expect(all).toContain('Possible so far');
    expect(all).not.toMatch(/Low|Moderate|Higher/);
    await press(tree, 'Yes');
    await press(tree, 'No');
    all = textOf(tree.root);
    expect(all).toContain('Possible so far');
    expect(all).toMatch(/Low|Moderate|Higher/);
    expect(all).toContain('match strength, not a probability');
    expect(all).not.toMatch(/%/);
  });
});

describe('fix 2: the non-muscle conclusion only at the end', () => {
  it('the live screen never shows the card, a category or the physio action while asking, for every question of the set', async () => {
    const tree = render(createElement(LiveScreen));
    for (let i = 0; i < STRUCTURE.maxQuestions; i++) {
      const all = textOf(tree.root);
      expect(all).not.toContain('may not be a muscle problem');
      expect(all).not.toContain('Talk to a doctor or physio');
      expect(all).not.toMatch(/Nerve or neck|Joint or capsule|Muscle or tendon|Types so far/);
      await press(tree, i % 2 === 0 ? 'Yes' : 'No');
    }
    const end = textOf(tree.root);
    expect(state().outcome).toBe('category');
    expect(end).toContain('See result');
    expect(end).not.toContain('may not be a muscle problem'); // the conclusion is on the result screen
  });

  it('after every question the result explains it in plain words and offers the doctor or physio; no emergency wording; no assistant', () => {
    const chosen = [yes('Q_ST_TINGLE'), yes('Q_ST_NECK')];
    for (const a of [...chosen, ...structureIds().filter((id) => !chosen.some((c) => c.questionId === id)).slice(0, STRUCTURE.maxQuestions - 2).map(unsure)]) submitQuestion(a as never);
    expect(state().categoryResult).toBe('NERVE_NECK');
    const all = textOf(render(createElement(Result)).root);
    expect(all).toContain('This may not be a muscle problem');
    expect(all).toContain('This tool only looks at muscles');
    expect(all).toContain('cannot rule out a problem in a joint, a bone or a nerve');
    expect(all).toContain('Talk to a doctor or physio');
    expect(all).toContain('Not a diagnosis');
    expect(all).toContain('Estimate');
    expect(all).not.toMatch(/emergency|1122|urgent|danger|immediately|call /i);
    expect(all).not.toMatch(/assistant|chat|AI /i);
    expect(all).not.toMatch(/%/);
  });

  it('a muscle-leading result may stop early; a non-muscle conclusion never does', () => {
    submitQuestion(no('Q_ST_BONE_POINT') as never);
    submitQuestion(yes('Q_ST_PASSIVE_BETTER') as never);
    expect(state().muscleAllowed).toBe(true); // muscle or tendon leads: the muscle questions follow, structure questions are skipped
    // a different patient: bone leads after two answers but the questions go on
    useSession.getState().reset();
    useSession.getState().setSelection(selection);
    useSession.setState({ gateVerdict: 'SAFE' });
    submitQuestion(yes('Q_ST_BONE_POINT') as never);
    submitQuestion(no('Q_ST_PASSIVE_BETTER') as never);
    expect(state().structure.leader).toBe('BONE');
    expect(state().stop).toBe(false);
  });

  it('no assistant: the flag is false and nothing about it is rendered', () => {
    expect(appConfig.ASSISTANT_ENABLED).toBe(false);
    expect(ASSISTANT_ENABLED).toBe(false);
    const result = src('app/report/result.tsx');
    expect(result).toContain('EXTENSION POINT');
    expect(result).toContain('ASSISTANT_ENABLED ? null : null'); // the flag renders nothing in this phase
    for (const f of ['app/report/result.tsx', 'app/report/movement.tsx', 'components/narrowing/CandidateStrip.tsx']) expect(src(f)).not.toMatch(/<Assistant|assistantButton|ChatButton/i);
  });

  it('the gate runs on every answer; a red flag in the middle of the questions escalates at once and stays logged', () => {
    const runGate = jest.fn(() => 'SAFE' as const);
    useSession.setState({ runGate });
    submitQuestion(yes('Q_ST_NECK') as never);
    submitQuestion(unsure('Q_ST_NIGHT') as never);
    expect(runGate).toHaveBeenCalledTimes(2);
    useSession.setState({ runGate: jest.fn(() => 'RED_FLAG' as const) });
    const out = submitQuestion(no('Q_ST_CATCH') as never);
    expect(out.route).toBe('/report/urgent');
    expect(useSession.getState().escalation).toMatchObject({ verdict: 'RED_FLAG', afterId: 'Q_ST_CATCH' });
  });
});

describe('fix 4: everything on one screen, no scrolling to answer', () => {
  it('the answer buttons have no ScrollView above them; only the question text scrolls', () => {
    const tree = render(createElement(LiveScreen));
    for (const label of ['Yes', 'No', 'Not sure', 'Skip', 'Back']) {
      const b = buttons(tree, label)[0];
      expect(b).toBeDefined();
      let p: ReactTestInstance | null = b.parent;
      while (p) {
        expect((p.type as unknown) === 'ScrollView').toBe(false);
        p = p.parent;
      }
    }
    // the question text is inside a ScrollView of its own
    const scrolls = tree.root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'ScrollView');
    expect(scrolls.length).toBe(1);
    expect(textOf(scrolls[0])).toContain('Is there one small spot on a bone');
  });

  it('Yes, No, Not sure and Skip share one row, each at least 48 dp', () => {
    const tree = render(createElement(LiveScreen));
    const rowOf = (b: ReactTestInstance) => {
      let p = b.parent;
      while (p && (p.type as unknown) !== 'View') p = p.parent;
      return p;
    };
    const parents = ['Yes', 'No', 'Not sure', 'Skip'].map((l) => rowOf(buttons(tree, l)[0]));
    expect(new Set(parents).size).toBe(1);
    const source = src('app/report/movement.tsx');
    expect(source).toContain('minHeight: 52');
    expect(TOUCH_MIN).toBe(48);
  });

  it('one slim strip carries both messages; the demo banner is not drawn twice', () => {
    const all = textOf(render(createElement(LiveScreen)).root);
    expect(all).toContain('Demo only, not for real patients');
    expect(all).toContain('Move only as far as comfortable. Stop if pain is sharp or severe.');
    expect(src('app/_layout.tsx')).toContain('compact ? null : <Banner kind="demo" />');
  });

  it.each([
    [360, 640],
    [390, 844],
    [412, 915],
  ])('%i x %i dp: the fixed parts leave room for the viewer, at font scale 1.0 and 1.3', (_w, h) => {
    for (const fs of [1, 1.3]) {
      const content = h - 24 - 16 - 52 - 40; // status bar, gesture bar, header, strip
      const f = fixedHeights(fs, content);
      const bottomBlock = f.progress + f.candidates + f.card + f.gaps;
      expect(content - bottomBlock).toBeGreaterThanOrEqual(VIEWER_MIN); // what is left for the viewer
      expect(f.answerRow).toBeGreaterThanOrEqual(TOUCH_MIN);
      // everything except the viewer fits: the answer row can never be pushed off screen
      expect(f.header + f.strip + bottomBlock + VIEWER_MIN).toBeLessThanOrEqual(h);
    }
  });

  it('long text (Urdu, Roman Urdu, large font) scrolls inside the card; the buttons stay', () => {
    const s = src('app/report/movement.tsx');
    expect(s).toContain('maxHeight: textMax');
    expect(s).not.toMatch(/<Screen[^>]*scroll(?!=\{false\})/);
    expect(src('flow/liveLayout.ts')).toContain('TEXT_MAX_FRACTION');
  });
});

describe('fix 5: back, history and recompute', () => {
  const answersFresh = (list: { id: string; a: ReturnType<typeof yes> }[]) => {
    useSession.getState().reset();
    useSession.getState().setSelection(selection);
    useSession.getState().setMode('exact');
    useSession.setState({ gateVerdict: 'SAFE' });
    for (const x of list) submitQuestion(x.a as never);
    return state();
  };

  it('back recomputes from the remaining answers: the result equals a fresh run with the same answers', () => {
    submitQuestion(yes('Q_ST_BONE_POINT') as never);
    submitQuestion(no('Q_ST_PASSIVE_BETTER') as never);
    submitQuestion(yes('Q_ST_NECK') as never);
    const r = goBack();
    expect(r.ok).toBe(true);
    expect(r.undone?.id).toBe('Q_ST_NECK');
    const afterBack = JSON.stringify({ ...state(), asked: undefined });
    const input = narrowingInputFrom(useSession.getState())!;
    const fresh = answersFresh([{ id: 'Q_ST_BONE_POINT', a: yes('Q_ST_BONE_POINT') }, { id: 'Q_ST_PASSIVE_BETTER', a: no('Q_ST_PASSIVE_BETTER') }]);
    expect(JSON.stringify({ ...fresh, asked: undefined })).toBe(afterBack);
    expect(JSON.stringify(narrowingInputFrom(useSession.getState())!.answers)).toBe(JSON.stringify(input.answers));
  });

  it('changing an answer after back gives the same state as answering it that way the first time', () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    submitQuestion(yes('Q_ST_NECK') as never);
    goBack();
    submitQuestion(no('Q_ST_NECK') as never);
    const changed = JSON.stringify({ ...state(), asked: undefined });
    const fresh = answersFresh([{ id: 'Q_ST_TINGLE', a: yes('Q_ST_TINGLE') }, { id: 'Q_ST_NECK', a: no('Q_ST_NECK') }]);
    expect(JSON.stringify({ ...fresh, asked: undefined })).toBe(changed);
  });

  it('superseded answers stay in the log with a flag and a time; the active list holds only the current answers', () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    submitQuestion(yes('Q_ST_NECK') as never);
    goBack();
    submitQuestion(no('Q_ST_NECK') as never);
    const h = useSession.getState().history;
    expect(h.map((e) => [e.id, e.label, !!e.supersededAt])).toEqual([
      ['Q_ST_TINGLE', 'yes', false],
      ['Q_ST_NECK', 'yes', true],
      ['Q_ST_NECK', 'no', false],
    ]);
    expect(new Date(h[1].supersededAt!).getTime()).not.toBeNaN();
    expect(activeHistory().map((e) => e.label)).toEqual(['yes', 'no']);
    // the snapshots are kept and consistent: the one of the undone answer is flagged, the recompute is marked
    const trail = useSession.getState().narrowingTrail;
    expect(trail.find((t) => t.afterId === 'Q_ST_NECK' && t.answer === 'yes')?.supersededAt).toBeDefined();
    expect(trail.some((t) => t.recomputed === true)).toBe(true);
    expect(trail[trail.length - 1].state).toEqual(state());
  });

  it('back re-runs the Severity Gate on the full state', () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    submitQuestion(yes('Q_ST_NECK') as never);
    const runGate = jest.fn(() => 'SAFE' as const);
    useSession.setState({ runGate });
    goBack();
    expect(runGate).toHaveBeenCalledTimes(1);
  });

  it('back after an escalation does not undo it', () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    useSession.setState({ runGate: jest.fn(() => 'RED_FLAG' as const) });
    submitQuestion(yes('Q_ST_NECK') as never);
    const before = JSON.stringify(useSession.getState().history);
    useSession.setState({ runGate: realRunGate });
    const r = goBack();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('escalated');
    expect(JSON.stringify(useSession.getState().history)).toBe(before);
    expect(useSession.getState().escalation?.verdict).toBe('RED_FLAG');
  });

  it('a skipped question comes back as unknown (null), never as no', () => {
    submitQuestion(unsure('Q_ST_NIGHT') as never);
    goBack();
    expect(useSession.getState().answers.find((a) => a.questionId === 'Q_ST_NIGHT')).toBeUndefined();
    submitQuestion(unsure('Q_ST_NIGHT') as never);
    expect(useSession.getState().answers.find((a) => a.questionId === 'Q_ST_NIGHT')).toMatchObject({ state: 'unknown', value: null });
    expect(activeHistory().find((e) => e.id === 'Q_ST_NIGHT')?.label).toBe('unknown');
  });

  it('back with nothing to undo does nothing; movements can be undone too', () => {
    expect(goBack()).toMatchObject({ ok: false, reason: 'empty' });
    useSession.getState().setMode('region');
    submitMovement(buildMovementResult('sideways_raise', { kind: 'felt', pain: true, weak: false, couldNot: false }), 'pain');
    expect(useSession.getState().movementResults).toHaveLength(1);
    expect(goBack().undone?.id).toBe('sideways_raise');
    expect(useSession.getState().movementResults).toHaveLength(0);
  });

  it('on the screen: Back undoes the last answer and shows that question again with the old answer selected', async () => {
    const tree = render(createElement(LiveScreen));
    await press(tree, 'Yes'); // bone point
    expect(textOf(tree.root)).toContain('When your other hand helps lift your sore arm');
    await press(tree, 'Back');
    expect(textOf(tree.root)).toContain('Is there one small spot on a bone');
    expect(buttons(tree, 'Yes')[0].props.accessibilityState.selected).toBe(true);
    expect(useSession.getState().answers.find((a) => a.questionId === 'Q_ST_BONE_POINT')).toBeUndefined();
    expect(activeHistory()).toHaveLength(0);
  });

  it('on the first question Back asks before leaving the flow', async () => {
    const alert = jest.spyOn(RN.Alert, 'alert');
    const back = jest.spyOn(router.router, 'back');
    const tree = render(createElement(LiveScreen));
    await press(tree, 'Back');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    const buttonsGiven = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttonsGiven.map((b) => b.text)).toEqual(['Stay', 'Leave']);
    buttonsGiven[1].onPress?.();
    expect(back).toHaveBeenCalledTimes(1);
    alert.mockRestore();
    back.mockRestore();
  });

  it('the Android back button means previous question', () => {
    const src2 = src('app/report/movement.tsx');
    expect(src2).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(src2).toContain('previous();');
    expect(src2).toContain('onBack={() => void previous()}'); // the header arrow too
  });

  it('the result has "Review answers": every current answer with a Change button that reopens it; a change recomputes', async () => {
    submitQuestion(yes('Q_ST_TINGLE') as never);
    submitQuestion(unsure('Q_ST_NECK') as never);
    const push = jest.spyOn(router.router, 'push');
    const tree = render(createElement(Result));
    const all = textOf(tree.root);
    expect(all).toContain('Review answers');
    expect(all).toContain('Do you feel tingling in your arm?');
    expect(all).toContain('Not sure'); // the skipped one shows as unknown
    await press(tree, 'Change: Do you feel tingling in your arm?');
    expect(push).toHaveBeenCalledWith('/report/movement?review=Q_ST_TINGLE');
    push.mockRestore();
    const nerve = () => categoryScores(useSession.getState().answers).find((c) => c.category === 'NERVE_NECK')!.strength;
    const before = nerve();
    submitQuestion(no('Q_ST_TINGLE') as never); // the change
    expect(nerve()).toBeLessThan(before); // the category scores are worked out again from the changed answer
    expect(activeHistory().map((e) => `${e.id}:${e.label}`)).toEqual(['Q_ST_NECK:unknown', 'Q_ST_TINGLE:no']);
    expect(useSession.getState().history.filter((e) => e.supersededAt).map((e) => `${e.id}:${e.label}`)).toEqual(['Q_ST_TINGLE:yes']);
  });
});

describe('the options and the muscle names are shown in full', () => {
  const texts = (root: ReactTestInstance) => root.findAll((n: ReactTestInstance) => (n.type as unknown) === 'Text');

  it('every answer option shows its text, never cut to nothing: Yes, No, Not sure, Skip (and the movement answers)', () => {
    const tree = render(createElement(LiveScreen));
    const all = textOf(tree.root);
    for (const label of ['Yes', 'No', 'Not sure', 'Skip']) {
      expect(all).toContain(label);
      const chip = buttons(tree, label)[0];
      const t = texts(chip)[0];
      expect(t.props.numberOfLines).toBeGreaterThanOrEqual(2); // long words wrap, they are not cut
      expect(chip.props.accessibilityLabel).toBe(label);
    }
  });

  it('the possible muscles are listed by their full names, one per line, none cut to one line', () => {
    const tree = render(createElement(LiveScreen));
    const strip = textOf(tree.root);
    const list = state === undefined ? [] : (seedLiveState()?.candidates ?? []);
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) {
      const name = require('../src/regions/regionMap').REGION_MAP.structures[c.muscleId].name as string;
      expect(strip).toContain(name);
      const node = texts(tree.root).find((n) => textOf(n) === name);
      expect(node).toBeDefined();
      expect(node!.props.numberOfLines).toBeUndefined();
    }
    expect(src('components/narrowing/CandidateStrip.tsx')).not.toContain('numberOfLines={1}');
  });

  it('the viewer takes the height that is left, the controls are never given a fixed share', () => {
    const s = src('app/report/movement.tsx');
    expect(s).toContain('viewer: { flex: 1, minHeight: VIEWER_MIN }');
    expect(s).toContain("flexWrap: 'wrap'"); // chips wrap instead of being cut
  });
});

describe('strings', () => {
  it('no percent sign in the new screens and components', () => {
    for (const f of ['app/report/movement.tsx', 'app/report/result.tsx', 'components/DemoCautionStrip.tsx', 'components/narrowing/CandidateStrip.tsx', 'flow/liveLayout.ts']) expect(src(f)).not.toContain('%');
  });

  it('the strip uses the narrowing interface through the engine, called after every answer', () => {
    submitQuestion(yes('Q_ST_NECK') as never);
    submitQuestion(unsure('Q_ST_NIGHT') as never);
    expect(narrowSpy).toHaveBeenCalledTimes(2);
    expect(evaluateLive(narrowingInputFrom(useSession.getState())!, 'exact').candidates.length).toBeGreaterThan(0);
    expect(narrow).toBeDefined();
  });
});
