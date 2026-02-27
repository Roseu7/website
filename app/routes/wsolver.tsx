import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { HandwritingTitle } from "~/components/HandwritingTitle";
import { attachThemeToggle } from "~/utils/theme";
import {
  type LetterState,
  type SolverResult,
  type WordleConstraint,
  isAllowedGuess,
  isCompletePattern,
} from "~/utils/wordle";

interface AttemptRow {
  id: number;
  guess: string;
  pattern: [LetterState, LetterState, LetterState, LetterState, LetterState];
}

const MAX_TURNS = 6;
const EMPTY_DRAFT = ["", "", "", "", ""];
const EMPTY_SOLVER: SolverResult = { suggestions: [], recommended: null, mode: "heuristic" };

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

export const meta = () => {
  return [
    { title: "Wordle Solver | Digital Sandbox by Roseu" },
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
    return "bg-green-600 border-green-500 text-white";
  }
  if (state === 1) {
    return "bg-yellow-500 border-yellow-400 text-white";
  }
  if (state === 0 || state === -1) {
    return "bg-gray-500 border-gray-400 text-white";
  }
  return "bg-gray-500 border-gray-400 text-white";
}

export default function WordleSolverPage() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [draftLetters, setDraftLetters] = useState<string[]>([...EMPTY_DRAFT]);
  const [errorText, setErrorText] = useState<string>("");
  const [candidateCount, setCandidateCount] = useState(0);
  const [solver, setSolver] = useState<SolverResult>(EMPTY_SOLVER);
  const [solverSource, setSolverSource] = useState<"local" | "api">("api");
  const [solverError, setSolverError] = useState<string>("");
  const [isSolverPending, setIsSolverPending] = useState<boolean>(false);
  const [workerReady, setWorkerReady] = useState(false);
  const draftRefs = useRef<Array<HTMLInputElement | null>>([]);
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

  useEffect(() => {
    const worker = new Worker(new URL("../workers/wordle-solver.worker.ts", import.meta.url), {
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

  useEffect(() => {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const sunIcon = document.getElementById("sun-icon");
    const moonIcon = document.getElementById("moon-icon");
    const detachThemeToggle = attachThemeToggle({
      button: themeToggleBtn,
      sunIcon,
      moonIcon,
    });

    const header = document.getElementById("main-header");
    const animatedTitle = document.getElementById("animated-title-container");
    const subTitle = document.getElementById("main-subtitle-text");

    let ANIMATION_END = 400;
    const START_SCALE = 1.0;
    const END_SCALE = 0.3;
    const SUBTITLE_VISUAL_START_SCALE = 1.0;
    let subtitleVisualEndScale = window.innerWidth <= 768 ? 0.5 : 0.65;
    const START_Y_OFFSET = 0;
    let END_Y_OFFSET = -(window.innerHeight / 2) + ((header?.offsetHeight || 0) / 2);
    const SUBTITLE_END_Y_TRANSLATE = 8;

    function calculateAnimationValues() {
      END_Y_OFFSET = -(window.innerHeight / 2) + ((header?.offsetHeight || 0) / 2);
      ANIMATION_END = window.innerHeight * 0.8;
      subtitleVisualEndScale = window.innerWidth <= 768 ? 0.5 : 0.65;
    }

    function applyScrolledHeaderState() {
      header?.classList.add("scrolled");
      const scrollY = ANIMATION_END;
      const progress = Math.min(1, scrollY / ANIMATION_END);

      const currentContainerScale = START_SCALE - (START_SCALE - END_SCALE) * progress;
      const currentY = START_Y_OFFSET + (END_Y_OFFSET - START_Y_OFFSET) * progress;

      if (animatedTitle) {
        animatedTitle.style.transform = `translate(-50%, calc(-50% + ${currentY}px)) scale(${currentContainerScale})`;
        animatedTitle.style.pointerEvents = "auto";
      }

      const counterScale = 1 / currentContainerScale;
      const targetSubtitleScale = SUBTITLE_VISUAL_START_SCALE - (SUBTITLE_VISUAL_START_SCALE - subtitleVisualEndScale) * progress;
      const currentSubtitleY = SUBTITLE_END_Y_TRANSLATE * progress;

      if (subTitle) {
        subTitle.style.transform = `scale(${counterScale * targetSubtitleScale}) translateY(${currentSubtitleY}px)`;
        subTitle.style.transformOrigin = "bottom right";
      }
    }

    const handleResize = () => {
      calculateAnimationValues();
      applyScrolledHeaderState();
    };
    window.addEventListener("resize", handleResize);
    calculateAnimationValues();
    applyScrolledHeaderState();

    return () => {
      detachThemeToggle();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const updateDraftLetter = (index: number, rawValue: string) => {
    const normalized = rawValue.toLowerCase().replace(/[^a-z]/g, "").slice(-1);

    setDraftLetters((prev) => {
      const next = [...prev];
      next[index] = normalized;
      return next;
    });

    if (normalized && index < 4) {
      draftRefs.current[index + 1]?.focus();
    }
  };

  const handleDraftKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitGuess();
      return;
    }

    if (event.key === "Backspace" && !draftLetters[index] && index > 0) {
      draftRefs.current[index - 1]?.focus();
    }
  };

  const submitGuess = () => {
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
    setErrorText("");
    draftRefs.current[0]?.focus();
  };

  const clearAll = () => {
    setAttempts([]);
    setDraftLetters([...EMPTY_DRAFT]);
    setErrorText("");
    draftRefs.current[0]?.focus();
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
    <>
      <header id="main-header" className="fixed top-0 left-0 w-full p-4 sm:p-6 z-40">
        <div className="container mx-auto flex justify-end items-center relative h-10">
          <button
            id="theme-toggle-btn"
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none theme-transition"
          >
            <span className="sr-only">Toggle theme</span>
            <svg id="moon-icon" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
            <svg id="sun-icon" className="h-6 w-6 hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </button>
        </div>
      </header>

      <div id="animated-title-container" className="fixed top-1/2 left-1/2 z-50 logo-entrance">
        <Link to="/" className="block">
          <div className="relative text-center">
            <HandwritingTitle />
            <p id="main-subtitle-text" className="absolute bottom-4 right-0 text-md font-semibold theme-transition logo-subtitle-script">
              by Roseu
            </p>
          </div>
        </Link>
      </div>

      <main className="pt-24 sm:pt-28">
        <div id="content-area" className="container mx-auto p-8">
          <section className="space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white theme-transition">Wordle Solver</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 theme-transition">
                左で推測語とフィードバックを入力し、右の候補を更新します。
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-5 theme-transition space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white theme-transition">入力</h4>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 theme-transition"
                  >
                    すべてクリア
                  </button>
                </div>

                <div className="space-y-3">
                  {attempts.map((row) => (
                    <div key={row.id} className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {row.guess.split("").map((char, index) => (
                          <button
                            key={`${row.id}-${index}`}
                            type="button"
                            onClick={() => cycleTile(row.id, index)}
                            className={`w-11 h-11 rounded-md border text-sm font-bold uppercase tracking-wide transition-colors ${tileClass(row.pattern[index])}`}
                            title="クリックで色を切り替え"
                          >
                            {char}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        className="w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 theme-transition"
                        aria-label="入力済み行を削除"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">推測語を入力して行を追加</p>
                  <div className="flex flex-wrap gap-2">
                    {draftLetters.map((letter, index) => (
                      <input
                        key={`draft-${index}`}
                        ref={(element) => {
                          draftRefs.current[index] = element;
                        }}
                        value={letter}
                        onChange={(event) => updateDraftLetter(index, event.target.value)}
                        onKeyDown={(event) => handleDraftKeyDown(index, event)}
                        className="w-11 h-11 text-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 uppercase font-bold"
                        maxLength={1}
                        inputMode="text"
                        autoComplete="off"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={submitGuess}
                      className="px-4 h-11 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold theme-transition"
                    >
                      追加
                    </button>
                  </div>
                  {errorText && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">{errorText}</p>
                  )}
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  色は <span className="font-semibold">灰</span> → <span className="font-semibold">黄</span> → <span className="font-semibold">緑</span> で切り替わります。
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/60 p-5 theme-transition space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 theme-transition">
                    <div className="text-gray-500 dark:text-gray-400">候補数</div>
                    <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{candidateCount}</div>
                  </div>
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 theme-transition">
                    <div className="text-gray-500 dark:text-gray-400">消化手数</div>
                    <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{turnsUsed}</div>
                  </div>
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-3 theme-transition">
                    <div className="text-gray-500 dark:text-gray-400">残り手数</div>
                    <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{turnsLeft}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">次の推奨入力</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-2xl font-bold tracking-widest uppercase text-gray-900 dark:text-gray-100">
                      {solver.recommended?.word ?? "-----"}
                    </span>
                    {solver.recommended?.safe && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white">safe</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    モード: {solver.mode === "late-exact" ? "終盤厳密判定" : "序盤ヒューリスティック"} / {solverSource === "local" ? "ローカル" : "API"}
                  </p>
                  {isSolverPending && (
                    <p className="mt-2 text-xs text-sky-600 dark:text-sky-400">候補を再計算中…</p>
                  )}
                  {!workerReady && (
                    <p className="mt-2 text-xs text-violet-600 dark:text-violet-400">ローカル計算エンジンを読み込み中。APIで計算しています。</p>
                  )}
                  {solverError && (
                    <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{solverError}</p>
                  )}
                </div>

                <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                  {solver.suggestions.map((item, index) => (
                    <div key={item.word} className="grid grid-cols-[56px_1fr_74px_74px] items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">#{index + 1}</span>
                      <span className="font-semibold tracking-wide uppercase text-gray-900 dark:text-gray-100">{item.word}</span>
                      <span className="text-gray-600 dark:text-gray-300 text-right">E:{item.expectedRemaining.toFixed(2)}</span>
                      <span className="text-right text-gray-600 dark:text-gray-300">
                        W:{item.worstBucket}
                        {item.safe && <span className="ml-1 text-emerald-500">safe</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

      <footer className="p-4 sm:p-6">
        <div className="container mx-auto text-center text-sm text-gray-500 dark:text-gray-400 theme-transition">
          <p>&copy; 2026 Roseu. All Rights Reserved.</p>
        </div>
      </footer>
    </>
  );
}
