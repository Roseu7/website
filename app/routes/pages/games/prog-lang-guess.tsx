import { useContext, useEffect, useId, useReducer, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { OsWindowActiveContext } from "~/components/os/OsContext";
import { siteConfig } from "~/utils/site";
import { getOsApp } from "~/utils/os";
import { ANSWERS, type Answer, type Step } from "~/utils/prog-lang-guess/engine";
import { engine } from "~/utils/prog-lang-guess/data";

const { languages, questions } = engine;
const game = getOsApp("prog-lang-guess");
const description = "思い浮かべたプログラミング言語を当てます。";
const NO_EXCLUSION = new Set<number>();
const SORTED_NAMES = languages.map(l => l.name).sort((a, b) => a.localeCompare(b, "ja"));

export const meta = () => [
  { title: `${game.label} | ${siteConfig.fullName}` },
  { name: "description", content: description },
];

type Done = { kind: "win" | "lose"; languageIndex: number } | { kind: "unlisted" };

interface Snapshot {
  answers: Answer[];
  // 外した言語。当てに行く候補から除く。
  wrong: number[];
  done: Done | null;
}

interface State extends Snapshot {
  // 操作のたびに進める。描画時の番号と違う操作(連打や、戻ったあとの古いボタン)は無視する。
  turn: number;
  step: Step;
  // 「1つ戻る」で直前の操作を取り消すため、操作の前の状態を積む。
  past: Snapshot[];
}

type Action =
  | { type: "answer"; turn: number; answer: number }
  | { type: "guess"; turn: number; correct: boolean }
  | { type: "pick"; turn: number; done: Done }
  | { type: "undo" }
  | { type: "reset" };

function settle(snapshot: Snapshot, turn: number, past: Snapshot[]): State {
  return { ...snapshot, turn: turn + 1, past, step: engine.nextStep(snapshot.answers, new Set(snapshot.wrong), snapshot.wrong.length) };
}

function initialState(turn = 0): State {
  return settle({ answers: [], wrong: [], done: null }, turn, []);
}

function reducer(state: State, action: Action): State {
  if (action.type === "reset") return initialState(state.turn);
  if (action.type === "undo") {
    const previous = state.past[state.past.length - 1];
    return previous ? settle(previous, state.turn, state.past.slice(0, -1)) : state;
  }
  if (action.turn !== state.turn || state.done) return state;
  const step = state.step;
  const current: Snapshot = { answers: state.answers, wrong: state.wrong, done: state.done };
  const next = (snapshot: Partial<Snapshot>) => settle({ ...current, ...snapshot }, state.turn, [...state.past, current]);
  if (action.type === "answer") {
    if (step.kind !== "ask") return state;
    return next({ answers: [...state.answers, { questionIndex: step.questionIndex, answer: action.answer }] });
  }
  if (action.type === "guess") {
    if (step.kind !== "guess") return state;
    return action.correct
      ? next({ done: { kind: "win", languageIndex: step.languageIndex } })
      : next({ wrong: [...state.wrong, step.languageIndex] });
  }
  if (step.kind !== "giveup") return state;
  return next({ done: action.done });
}

function Inline({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => i % 2 ? <code key={i}>{part}</code> : part)}</>;
}

