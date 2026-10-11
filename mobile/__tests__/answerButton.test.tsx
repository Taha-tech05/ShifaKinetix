import { act, create } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { AnswerButton } from '../src/components/AnswerButton';
import type { AnswerKind } from '../src/components/AnswerButton';
import type { Question, QuestionResult } from '../src/questions/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const question: Question = {
  questionId: 'Q_DANGER_A',
  type: 'yesno',
  text: 'Test question',
  isKeyDangerQuestion: true,
};

function render(kind: AnswerKind, q: Question, onAnswer: (r: QuestionResult) => void) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<AnswerButton question={q} kind={kind} onAnswer={onAnswer} />);
  });
  return tree;
}

function press(kind: AnswerKind, q: Question = question): QuestionResult {
  let got: QuestionResult | undefined;
  const tree = render(kind, q, (r) => (got = r));
  const button = tree.root.findByType('Pressable' as unknown as never) as ReactTestInstance;
  act(() => {
    button.props.onPress();
  });
  if (!got) throw new Error('onAnswer was not called');
  return got;
}

describe('AnswerButton', () => {
  it('Not sure gives state unknown with a null value', () => {
    const r = press('notSure');
    expect(r.state).toBe('unknown');
    expect(r.value).toBeNull();
    expect(r.questionId).toBe('Q_DANGER_A');
    expect(r.type).toBe('yesno');
  });

  it('Not sure is never turned into No or zero', () => {
    const r = press('notSure');
    expect(r.value).not.toBe(false);
    expect(r.value).not.toBe(0);
  });

  it('Yes and No give state answered with true and false', () => {
    expect(press('yes')).toMatchObject({ state: 'answered', value: true });
    expect(press('no')).toMatchObject({ state: 'answered', value: false });
  });

  it('Can and Cannot map to answered true and false', () => {
    expect(press('can')).toMatchObject({ state: 'answered', value: true });
    expect(press('cant')).toMatchObject({ state: 'answered', value: false });
  });

  it('flags a key danger Yes and a key danger Not sure for the gate stub', () => {
    expect(press('yes').flagged).toBe(true);
    expect(press('notSure').flagged).toBe(true);
    expect(press('no').flagged).toBeUndefined();
  });

  it('does not flag non-danger questions', () => {
    const general: Question = { ...question, questionId: 'Q_GENERAL_C', isKeyDangerQuestion: false };
    expect(press('yes', general).flagged).toBeUndefined();
    expect(press('notSure', general).flagged).toBeUndefined();
  });

  it('gives Yes, No and Not sure the same size and weight', () => {
    const styleOf = (kind: AnswerKind) => {
      const tree = render(kind, question, () => undefined);
      const pressable = tree.root.findByType('Pressable' as unknown as never) as ReactTestInstance;
      const text = tree.root.findByType('Text' as unknown as never) as ReactTestInstance;
      return { box: pressable.props.style, text: text.props.style };
    };
    const yes = styleOf('yes');
    expect(styleOf('no')).toEqual(yes);
    expect(styleOf('notSure')).toEqual(yes);
  });
});
