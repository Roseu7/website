import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  History as HistoryIcon,
  Lightbulb,
  Send,
} from "lucide-react";
import { Link, useLoaderData, useNavigate, type LoaderFunctionArgs } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameDialog } from "~/components/umigame/UmigameDialog";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import {
  formatPuzzlePublicId,
  getPublishedPuzzlePublicById,
  parsePuzzlePublicId,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

type GmAnswerCode =
  | "YES"
  | "NO"
  | "DEPENDS"
  | "IRRELEVANT"
  | "UNDEFINED";

interface QuestionHistoryItem {
  id: string;
  kind: "question";
  text: string;
  answer: GmAnswerCode;
}

interface GuessHistoryItem {
  id: string;
  kind: "guess";
  text: string;
  correct: boolean;
  coverage: number | null;
}

type HistoryItem = QuestionHistoryItem | GuessHistoryItem;

interface RevealedHint {
  level: number;
  text: string;
}

interface ResultStats {
  questionCount: number;
  guessCount: number;
  hintCount: number;
  durationMs: number;
}

interface ResultOverlay {
  outcome: "solved" | "gave_up";
  truth: string;
  stats: ResultStats;
}

interface SessionProblem {
  id: string;
  title: string;
  statement: string;
  difficulty: string;
  hintCount: number;
}

interface ResumeHistoryItem {
  id: string;
  kind: "question" | "guess";
  text: string;
  answerCode: string | null;
  coverage: number | null;
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

const ANSWER_LABELS: Record<GmAnswerCode, string> = {
  YES: "はい",
  NO: "いいえ",
  DEPENDS: "場合による",
  IRRELEVANT: "関係ありません",
  UNDEFINED: "設定されていません",
};

const GM_CODES = new Set<GmAnswerCode>(
  Object.keys(ANSWER_LABELS) as GmAnswerCode[],
);

export async function loader({ params, context }: LoaderFunctionArgs) {
  const rawId = params.id?.trim() ?? "";
  const publicId = parsePuzzlePublicId(rawId);
  if (!publicId || rawId !== formatPuzzlePublicId(publicId)) {
    throw new Response("Not Found", { status: 404 });
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzle = await getPublishedPuzzlePublicById(db, publicId);
  if (!puzzle) throw new Response("Not Found", { status: 404 });
  return { puzzle };
}

export const meta = ({
  data,
}: {
  data?: { puzzle?: { title?: string } };
}) => [
  {
    title: `${data?.puzzle?.title ?? "プレイ"} | ウミガメのスープ | ${siteConfig.fullName}`,
  },
];

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function normalizeResumeHistory(
  rows: ResumeHistoryItem[] | undefined,
): HistoryItem[] {
  if (!rows) return [];
  const result: HistoryItem[] = [];

  for (const row of rows) {
    if (row.kind === "question") {
      if (!row.answerCode || !GM_CODES.has(row.answerCode as GmAnswerCode)) {
        continue;
      }
      result.push({
        id: row.id,
        kind: "question",
        text: row.text,
        answer: row.answerCode as GmAnswerCode,
      });
      continue;
    }

    if (
      row.kind === "guess" &&
      (row.answerCode === "CORRECT" || row.answerCode === "INCORRECT")
    ) {
      result.push({
        id: row.id,
        kind: "guess",
        text: row.text,
        correct: row.answerCode === "CORRECT",
        coverage:
          typeof row.coverage === "number" && Number.isFinite(row.coverage)
            ? row.coverage
            : null,
      });
    }
  }

  return result;
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}分 ${rest}秒` : `${rest}秒`;
}

export default function UmigamePlayPage() {
  const { puzzle } = useLoaderData<typeof loader>();
  return <UmigamePlaySession key={puzzle.displayId} puzzle={puzzle} />;
}

function UmigamePlaySession({ puzzle }: { puzzle: Awaited<ReturnType<typeof loader>>["puzzle"] }) {
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionPending, setSessionPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [newHistoryId, setNewHistoryId] = useState<string | null>(null);
  const [activeProblem, setActiveProblem] = useState<SessionProblem>({
    id: puzzle.displayId,
    title: puzzle.title,
    statement: puzzle.statement,
    difficulty: puzzle.difficulty,
    hintCount: puzzle.hintCount,
  });
  const [question, setQuestion] = useState("");
  const [questionPending, setQuestionPending] = useState(false);
  const [guess, setGuess] = useState("");
  const [guessPending, setGuessPending] = useState(false);
  const [revealedHints, setRevealedHints] = useState<RevealedHint[]>([]);
  const [hintPending, setHintPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [giveUpPending, setGiveUpPending] = useState(false);
  const [resultOverlay, setResultOverlay] = useState<ResultOverlay | null>(
    null,
  );

  const actionPending = questionPending || guessPending || hintPending || giveUpPending;

  const addHistoryItem = (item: HistoryItem) => {
    setHistory((current) => [item, ...current]);
    setNewHistoryId(item.id);
    window.setTimeout(() => {
      setNewHistoryId((current) => (current === item.id ? null : current));
    }, 320);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const response = await fetch(
          `/api/umigame/puzzles/${encodeURIComponent(puzzle.displayId)}/sessions`,
          { method: "POST" },
        );
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = (await response.json()) as {
          sessionId?: string;
          problem?: SessionProblem;
          history?: ResumeHistoryItem[];
          revealedHints?: RevealedHint[];
        };
        if (!data.sessionId) {
          throw new Error("セッションを開始できませんでした。");
        }
        setSessionId(data.sessionId);
        if (data.problem) setActiveProblem(data.problem);
        setHistory(normalizeResumeHistory(data.history));
        setRevealedHints(data.revealedHints ?? []);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "セッションを開始できませんでした。",
        );
      } finally {
        setSessionPending(false);
      }
    })();
  }, [puzzle.displayId]);

  const handleQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = question.trim();
    if (!sessionId || !text || actionPending || finished) return;

    setQuestionPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/sessions/${encodeURIComponent(sessionId)}/question`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = (await response.json()) as {
        answer?: GmAnswerCode;
      };
      if (!data.answer || !GM_CODES.has(data.answer)) {
        throw new Error("Jevから有効な回答を取得できませんでした。");
      }

      addHistoryItem({
        id: crypto.randomUUID(),
        kind: "question",
        text,
        answer: data.answer,
      });
      setQuestion("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "質問に失敗しました。",
      );
    } finally {
      setQuestionPending(false);
    }
  };

  const handleGuess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = guess.trim();
    if (!sessionId || !text || actionPending || finished) return;

    setGuessPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/sessions/${encodeURIComponent(sessionId)}/guess`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = (await response.json()) as {
        correct?: boolean;
        coverage?: number;
        truth?: string;
        stats?: ResultStats;
      };
      if (typeof data.correct !== "boolean") {
        throw new Error("判定結果を読み取れませんでした。");
      }

      const coverage =
        typeof data.coverage === "number" && Number.isFinite(data.coverage)
          ? Math.min(1, Math.max(0, data.coverage))
          : null;
      addHistoryItem({
        id: crypto.randomUUID(),
        kind: "guess",
        text,
        correct: data.correct,
        coverage,
      });
      setGuess("");

      if (data.correct) {
        setFinished(true);
        if (data.truth && data.stats) {
          setResultOverlay({
            outcome: "solved",
            truth: data.truth,
            stats: data.stats,
          });
        }
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "最終回答の判定に失敗しました。",
      );
    } finally {
      setGuessPending(false);
    }
  };

  const handleHint = async () => {
    if (
      !sessionId ||
      actionPending ||
      finished ||
      revealedHints.length >= activeProblem.hintCount
    ) {
      return;
    }

    setHintPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/sessions/${encodeURIComponent(sessionId)}/hint`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = (await response.json()) as {
        hint?: RevealedHint;
      };
      if (
        !data.hint ||
        !Number.isSafeInteger(data.hint.level) ||
        typeof data.hint.text !== "string"
      ) {
        throw new Error("ヒントを読み取れませんでした。");
      }
      setRevealedHints((current) => [...current, data.hint!]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ヒントの表示に失敗しました。",
      );
    } finally {
      setHintPending(false);
    }
  };

  const handleGiveUp = async () => {
    if (!sessionId || actionPending || finished) return;
    if (!window.confirm("ギブアップして真相を表示しますか？")) return;

    setGiveUpPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/sessions/${encodeURIComponent(sessionId)}/give-up`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = (await response.json()) as {
        truth?: string;
        stats?: ResultStats;
      };
      if (!data.truth || !data.stats) {
        throw new Error("結果を読み取れませんでした。");
      }
      setFinished(true);
      setResultOverlay({
        outcome: "gave_up",
        truth: data.truth,
        stats: data.stats,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "ギブアップに失敗しました。",
      );
    } finally {
      setGiveUpPending(false);
    }
  };

  const canPlay = Boolean(sessionId) && !sessionPending && !finished && !actionPending;

  return (
    <PageLayout contentClassName="page-stack">
      <section className="umigame-play-head">
        <UmigameBackLink
          fallbackTo={`/games/umigame/p/${puzzle.displayId}`}
          fallbackLabel="問題詳細に戻る"
        />
        <div>
          <h2>{activeProblem.title}</h2>
        </div>
      </section>

      <section className="umigame-problem-panel umigame-problem-panel--compact">
        <span className="umigame-kicker">QUESTION</span>
        <p>{activeProblem.statement}</p>
      </section>

      <div className="umigame-play-grid">
        <section className="umigame-transcript" aria-live="polite">
          <div className="umigame-section-head umigame-history-head">
            <div className="umigame-history-head__title">
              <HistoryIcon size={18} aria-hidden="true" />
              <h2>履歴</h2>
            </div>
          </div>

          <div className="umigame-transcript__scroll">
            {sessionPending ? (
              <p className="umigame-empty">
                プレイセッションを準備しています…
              </p>
            ) : history.length === 0 ? (
              <p className="umigame-empty">履歴はまだありません。</p>
            ) : (
              <ol className="umigame-turns">
                {history.map((item) => {
                  const answerCode =
                    item.kind === "question"
                      ? item.answer
                      : item.correct
                        ? "CORRECT"
                        : "INCORRECT";
                  return (
                    <li
                      className={`umigame-turn${item.id === newHistoryId ? " is-new" : ""}`}
                      data-answer={answerCode}
                      data-kind={item.kind}
                      key={item.id}
                    >
                      <div className="umigame-turn__question">
                        <span>
                          {item.kind === "question" ? "質問" : "真相回答"}
                        </span>
                        <p>{item.text}</p>
                      </div>
                      <div className="umigame-turn__answer">
                        {item.kind === "question" ? (
                          <strong>{ANSWER_LABELS[item.answer]}</strong>
                        ) : (
                          <>
                            <strong>
                              {item.correct ? "正解" : "不正解"}
                            </strong>
                            {item.coverage !== null ? (
                              <small>
                                正解度：
                                {Math.round(item.coverage * 100)}%
                              </small>
                            ) : null}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {error ? (
            <div className="umigame-error" role="alert">
              {error}
            </div>
          ) : null}
        </section>

        <aside className="umigame-controls">
          <form
            className="umigame-control-block"
            onSubmit={handleQuestion}
          >
            <div>
              <h2>質問する</h2>
            </div>
            <textarea
              className="umigame-textarea"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              maxLength={500}
              aria-label="質問"
              placeholder="ここに質問を入力"
              disabled={!canPlay || questionPending}
            />
            <button
              type="submit"
              className="btn site-button"
              disabled={
                !canPlay ||
                questionPending ||
                question.trim().length === 0
              }
            >
              {questionPending ? "判定中…" : "質問する"}
              <Send size={15} aria-hidden="true" />
            </button>
          </form>

          <form className="umigame-control-block" onSubmit={handleGuess}>
            <div>
              <h2>真相を回答する</h2>
            </div>
            <textarea
              className="umigame-textarea"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              rows={6}
              maxLength={2000}
              aria-label="真相回答"
              placeholder="ここに真相を入力"
              disabled={!canPlay || guessPending}
            />
            <button
              type="submit"
              className="btn site-button"
              disabled={
                !canPlay ||
                guessPending ||
                guess.trim().length === 0
              }
            >
              {guessPending ? "判定中…" : "回答を判定"}
            </button>
          </form>

          {activeProblem.hintCount > 0 ? (
            <div className="umigame-control-block umigame-hint-block">
              <div className="umigame-hint-head">
                <h2>ヒント</h2>
                <span className="umigame-count">
                  {revealedHints.length}/{activeProblem.hintCount}
                </span>
              </div>

              {revealedHints.length > 0 ? (
                <ol className="umigame-hints">
                  {revealedHints.map((hint) => (
                    <li key={hint.level}>
                      <span>{hint.level}</span>
                      <p>{hint.text}</p>
                    </li>
                  ))}
                </ol>
              ) : null}

              <button
                type="button"
                className="btn site-button umigame-hint-button umigame-hint-button--warning"
                onClick={handleHint}
                disabled={
                  !canPlay ||
                  hintPending ||
                  revealedHints.length >= activeProblem.hintCount
                }
              >
                <Lightbulb size={15} aria-hidden="true" />
                {hintPending
                  ? "表示中…"
                  : revealedHints.length >= activeProblem.hintCount
                    ? "すべて表示済み"
                    : "ヒントを見る"}
              </button>
            </div>
          ) : null}

          <div className="umigame-control-block umigame-control-block--minor">
            <button
              type="button"
              className="btn site-button umigame-give-up-button"
              onClick={handleGiveUp}
              disabled={!canPlay || giveUpPending}
            >
              {giveUpPending ? "処理中…" : "ギブアップ"}
            </button>
          </div>
        </aside>
      </div>

      {resultOverlay ? (
        <UmigameDialog
          className="umigame-result-overlay"
          labelledBy="umigame-result-title"
          onDismiss={() => navigate(`/games/umigame/p/${puzzle.displayId}`)}
        >
          <div className="umigame-result-overlay__panel">
            <div className="umigame-result-overlay__head">
              <h2 id="umigame-result-title">
                {resultOverlay.outcome === "solved"
                  ? "正解"
                  : "ギブアップ"}
              </h2>
            </div>

            <section className="umigame-result-overlay__truth">
              <h3>真相</h3>
              <p>{resultOverlay.truth}</p>
            </section>

            <dl className="umigame-result-overlay__stats">
              <div>
                <dt>質問</dt>
                <dd>{resultOverlay.stats.questionCount}回</dd>
              </div>
              <div>
                <dt>真相回答</dt>
                <dd>{resultOverlay.stats.guessCount}回</dd>
              </div>
              <div>
                <dt>ヒント</dt>
                <dd>{resultOverlay.stats.hintCount}回</dd>
              </div>
              <div>
                <dt>プレイ時間</dt>
                <dd>{formatDuration(resultOverlay.stats.durationMs)}</dd>
              </div>
            </dl>

            <Link
              to={`/games/umigame/p/${puzzle.displayId}`}
              className="btn site-button umigame-result-overlay__back"
            >
              問題詳細に戻る
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </UmigameDialog>
      ) : null}
    </PageLayout>
  );
}
