// 特徴の値は「その言語を思い浮かべた人が『はい』と答える確率」。null は「不明」で、
// その質問への答えでは確からしさを動かさない(0.5の「どちらとも言える」とは別扱い)。
export type FeatureValue = number | null;

export interface LanguageRecord {
  name: string;
  weight: number;
  year: number;
  features: Record<string, FeatureValue>;
}

export interface QuestionRecord {
  key: string;
  label: string;
  text: string;
  vagueness: number;
  example?: string;
  yearBefore?: number;
  yearFrom?: number;
}

export const ANSWERS = ["はい", "たぶんはい", "わからない", "たぶんいいえ", "いいえ"] as const;
export const UNKNOWN_ANSWER = 2;

const CLEAN = [0.8, 0.12, 0.04, 0.02, 0.02];
const VAGUE = [0.1, 0.15, 0.5, 0.15, 0.1];

export const GUESS_AT = 0.8;
// 初回80%到達時、はい/いいえの答え次第で本命が50%未満へ落ち、かつその答えの見込みが8%以上なら1回だけ確認質問を挟む。
export const CONFIRM_DROP_AT = 0.5;
export const CONFIRM_MIN_ANSWER_PROB = 0.08;
export const MIN_GAIN = 0.01;
export const MAX_QUESTIONS = 30;
export const MAX_GUESSES = 4;

export interface Answer {
  questionIndex: number;
  answer: number;
}

export type Step =
  | { kind: "ask"; questionIndex: number; gain: number; p: number[] }
  | { kind: "guess"; languageIndex: number; p: number[] }
  | { kind: "giveup"; p: number[] };

function validate(languages: readonly LanguageRecord[], questions: readonly QuestionRecord[]) {
  const problems: string[] = [];
  const keys = new Set<string>();
  const featureKeys = new Set<string>();
  for (const q of questions) {
    if (keys.has(q.key)) problems.push(`質問キーが重複: ${q.key}`);
    keys.add(q.key);
    if (!(q.vagueness >= 0 && q.vagueness <= 1)) problems.push(`${q.key}: あいまいさが0〜1にない`);
    if (q.yearBefore !== undefined && q.yearFrom !== undefined) problems.push(`${q.key}: yearBeforeとyearFromの両方がある`);
    if (q.yearBefore === undefined && q.yearFrom === undefined) featureKeys.add(q.key);
  }
  const names = new Set<string>();
  for (const l of languages) {
    if (names.has(l.name)) problems.push(`言語名が重複: ${l.name}`);
    names.add(l.name);
    if (!(l.weight > 0)) problems.push(`${l.name}: 人気の重みが正でない`);
    if (!Number.isInteger(l.year)) problems.push(`${l.name}: 登場年が整数でない`);
    for (const k of featureKeys) {
      if (!(k in l.features)) problems.push(`${l.name}: ${k} が書かれていない(不明なら null と書く)`);
    }
    for (const [k, v] of Object.entries(l.features)) {
      if (!featureKeys.has(k)) problems.push(`${l.name}: 質問にない特徴 ${k}`);
      else if (v !== null && !(typeof v === "number" && v >= 0 && v <= 1)) problems.push(`${l.name}: ${k} が0〜1でもnullでもない`);
    }
  }
  if (problems.length) throw new Error(`言語あてのデータが不正です\n${problems.join("\n")}`);
}

function entropy(p: readonly number[]) {
  let h = 0;
  for (const v of p) if (v > 0) h -= v * Math.log2(v);
  return h;
}