export default function ProgLangGuessPage() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const windowActive = useContext(OsWindowActiveContext);

  useEffect(() => {
    if (!windowActive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (/^[1-5]$/.test(event.key)) dispatch({ type: "answer", turn: state.turn, answer: Number(event.key) - 1 });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windowActive, state.turn]);

  const p = state.step.p;
  const bits = engine.entropy(p);
  const top = p.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 8);
  const canUndo = state.past.length > 0;

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title={game.label} description={description} headingLevel="h2" hideInOs />
      <div className="plg">
        <div className="plg-head">
          <p className="plg-lead">プログラミング言語を1つ思い浮かべて、質問に答えてください。<br />知らないことは「わからない」で大丈夫です。</p>
          <button type="button" className="btn site-button site-button--ghost site-button--small" onClick={() => dispatch({ type: "reset" })}>最初からやり直す</button>
        </div>

        <div className="plg-layout">
          <section className="plg-card plg-stage" aria-live="polite" aria-label="質問">
            <Stage state={state} dispatch={dispatch} />
          </section>

          <aside className="plg-side" aria-label="絞り込みの状況">
            <div className="plg-panel-head">
              <h2>これまでの答え</h2>
              <button type="button" className="btn site-button site-button--small" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })}>1つ戻る</button>
            </div>
            <ol className="plg-log">
              {state.answers.length ? state.answers.map(({ questionIndex, answer }, i) => (
                <li key={i}>
                  <span className="plg-log__n" data-ui-number>{i + 1}</span>
                  <span><Inline text={questions[questionIndex].text} /></span>
                  <span className="plg-log__a">{ANSWERS[answer]}</span>
                </li>
              )) : <li className="plg-log__empty">まだありません</li>}
            </ol>
            {state.wrong.length ? <p className="plg-note">外れた候補：{state.wrong.map(i => languages[i].name).join("、")}</p> : null}
          </aside>
        </div>

        <details className="plg-all">
          <summary>技術情報</summary>
          <div className="plg-technical">
            <div className="plg-stats">
              <div className="plg-stat"><span className="plg-stat__value" data-ui-number>{state.answers.length}</span><span className="plg-stat__label">質問した数</span></div>
              <div className="plg-stat"><span className="plg-stat__value" data-ui-number>{Math.max(1, Math.round(2 ** bits))}</span><span className="plg-stat__label">実質の候補数</span></div>
            </div>
            <p className="plg-note">あと約 {bits.toFixed(1)} bit</p>
            {!state.done && state.step.kind === "ask" ? <p className="plg-note">この質問の期待情報量 <span data-ui-number>{state.step.gain.toFixed(2)}</span> bit</p> : null}
            {!state.done && state.step.kind === "guess" ? <p className="plg-note">確信度 <strong data-ui-number>{Math.round(p[state.step.languageIndex] * 100)}%</strong></p> : null}
            <h2>上位の候補</h2>
            <ol className="plg-candidates">
              {top.map(([v, i]) => (
                <li key={languages[i].name}>
                  <span className="plg-candidates__name" title={languages[i].name}>{languages[i].name}</span>
                  <span className="plg-candidates__pct" data-ui-number>{(v * 100).toFixed(v < 0.1 ? 1 : 0)}%</span>
                  <span className="plg-candidates__bar" aria-hidden="true"><span style={{ width: `${(v * 100).toFixed(1)}%` }} /></span>
                </li>
              ))}
            </ol>
            {state.done && state.done.kind !== "unlisted" ? <AnswerComparison state={state} done={state.done} /> : null}
          </div>
        </details>
        <details className="plg-all">
          <summary>収録している言語（{languages.length}）</summary>
          <p className="plg-note">収録言語は、英語版Wikipediaの「List of programming languages」を参考に選んでいます。BASICの方言や難解言語なども一部収録しています。</p>
          <ul className="plg-all__list">
            {SORTED_NAMES.map((name, i) => (
              <li key={name}>{name}{i < SORTED_NAMES.length - 1 && <span aria-hidden="true">、</span>}</li>
            ))}
          </ul>
        </details>
        <p className="plg-note">特徴のデータは手作業で付けたものなので、データ側が間違っていることもあります。キーボードの 1〜5 でも答えられます。</p>
      </div>
    </PageLayout>
  );
}

