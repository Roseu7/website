import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import {
  type LetterState,
  type SolverResult,
  type WordleConstraint,
  isAllowedGuess,
  isCompletePattern,
} from "~/utils/wordle";
import { siteConfig } from "~/utils/site";

interface AttemptRow {
  id: number;
  guess: string;
  pattern: [LetterState, LetterState, LetterState, LetterState, LetterState];
}

const MAX_TURNS = 6;
const EMPTY_DRAFT = ["", "", "", "", ""];
const EMPTY_SOLVER: SolverResult = {
  candidateSuggestions: [],
  explorationSuggestions: [],
  recommended: null,
  mode: "heuristic",
};

interface SolveWorkerReadyMessage {
  type: "ready";
}

interface SolveWorkerResponseMessage {
  type: "solve";
  id: number;
  candidateCount: number;
  solver: SolverResult;
}

interface SolveWorkerRequestMessage {
  type: "solve";
  id: number;
  constraints: WordleConstraint[];
  turnsLeft: number;
}

interface NextApiResponse {
  candidateCount?: number;
  solver?: SolverResult;
}

function getLetterFromKeyEvent(event: KeyboardEvent | React.KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }

  const code = "code" in event ? event.code : "";
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }

  if (/^[a-zA-Z]$/.test(event.key)) {
    return event.key.toLowerCase();
  }

  return null;
}

export const meta = () => {
  return [
    { title: `Wordle Solver | ${siteConfig.fullName}` },
    { name: "description", content: "Wordleの候補を絞り込み、次の推測候補を提示するソルバー" },
  ];
};

function nextTileState(state: LetterState): LetterState {
  if (state === 0) return 1;
  if (state === 1) return 2;
  return 0;
}