export function createEngine(languages: readonly LanguageRecord[], questions: readonly QuestionRecord[]) {
  validate(languages, questions);
  const prepared = questions.map(q => {
    const pt = CLEAN.map((v, i) => (1 - q.vagueness) * v + q.vagueness * VAGUE[i]);
    const pf = [...pt].reverse();
    const values: FeatureValue[] = languages.map(l =>
      q.yearBefore !== undefined ? (l.year < q.yearBefore ? 1 : 0)
        : q.yearFrom !== undefined ? (l.year >= q.yearFrom ? 1 : 0)
          : l.features[q.key]);
    // likelihood[answer][language]。未調査(null)はその時点の既知候補の重み付き平均尤度を使うため null を保持する。
    const likelihood: (number | null)[][] = ANSWERS.map((_, a) =>
      values.map(f => f === null ? null : f * pt[a] + (1 - f) * pf[a]));
    return { ...q, values, likelihood };
  });

  function prior(excluded: ReadonlySet<number>) {
    const p = languages.map((l, i) => excluded.has(i) ? 0 : l.weight);
    const s = p.reduce((x, y) => x + y, 0);
    return s > 0 ? p.map(v => v / s) : p;
  }

  // 現在の分布 p に質問 qi への答え a を適用したときの予測確率 pa と更新後分布 next。
  // 未調査(null)には既知候補の重み付き平均尤度を当て、回答前後で未調査候補の確率を保存する。
  function stepAnswer(p: readonly number[], qi: number, a: number): { pa: number; next: number[] } {
    const like = prepared[qi].likelihood[a];
    let knownWeight = 0;
    let knownLikeSum = 0;
    for (let i = 0; i < p.length; i++) {
      const li = like[i];
      if (li !== null && p[i] > 0) {
        knownWeight += p[i];
        knownLikeSum += p[i] * li;
      }
    }
    if (knownWeight === 0) return { pa: 0, next: [...p] };
    const mean = knownLikeSum / knownWeight;
    if (a === UNKNOWN_ANSWER || mean === 0) return { pa: mean, next: [...p] };
    const next = new Array<number>(p.length);
    for (let i = 0; i < p.length; i++) {
      const li = like[i];
      next[i] = li === null ? p[i] : (p[i] * li) / mean;
    }
    return { pa: mean, next };
  }

  function posterior(answers: readonly Answer[], excluded: ReadonlySet<number>) {
    let p = prior(excluded);
    for (const { questionIndex, answer } of answers) {
      p = stepAnswer(p, questionIndex, answer).next;
    }
    return p;
  }

  function bestQuestion(p: readonly number[], asked: ReadonlySet<number>) {
    const h0 = entropy(p);
    let best: { questionIndex: number; gain: number } | null = null;
    for (let qi = 0; qi < prepared.length; qi++) {
      if (asked.has(qi)) continue;
      const values = prepared[qi].values;
      let hasKnown = false;
      for (let i = 0; i < p.length; i++) {
        if (p[i] > 0 && values[i] !== null) { hasKnown = true; break; }
      }
      let gain = 0;
      if (hasKnown) {
        let eh = 0;
        for (let a = 0; a < ANSWERS.length; a++) {
          const { pa, next } = stepAnswer(p, qi, a);
          if (pa > 0) eh += pa * (a === UNKNOWN_ANSWER ? h0 : entropy(next));
        }
        gain = Math.max(0, h0 - eh);
      }
      if (!best || gain > best.gain) best = { questionIndex: qi, gain };
    }
    return best;
  }

  function reachedGuessAt(answers: readonly Answer[], excluded: ReadonlySet<number>) {
    let p = prior(excluded);
    for (let k = 0; k < answers.length; k++) {
      let m = 0;
      for (let i = 0; i < p.length; i++) if (p[i] > m) m = p[i];
      if (m >= GUESS_AT) return true;
      p = stepAnswer(p, answers[k].questionIndex, answers[k].answer).next;
    }
    return false;
  }

  function canFlipTop(p: readonly number[], questionIndex: number, top: number) {
    for (const a of [0, ANSWERS.length - 1]) {
      const { pa, next } = stepAnswer(p, questionIndex, a);
      if (pa >= CONFIRM_MIN_ANSWER_PROB && next[top] < CONFIRM_DROP_AT) return true;
    }
    return false;
  }

  // 次の一手: 質問するか、当てに行くか、降参するか
  function nextStep(answers: readonly Answer[], excluded: ReadonlySet<number>, guesses: number): Step {
    const p = posterior(answers, excluded);
    let top = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[top]) top = i;
    if (guesses >= MAX_GUESSES || p[top] === 0) return { kind: "giveup", p };
    if (p[top] >= GUESS_AT) {
      if (guesses === 0 && answers.length < MAX_QUESTIONS && !reachedGuessAt(answers, excluded)) {
        const best = bestQuestion(p, new Set(answers.map(x => x.questionIndex)));
        if (best && best.gain >= MIN_GAIN && canFlipTop(p, best.questionIndex, top)) {
          return { kind: "ask", questionIndex: best.questionIndex, gain: best.gain, p };
        }
      }
      return { kind: "guess", languageIndex: top, p };
    }
    const asked = new Set(answers.map(x => x.questionIndex));
    const best = answers.length < MAX_QUESTIONS ? bestQuestion(p, asked) : null;
    if (!best || best.gain < MIN_GAIN) return { kind: "guess", languageIndex: top, p };
    return { kind: "ask", questionIndex: best.questionIndex, gain: best.gain, p };
  }

  return { languages, questions: prepared, posterior, entropy, nextStep };
}

export type Engine = ReturnType<typeof createEngine>;
