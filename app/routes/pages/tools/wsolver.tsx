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

function normalizeAlphaText(value: string) {
  const halfWidth = value.replace(/[Ａ-Ｚａ-ｚ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
  return halfWidth.replace(/[^a-zA-Z]/g, "").toLowerCase();
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
  const [solverError, setSolverError] = useState<string>("");
  const [isSolverPending, setIsSolverPending] = useState<boolean>(false);
  const [workerReady, setWorkerReady] = useState(false);
  const [workerFailed, setWorkerFailed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const solveRequestIdRef = useRef(0);
  const workerBusyRef = useRef(false);
  const queuedSolveRef = useRef<SolveWorkerRequestMessage | null>(null);
  const draftInputRefs = useRef<Array<HTMLInputElement | null>>([]);

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

  const focusDraftInput = React.useCallback((index: number) => {
    window.requestAnimationFrame(() => {
      draftInputRefs.current[index]?.focus();
      draftInputRefs.current[index]?.select();
    });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const updateIsMobile = () => {
      setIsMobile(mediaQuery.matches);
    };

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);
    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile);
    };
  }, []);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("../../../workers/wordle-solver.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      setWorkerFailed(true);
      return;
    }
    workerRef.current = worker;
    const failWorker = () => {
      if (workerRef.current !== worker) return;
      window.clearTimeout(readyTimeout);
      worker.terminate();
      workerRef.current = null;
      workerBusyRef.current = false;
      queuedSolveRef.current = null;
      setWorkerReady(false);
      setWorkerFailed(true);
    };
    const readyTimeout = window.setTimeout(failWorker, 5000);

    worker.onmessage = (event: MessageEvent<SolveWorkerReadyMessage | SolveWorkerResponseMessage>) => {
      if (workerRef.current !== worker) return;
      const message = event.data;
      if (message.type === "ready") {
        window.clearTimeout(readyTimeout);
        setWorkerFailed(false);
        setWorkerReady(true);
        return;
      }

      if (message.type === "solve") {
        workerBusyRef.current = false;
        const queued = queuedSolveRef.current;
        queuedSolveRef.current = null;
        if (queued) {
          workerBusyRef.current = true;
          worker.postMessage(queued);
        }
      }

      if (message.type === "solve" && message.id === solveRequestIdRef.current) {
        setCandidateCount(message.candidateCount);
        setSolver(message.solver);
        setSolverError("");
        setIsSolverPending(false);
      }
    };

    worker.onerror = failWorker;

    return () => {
      window.clearTimeout(readyTimeout);
      worker.terminate();
      workerRef.current = null;
      workerBusyRef.current = false;
      queuedSolveRef.current = null;
    };
  }, []);

  useEffect(() => {
    const requestId = solveRequestIdRef.current + 1;
    solveRequestIdRef.current = requestId;
    const abortController = new AbortController();
    setIsSolverPending(true);
    if (!workerReady && !workerFailed) return;

    const timerId = window.setTimeout(async () => {
      setIsSolverPending(true);
      setSolverError("");

      if (workerReady && workerRef.current) {
        const job = {
          type: "solve",
          id: requestId,
          constraints,
          turnsLeft,
        } satisfies SolveWorkerRequestMessage;
        if (workerBusyRef.current) {
          queuedSolveRef.current = job;
        } else {
          workerBusyRef.current = true;
          workerRef.current.postMessage(job);
        }
        return;
      }

      try {
        const response = await fetch("/api/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ constraints }),
          signal: abortController.signal,
        });

        if (abortController.signal.aborted || solveRequestIdRef.current !== requestId) return;
        if (response.status === 429) {
          setSolverError("リクエストが集中しています。少し待ってから入力を変更してください。");
          return;
        }
        if (!response.ok) {
          throw new Error(`API ${response.status}`);
        }

        const data = (await response.json()) as NextApiResponse;
        if (solveRequestIdRef.current !== requestId) {
          return;
        }

        setCandidateCount(typeof data.candidateCount === "number" ? data.candidateCount : 0);
        setSolver(data.solver ?? EMPTY_SOLVER);
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
      queuedSolveRef.current = null;
    };
  }, [constraintKey, constraints, turnsLeft, workerReady, workerFailed]);

  const applyDraftLetters = React.useCallback((startIndex: number, letters: string) => {
    const normalized = letters.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
    if (!normalized) {
      return;
    }

    setDraftLetters((prev) => {
      const next = [...prev];
      for (let offset = 0; offset < normalized.length && startIndex + offset < next.length; offset += 1) {
        const targetIndex = startIndex + offset;
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

  const handleMobileDraftInputChange = (index: number, value: string) => {
    const normalized = normalizeAlphaText(value);

    if (!normalized) {
      replaceDraftLetter(index, "");
      return;
    }

    if (normalized.length > 1) {
      applyDraftLetters(index, normalized);
      const nextIndex = Math.min(index + normalized.length, EMPTY_DRAFT.length - 1);
      focusDraftInput(nextIndex);
      return;
    }

    replaceDraftLetter(index, normalized);
    setSelectedDraftIndex(index);
    if (index < EMPTY_DRAFT.length - 1) {
      focusDraftInput(index + 1);
    }
  };

  const handleMobileDraftInputKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace" && !draftLetters[index] && index > 0) {
      event.preventDefault();
      replaceDraftLetter(index - 1, "");
      setSelectedDraftIndex(index - 1);
      focusDraftInput(index - 1);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      setSelectedDraftIndex(index - 1);
      focusDraftInput(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < EMPTY_DRAFT.length - 1) {
      event.preventDefault();
      setSelectedDraftIndex(index + 1);
      focusDraftInput(index + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      submitGuess();
    }
  };

  const handleMobileDraftPaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    const pasted = normalizeAlphaText(event.clipboardData.getData("text")).slice(0, 5);
    if (!pasted) {
      return;
    }

    event.preventDefault();
    applyDraftLetters(index, pasted);
    const nextIndex = Math.min(index + pasted.length, EMPTY_DRAFT.length - 1);
    focusDraftInput(nextIndex);
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
    if (isMobile) {
      return;
    }

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
    isMobile,
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
        description="Wordleを効率的に解くツール"
      />

      <section className="solver-layout">
        <section className="solver-panel solver-panel--metrics">
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-card__label">候補数</div>
              <div className="metric-card__value">{candidateCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-card__label">手数</div>
              <div className="metric-card__value">{turnsUsed} / {MAX_TURNS}</div>
            </div>
          </div>
        </section>

        <section className="solver-panel solver-panel--input">
          <div className="solver-panel__header">
            <h2 className="solver-section-title">入力</h2>
            <button
              type="button"
              onClick={clearAll}
              className="btn site-button site-button--ghost site-button--small"
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
                  className="btn site-icon-button"
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
              {isMobile
                ? draftLetters.map((letter, index) => (
                    <input
                      key={`draft-input-${index}`}
                      ref={(node) => {
                        draftInputRefs.current[index] = node;
                      }}
                      type="text"
                      inputMode="text"
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={letter.toUpperCase()}
                      onChange={(event) => handleMobileDraftInputChange(index, event.target.value)}
                      onFocus={() => setSelectedDraftIndex(index)}
                      onKeyDown={(event) => handleMobileDraftInputKeyDown(index, event)}
                      onPaste={(event) => handleMobileDraftPaste(index, event)}
                      className="solver-draft-input"
                      aria-label={`推測語の${index + 1}文字目`}
                    />
                  ))
                : draftLetters.map((letter, index) => (
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
                className="btn site-button site-button--small"
              >
                追加
              </button>
            </div>
            {errorText ? <p className="solver-error">{errorText}</p> : null}
          </div>

          <p className="solver-note">
            文字をクリックで色を切り替え
          </p>
        </section>

        <section className="solver-panel solver-panel--results">
          <div className="solver-highlight">
            <p className="solver-label">推奨入力</p>
            <div className="solver-highlight__row">
              <span className="solver-highlight__word">
                {solver.recommended?.word?.toUpperCase() ?? "-----"}
              </span>
              {solver.recommended?.safe ? (
                <span className="badge status-pill status-pill--success">safe</span>
              ) : null}
            </div>
            {isSolverPending ? <p className="solver-meta solver-meta--accent">再計算中…</p> : null}
            {!workerReady ? (
              <p className="solver-meta solver-meta--violet">
                {workerFailed ? "APIで計算中。" : "ローカル計算の準備中。"}
              </p>
            ) : null}
            {solverError ? <p className="solver-meta solver-meta--error">{solverError}</p> : null}
          </div>

          <div className="solver-lists">
            <div className="solver-list-block">
              <div className="solver-list-block__header">
                <h2 className="solver-section-title solver-list-block__title">
                  答え候補
                </h2>
              </div>
              {solver.candidateSuggestions.map((item, index) => (
                <div key={item.word} className="candidate-row">
                  <span className="candidate-row__rank">#{index + 1}</span>
                  <span className="candidate-row__word">{item.word}</span>
                  <span className="candidate-row__summary">
                    <span className="candidate-row__meta">
                      期待:{item.expectedRemaining?.toFixed(2) ?? "-"}
                    </span>
                    <span className="candidate-row__meta">
                      最大:{item.worstBucket ?? "-"}
                    </span>
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
              </div>
              {solver.explorationSuggestions.map((item, index) => (
                <div key={item.word} className="candidate-row">
                  <span className="candidate-row__rank">#{index + 1}</span>
                  <span className="candidate-row__word">{item.word}</span>
                  <span className="candidate-row__summary">
                    <span className="candidate-row__meta">分岐:{item.probeLetterCount}</span>
                    <span className="candidate-row__meta">重み:{item.probeLetterScore}</span>
                  </span>
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