function tileClass(state: LetterState): string {
  if (state === 2) {
    return "solver-tile solver-tile--correct";
  }
  if (state === 1) {
    return "solver-tile solver-tile--present";
  }
  if (state === 0 || state === -1) {
    return "solver-tile solver-tile--miss";
  }
  return "solver-tile solver-tile--miss";
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export default function WordleSolverPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [draftLetters, setDraftLetters] = useState<string[]>([...EMPTY_DRAFT]);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState<number | null>(0);
  const [errorText, setErrorText] = useState<string>("");
  const [candidateCount, setCandidateCount] = useState(0);
  const [solver, setSolver] = useState<SolverResult>(EMPTY_SOLVER);
  const [solverSource, setSolverSource] = useState<"local" | "api">("api");
  const [solverError, setSolverError] = useState<string>("");
  const [isSolverPending, setIsSolverPending] = useState<boolean>(false);
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const solveRequestIdRef = useRef(0);

  const constraints = useMemo(() => {
    const completed = attempts.filter((row) => isCompletePattern(row.pattern));
    return completed.map((row): WordleConstraint => ({
      guess: row.guess,
      pattern: [row.pattern[0], row.pattern[1], row.pattern[2], row.pattern[3], row.pattern[4]] as [number, number, number, number, number],
    }));
  }, [attempts]);

  const constraintKey = useMemo(
    () => constraints.map((item) => `${item.guess}:${item.pattern.join("")}`).join("|"),
    [constraints]
  );

  const turnsUsed = constraints.length;
  const turnsLeft = Math.max(0, MAX_TURNS - turnsUsed);

  const replaceDraftLetter = React.useCallback((index: number, letter: string) => {
    setDraftLetters((prev) => {
      const next = [...prev];
      next[index] = letter;
      return next;
    });
  }, []);

  const findNextDraftIndex = React.useCallback(() => {
    const firstEmpty = draftLetters.findIndex((letter) => !letter);
    return firstEmpty === -1 ? draftLetters.length - 1 : firstEmpty;
  }, [draftLetters]);

  const focusIndexAfterInput = React.useCallback((index: number) => {
    setSelectedDraftIndex(index < draftLetters.length - 1 ? index + 1 : index);
  }, [draftLetters.length]);

  useEffect(() => {
    const worker = new Worker(new URL("../../workers/wordle-solver.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<SolveWorkerReadyMessage | SolveWorkerResponseMessage>) => {
      const message = event.data;
      if (message.type === "ready") {
        setWorkerReady(true);
        return;
      }

      if (message.type === "solve" && message.id === solveRequestIdRef.current) {
        setCandidateCount(message.candidateCount);
        setSolver(message.solver);
        setSolverSource("local");
        setSolverError("");
        setIsSolverPending(false);
      }
    };

    worker.onerror = () => {
      setWorkerReady(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestId = solveRequestIdRef.current + 1;
    solveRequestIdRef.current = requestId;
    const abortController = new AbortController();

    const timerId = window.setTimeout(async () => {
      setIsSolverPending(true);
      setSolverError("");

      if (workerReady && workerRef.current) {
        workerRef.current.postMessage({
          type: "solve",
          id: requestId,
          constraints,
          turnsLeft,
        } satisfies SolveWorkerRequestMessage);
        return;
      }

      try {
        const response = await fetch("/api/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ constraints }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`API ${response.status}`);
        }

        const data = (await response.json()) as NextApiResponse;
        if (solveRequestIdRef.current !== requestId) {
          return;
        }

        setCandidateCount(typeof data.candidateCount === "number" ? data.candidateCount : 0);
        setSolver(data.solver ?? EMPTY_SOLVER);
        setSolverSource("api");
      } catch {
        if (abortController.signal.aborted || solveRequestIdRef.current !== requestId) {
          return;
        }
        setCandidateCount(0);
        setSolver(EMPTY_SOLVER);
        setSolverError("候補計算に失敗しました。");
      } finally {
        if (solveRequestIdRef.current === requestId) {
          setIsSolverPending(false);
        }
      }
    }, 90);

    return () => {
      window.clearTimeout(timerId);
      abortController.abort();
    };
  }, [constraintKey, constraints, turnsLeft, workerReady]);

  const applyDraftLetters = React.useCallback((startIndex: number, letters: string) => {
    const normalized = letters.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
    if (!normalized) {
      return;
    }

    setDraftLetters((prev) => {
      const next = [...prev];
      for (let offset = 0; offset < normalized.length; offset += 1) {
        const targetIndex = Math.min(startIndex + offset, next.length - 1);
        next[targetIndex] = normalized[offset];
      }
      return next;
    });

    setSelectedDraftIndex(
      Math.min(startIndex + normalized.length, EMPTY_DRAFT.length - 1)
    );
  }, []);

  const handleDraftTileClick = (index: number) => {
    setSelectedDraftIndex(index);
  };

  const handleDraftPaste = React.useCallback((event: ClipboardEvent) => {
    if (isEditableElement(event.target)) {
      return;
    }

    const pasted = event.clipboardData?.getData("text").toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
    if (!pasted) {
      return;
    }

    event.preventDefault();
    const startIndex = selectedDraftIndex ?? findNextDraftIndex();
    applyDraftLetters(startIndex, pasted);
  }, [applyDraftLetters, findNextDraftIndex, selectedDraftIndex]);

  const submitGuess = React.useCallback(() => {
    const guess = draftLetters.join("").toLowerCase();

    if (attempts.length >= MAX_TURNS) {
      setErrorText("入力できる推測は最大6行です。");
      return;
    }

    if (!/^[a-z]{5}$/.test(guess)) {
      setErrorText("5文字の英単語を入力してください。");
      return;
    }

    if (!isAllowedGuess(guess)) {
      setErrorText("辞書にない単語です。Wordle入力可能語を入力してください。");
      return;
    }

    setAttempts((prev) => [
      ...prev,
      {
        id: Date.now() + prev.length,
        guess,
        pattern: [0, 0, 0, 0, 0],
      },
    ]);

    setDraftLetters([...EMPTY_DRAFT]);
    setSelectedDraftIndex(0);
    setErrorText("");
  }, [attempts.length, draftLetters]);

  useEffect(() => {
    const handlePageKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isEditableElement(event.target)) {
        return;
      }

      const letter = getLetterFromKeyEvent(event);
      if (letter) {
        event.preventDefault();
        const nextIndex = selectedDraftIndex ?? findNextDraftIndex();
        replaceDraftLetter(nextIndex, letter);
        focusIndexAfterInput(nextIndex);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setDraftLetters((prev) => {
          const next = [...prev];
          const targetIndex =
            selectedDraftIndex ??
            [...next]
              .map((letter, index) => ({ letter, index }))
              .reverse()
              .find((entry) => entry.letter)?.index ??
            0;

          if (next[targetIndex]) {
            next[targetIndex] = "";
            setSelectedDraftIndex(targetIndex);
            return next;
          }

          const previousIndex = Math.max(0, targetIndex - 1);
          next[previousIndex] = "";
          setSelectedDraftIndex(previousIndex);
          return next;
        });
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submitGuess();
        return;
      }

      if (event.key === "ArrowLeft" && selectedDraftIndex !== null) {
        event.preventDefault();
        setSelectedDraftIndex(Math.max(0, selectedDraftIndex - 1));
        return;
      }

      if (event.key === "ArrowRight" && selectedDraftIndex !== null) {
        event.preventDefault();
        setSelectedDraftIndex(Math.min(EMPTY_DRAFT.length - 1, selectedDraftIndex + 1));
      }
    };

    window.addEventListener("keydown", handlePageKeyDown);
    window.addEventListener("paste", handleDraftPaste);
    return () => {
      window.removeEventListener("keydown", handlePageKeyDown);
      window.removeEventListener("paste", handleDraftPaste);
    };
  }, [
    findNextDraftIndex,
    focusIndexAfterInput,
    handleDraftPaste,
    replaceDraftLetter,
    selectedDraftIndex,
    submitGuess,
  ]);

  const clearAll = () => {
    setAttempts([]);
    setDraftLetters([...EMPTY_DRAFT]);
    setSelectedDraftIndex(0);
    setErrorText("");
  };

  const cycleTile = (rowId: number, tileIndex: number) => {
    setAttempts((prev) => prev.map((row) => {
      if (row.id !== rowId) return row;
      const nextPattern: AttemptRow["pattern"] = [...row.pattern];
      nextPattern[tileIndex] = nextTileState(nextPattern[tileIndex]);
      return {
        ...row,
        pattern: nextPattern,
      };
    }));
  };

  const deleteRow = (rowId: number) => {
    setAttempts((prev) => prev.filter((row) => row.id !== rowId));
  };

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro
        title="Wordle Solver"
        description="左で入力し、右で候補を確認します。"
      />

      <section className="solver-layout">
        <section className="solver-panel">
          <div className="solver-panel__header">
            <h2 className="solver-section-title">入力</h2>
            <button
              type="button"
              onClick={clearAll}
              className="site-button site-button--ghost site-button--small"
            >
              すべてクリア
            </button>
          </div>

          <div className="solver-attempts">
            {attempts.map((row) => (
              <div key={row.id} className="solver-attempt-row">
                <div className="solver-attempt-row__tiles">
                  {row.guess.split("").map((char, index) => (
                    <button
                      key={`${row.id}-${index}`}
                      type="button"
                      onClick={() => cycleTile(row.id, index)}
                      className={tileClass(row.pattern[index])}
                      title="クリックで色を切り替え"
                    >
                      {char}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => deleteRow(row.id)}
                  className="site-icon-button"
                  aria-label="入力済み行を削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="solver-draft">
            <p className="solver-label">推測語を入力</p>
            <div className="solver-draft__row">
              {draftLetters.map((letter, index) => (
                <button
                  key={`draft-${index}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleDraftTileClick(index)}
                  className={`solver-draft-tile${selectedDraftIndex === index ? " is-selected" : ""}`}
                  aria-label={`推測語の${index + 1}文字目`}
                  aria-pressed={selectedDraftIndex === index}
                >
                  {letter.toUpperCase()}
                </button>
              ))}
              <button
                type="button"
                onClick={submitGuess}
                className="site-button site-button--small"
              >
                追加
              </button>
            </div>
            {errorText ? <p className="solver-error">{errorText}</p> : null}
          </div>

          <p className="solver-note">
            <span>灰</span> → <span>黄</span> → <span>緑</span>
          </p>
        </section>

        <section className="solver-panel">
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-card__label">候補数</div>
              <div className="metric-card__value">{candidateCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-card__label">使用手</div>
              <div className="metric-card__value">{turnsUsed}</div>
            </div>
            <div className="metric-card">
              <div className="metric-card__label">残り手</div>
              <div className="metric-card__value">{turnsLeft}</div>
            </div>
          </div>

          <div className="solver-highlight">
            <p className="solver-label">推奨入力</p>
            <div className="solver-highlight__row">
              <span className="solver-highlight__word">
                {solver.recommended?.word?.toUpperCase() ?? "-----"}
              </span>
              {solver.recommended?.safe ? (
                <span className="status-pill status-pill--success">safe</span>
              ) : null}
            </div>
            <p className="solver-meta">
              判定: {solver.mode === "late-exact" ? "終盤厳密" : "序盤推定"} / {solverSource === "local" ? "ローカル" : "API"}
            </p>
            {isSolverPending ? <p className="solver-meta solver-meta--accent">再計算中…</p> : null}
            {!workerReady ? (
              <p className="solver-meta solver-meta--violet">ローカル読込中。APIで計算中。</p>
            ) : null}
            {solverError ? <p className="solver-meta solver-meta--error">{solverError}</p> : null}
          </div>

          <div className="solver-lists">
            <div className="solver-list-block">
              <div className="solver-list-block__header">
                <h2 className="solver-section-title solver-list-block__title">
                  答え候補
                </h2>
                <p className="solver-list-block__copy">
                  条件に合う候補のみ表示します。
                </p>
              </div>
              {solver.candidateSuggestions.map((item, index) => (
                <div key={item.word} className="candidate-row">
                  <span className="candidate-row__rank">#{index + 1}</span>
                  <span className="candidate-row__word">{item.word}</span>
                  <span className="candidate-row__meta">
                    期待:{item.expectedRemaining?.toFixed(2) ?? "-"}
                  </span>
                  <span className="candidate-row__meta">
                    最大:{item.worstBucket ?? "-"}
                    {item.safe ? <span className="candidate-row__safe">safe</span> : null}
                  </span>
                </div>
              ))}
              {solver.candidateSuggestions.length === 0 ? (
                <p className="empty-card">候補がありません。</p>
              ) : null}
            </div>

            <div className="solver-list-block">
              <div className="solver-list-block__header">
                <h2 className="solver-section-title solver-list-block__title">
                  探索候補
                </h2>
                <p className="solver-list-block__copy">
                  未使用文字を優先した候補です。
                </p>
              </div>
              {solver.explorationSuggestions.map((item, index) => (
                <div key={item.word} className="candidate-row">
                  <span className="candidate-row__rank">#{index + 1}</span>
                  <span className="candidate-row__word">{item.word}</span>
                  <span className="candidate-row__meta">分岐:{item.probeLetterCount}</span>
                  <span className="candidate-row__meta">重み:{item.probeLetterScore}</span>
                </div>
              ))}
              {solver.explorationSuggestions.length === 0 ? (
                <p className="empty-card">候補がありません。</p>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </PageLayout>
  );
}