function Stage({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const yesRef = useRef<HTMLButtonElement>(null);
  const isGuess = !state.done && state.step.kind === "guess";
  useEffect(() => {
    if (isGuess) yesRef.current?.focus();
  }, [isGuess, state.turn]);

  if (state.done) return <DoneView state={state} done={state.done} dispatch={dispatch} />;
  const step = state.step;
  const n = state.answers.length;
  const turn = state.turn;
  // ダブルクリックの2回目は、描画し直した次の質問のボタンに当たるので無視する。
  const click = (action: Action) => (event: MouseEvent) => { if (event.detail <= 1) dispatch(action); };

  if (step.kind === "ask") {
    const q = questions[step.questionIndex];
    return (
      <>
        <div className="plg-meta"><span>質問 <strong data-ui-number>{n + 1}</strong></span></div>
        <p className="plg-question"><Inline text={q.text} /></p>
        {q.example ? <pre className="plg-example"><span className="plg-example__tag">例</span>{q.example}</pre> : null}
        <div className="plg-answers" role="group" aria-label="答え" data-ui-actions>
          {ANSWERS.map((label, a) => (
            <button key={a} type="button" data-answer={a} className={`btn site-button plg-answer${a === 0 || a === 4 ? " plg-answer--main" : ""}`} onClick={click({ type: "answer", turn, answer: a })}>
              {label.replace("たぶん", "たぶん​")}
              <span className="plg-answer__key" aria-hidden="true">{a + 1}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (step.kind === "guess") {
    const l = languages[step.languageIndex];
    return (
      <>
        <div className="plg-meta"><span>{n}問目のあと</span></div>
        <p className="plg-big">思い浮かべたのは…</p>
        <p className="plg-guess-name">{l.name}</p>
        <p className="plg-note">{l.year}年ごろ登場</p>
        <div className="plg-row" data-ui-actions>
          <button ref={yesRef} type="button" className="btn site-button plg-answer--main" onClick={click({ type: "guess", turn, correct: true })}>当たり</button>
          <button type="button" className="btn site-button" onClick={click({ type: "guess", turn, correct: false })}>ちがう</button>
        </div>
      </>
    );
  }

  return <GiveUp state={state} dispatch={dispatch} />;
}

function GiveUp({ state, dispatch }: { state: State; dispatch: (action: Action) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputId = useId();
  const listId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const v = value.trim().toLowerCase();
    const languageIndex = languages.findIndex(l => l.name.toLowerCase() === v);
    if (languageIndex < 0) {
      setError(true);
      return;
    }
    dispatch({ type: "pick", turn: state.turn, done: { kind: "lose", languageIndex } });
  };
  return (
    <>
      <p className="plg-big">降参です。何を思い浮かべていましたか？</p>
      <p className="plg-note">{state.answers.length}問答えてもらって、{state.wrong.length}回外しました。名前を選ぶと、「技術情報」で答えとデータのずれを見られます。</p>
      <form className="plg-pick" onSubmit={submit}>
        <label htmlFor={inputId} className="plg-note">言語名</label>
        <div className="plg-row" data-ui-actions>
          <input id={inputId} className="plg-input" list={listId} autoComplete="off" placeholder="例: Kotlin" value={value} aria-invalid={error} aria-describedby={error ? `${inputId}-error` : undefined} onChange={event => { setValue(event.target.value); setError(false); }} />
          <datalist id={listId}>{languages.map(l => <option key={l.name} value={l.name} />)}</datalist>
          <button type="submit" className="btn site-button plg-answer--main">これでした</button>
        </div>
        {error ? <p className="plg-error" id={`${inputId}-error`}>その名前は収録されていません。候補から選ぶか、「一覧にない言語でした」を押してください。</p> : null}
      </form>
      <div className="plg-row">
        <button type="button" className="btn site-button site-button--ghost site-button--small" onClick={() => dispatch({ type: "pick", turn: state.turn, done: { kind: "unlisted" } })}>一覧にない言語でした</button>
      </div>
    </>
  );
}

function dataLabel(f: number | null) {
  if (f === null) return "不明";
  return f >= 0.75 ? "はい" : f <= 0.25 ? "いいえ" : "どちらとも";
}

function isOff(f: number | null, a: number) {
  if (f === null) return false;
  return (f >= 0.75 && a >= 3) || (f <= 0.25 && a <= 1);
}

function DoneView({ state, done, dispatch }: { state: State; done: Done; dispatch: (action: Action) => void }) {
  const count = state.answers.length;
  let text: string;
  if (done.kind === "win") {
    const name = languages[done.languageIndex].name;
    text = state.wrong.length
      ? `${state.wrong.length}回外れたけど、${count}問で${name}を当てられた！`
      : `${name}を${count}問で当てられた！`;
  } else {
    const result = done.kind === "unlisted" ? "思い浮かべていた言語、まだ入ってなかった..." : `思い浮かべていたのは${languages[done.languageIndex].name}でした...`;
    text = `${count}問でゲームが降参した！\n${result}`;
  }
  const gameUrl = new URL(game.path, "https://roseu.net").href;
  const share = new URLSearchParams({ text: `【#${game.label}】\n${text}\n\n${gameUrl}` });
  const actions = (
    <div className="plg-row">
      <button type="button" className="btn site-button plg-answer--main" onClick={() => dispatch({ type: "reset" })}>もう一度遊ぶ</button>
      <a className="btn site-button" href={`https://x.com/intent/tweet?${share}`} target="_blank" rel="noopener noreferrer">Xで結果を共有</a>
    </div>
  );
  if (done.kind === "unlisted") {
    return (
      <>
        <p className="plg-big">一覧の外から来ましたね。</p>
        <p className="plg-note">収録しているのは {languages.length} 言語です。下の「収録している言語」で一覧を見られます。</p>
        {actions}
      </>
    );
  }
  const name = languages[done.languageIndex].name;
  return (
    <>
      {done.kind === "win"
        ? <p className="plg-big">{state.answers.length}問で <code>{name}</code> を当てました。</p>
        : <p className="plg-big">正解は <code>{name}</code> でした。</p>}
      {actions}
    </>
  );
}

function AnswerComparison({ state, done }: { state: State; done: Exclude<Done, { kind: "unlisted" }> }) {
  const li = done.languageIndex;
  const l = languages[li];
  const p = engine.posterior(state.answers, NO_EXCLUSION);
  const rank = p.filter(v => v > p[li]).length + 1;
  const rows = state.answers.map(({ questionIndex, answer }) => {
    const f = questions[questionIndex].values[li];
    return { q: questions[questionIndex], answer, f, off: isOff(f, answer) };
  });
  const offs = rows.filter(r => r.off).length;
  const unknown = rows.filter(r => r.answer === 2).length;
  return (
    <>
      {done.kind === "lose" ? <p className="plg-note">外れた候補を除かずに計算し直すと、{l.name} は {rank} 位でした。</p> : null}
      <p className="plg-note">データと食い違った答え（≠）{offs} 個、「わからない」{unknown} 個。</p>
      {rows.length ? (
        <div className="plg-table-wrap">
          <table className="plg-table">
            <thead><tr><th scope="col">質問</th><th scope="col">あなた</th><th scope="col">データ</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><Inline text={r.q.text} /></td>
                  <td className={r.off ? "plg-table__off" : "plg-table__nw"}>{r.off ? "≠ " : null}{ANSWERS[r.answer]}</td>
                  <td className="plg-table__nw">{dataLabel(r.f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {offs ? <p className="plg-note">食い違いは、あなたの思い違いのこともあれば、データの付け方が雑なこともあります。</p> : null}
    </>
  );
}
