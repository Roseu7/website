import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Copy, GripVertical, Triangle, X } from "lucide-react";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { isJevAuthenticated } from "~/utils/jev/access.server";
import { siteConfig } from "~/utils/site";

type AnswerType = "boolean" | "choice" | "score";

interface CriterionItem {
  id: number;
  text: string;
}

interface JevApiError {
  code?: string;
  message?: string;
  source?: string;
  retryable?: boolean;
  upstream_status?: number | null;
  upstream_type?: string | null;
  upstream_code?: number | null;
  detail?: string;
}

interface JevAnswer {
  type?: AnswerType;
  probability?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  score?: number;
}

interface JevResponse {
  model?: string;
  answers?: Record<string, JevAnswer>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  translation?: {
    enabled?: boolean;
    target_language?: string | null;
  };
}

interface ResultContext {
  answerType: AnswerType;
  criteria: string[];
}

export const meta = () => [
  { title: `Jev | ${siteConfig.fullName}` },
  { name: "description", content: "Jev evaluation tool" },
  { name: "robots", content: "noindex, nofollow" },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  return {
    authenticated: await isJevAuthenticated(request, context),
  };
}

const INITIAL_CHOICE: CriterionItem[] = [
  { id: 1, text: "" },
  { id: 2, text: "" },
  { id: 3, text: "" },
];

const INITIAL_SCORE: CriterionItem[] = [
  { id: 4, text: "" },
  { id: 5, text: "" },
  { id: 6, text: "" },
];

function percent(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`;
}

function sourceLabel(source: string | undefined) {
  if (source === "cloudflare_workers_ai") return "Cloudflare Workers AI";
  if (source === "vercel_ai_gateway") return "Vercel AI Gateway";
  if (source === "jev") return "Jev";
  if (source === "website_proxy") return "website proxy";
  return source ?? "API";
}

export default function JevPage() {
  const { authenticated } = useLoaderData<typeof loader>();
  const [stateText, setStateText] = useState("");
  const [question, setQuestion] = useState("");
  const [answerType, setAnswerType] = useState<AnswerType>("boolean");
  const [translate, setTranslate] = useState(false);
  const [choiceItems, setChoiceItems] = useState<CriterionItem[]>(INITIAL_CHOICE);
  const [scoreItems, setScoreItems] = useState<CriterionItem[]>(INITIAL_SCORE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<JevApiError | null>(null);
  const [result, setResult] = useState<JevResponse | null>(null);
  const [resultContext, setResultContext] = useState<ResultContext | null>(null);
  const [draggedCriterionId, setDraggedCriterionId] = useState<number | null>(null);
  const [jsonCopied, setJsonCopied] = useState(false);
  const nextId = useRef(7);

  const criteriaItems = answerType === "choice" ? choiceItems : scoreItems;
  const criteriaValid = answerType === "boolean"
    || (criteriaItems.length >= 2 && criteriaItems.every((item) => item.text.trim().length > 0));
  const canSubmit = question.trim().length > 0 && criteriaValid && !pending;

  const setCriteriaItems = (updater: (items: CriterionItem[]) => CriterionItem[]) => {
    if (answerType === "choice") setChoiceItems(updater);
    else setScoreItems(updater);
  };

  const updateCriterion = (id: number, text: string) => {
    setCriteriaItems((items) => items.map((item) => item.id === id ? { ...item, text } : item));
  };

  const addCriterion = () => {
    const id = nextId.current++;
    setCriteriaItems((items) => [...items, { id, text: "" }]);
  };

  const removeCriterion = (id: number) => {
    setCriteriaItems((items) => items.length <= 2 ? items : items.filter((item) => item.id !== id));
  };

  const moveCriterion = (index: number, offset: -1 | 1) => {
    setCriteriaItems((items) => {
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= items.length) return items;

      const next = [...items];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const resetCriteria = () => {
    const nextItems = Array.from({ length: 3 }, () => ({
      id: nextId.current++,
      text: "",
    }));

    if (answerType === "choice") {
      setChoiceItems(nextItems);
    } else if (answerType === "score") {
      setScoreItems(nextItems);
    }
  };

  const handleCriterionDragStart = (
    event: DragEvent<HTMLElement>,
    id: number
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
    setDraggedCriterionId(id);
  };

  const handleCriterionDragEnter = (targetId: number) => {
    if (draggedCriterionId === null || draggedCriterionId === targetId) return;

    setCriteriaItems((items) => {
      const sourceIndex = items.findIndex((item) => item.id === draggedCriterionId);
      const targetIndex = items.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return items;

      const next = [...items];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleCriterionDragEnd = () => {
    setDraggedCriterionId(null);
  };

  const copyResultJson = async () => {
    if (!result) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setJsonCopied(true);
      window.setTimeout(() => setJsonCopied(false), 1600);
    } catch {
      setJsonCopied(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const criteria = answerType === "boolean"
      ? []
      : criteriaItems.map((item) => item.text.trim());

    const q0 = answerType === "boolean"
      ? { type: "boolean", instructions: question.trim() }
      : answerType === "choice"
        ? {
            type: "choice",
            instructions: question.trim(),
            criteria: Object.fromEntries(criteria.map((text, index) => [String(index), text])),
          }
        : {
            type: "score",
            instructions: question.trim(),
            criteria,
          };

    const payload: Record<string, unknown> = {
      translate,
      questions: { q0 },
    };
    if (stateText.trim()) payload.state = stateText.trim();

    setPending(true);
    setError(null);
    setResult(null);
    setResultContext({ answerType, criteria });

    try {
      const response = await fetch("/api/jev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: JevResponse & { error?: JevApiError };
      try {
        data = JSON.parse(text) as JevResponse & { error?: JevApiError };
      } catch {
        throw new Error(text || `HTTP ${response.status}`);
      }

      if (!response.ok || data.error) {
        setError(data.error ?? {
          code: "HTTP_ERROR",
          message: `HTTP ${response.status}`,
          source: "website_proxy",
        });
        return;
      }

      setResult(data);
    } catch (caught) {
      setError({
        code: "NETWORK_ERROR",
        message: caught instanceof Error ? caught.message : "リクエストに失敗しました。",
        source: "website_proxy",
        retryable: true,
      });
    } finally {
      setPending(false);
    }
  };

  const answer = result?.answers?.q0;
  const probabilities = useMemo(
    () => Object.entries(answer?.probabilities ?? {}).sort(([a], [b]) => Number(a) - Number(b)),
    [answer?.probabilities]
  );
  const scoreMax = Math.max(0, (resultContext?.criteria.length ?? 1) - 1);
  const scorePosition = answer?.type === "score"
    && typeof answer.score === "number"
    && scoreMax > 0
      ? Math.min(100, Math.max(0, (answer.score / scoreMax) * 100))
      : 0;
  const scoreTicks = useMemo(
    () => scoreMax > 0
      ? Array.from({ length: scoreMax * 2 + 1 }, (_, index) => index / 2)
      : [],
    [scoreMax]
  );

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Jev" headingLevel="h2" />

      {!authenticated ? (
        <section className="jev-login">
          <a className="btn site-button" href="/api/jev/login">
            ログイン
          </a>
        </section>
      ) : (
        <section className="jev-layout">
          <form className="jev-panel jev-form" onSubmit={handleSubmit}>
            <label className="jev-field">
              <span className="jev-field__label">State</span>
              <textarea
                className="jev-textarea"
                value={stateText}
                onChange={(event) => setStateText(event.target.value)}
                placeholder="ここに状況を入力"
                rows={6}
              />
            </label>

            <label className="jev-field">
              <span className="jev-field__label">Question</span>
              <textarea
                className="jev-textarea"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="ここに質問を入力"
                rows={4}
                required
              />
            </label>

            <div className="jev-settings">
              <label className="jev-field">
                <span className="jev-field__label">Answer format</span>
                <select
                  className="jev-select"
                  value={answerType}
                  onChange={(event) => setAnswerType(event.target.value as AnswerType)}
                >
                  <option value="boolean">Boolean</option>
                  <option value="choice">Choice</option>
                  <option value="score">Score</option>
                </select>
              </label>

              <label className="jev-toggle">
                <input
                  type="checkbox"
                  checked={translate}
                  onChange={(event) => setTranslate(event.target.checked)}
                />
                <span>英語に翻訳</span>
              </label>
            </div>

            {answerType !== "boolean" ? (
              <div className="jev-criteria">
                <div className="jev-section-heading">
                  <span className="jev-field__label">
                    {answerType === "choice" ? "Choices" : "Score criteria"}
                  </span>
                  <div className="jev-criteria__header-actions">
                    <button
                      type="button"
                      className="btn site-button site-button--ghost site-button--small"
                      onClick={resetCriteria}
                    >
                      リセット
                    </button>
                    <button
                      type="button"
                      className="btn site-button site-button--ghost site-button--small"
                      onClick={addCriterion}
                    >
                      追加
                    </button>
                  </div>
                </div>

                <div className="jev-criteria__list">
                  {criteriaItems.map((item, index) => (
                    <div
                      className={`jev-criterion${draggedCriterionId === item.id ? " is-dragging" : ""}`}
                      key={item.id}
                      onDragEnter={() => handleCriterionDragEnter(item.id)}
                      onDragOver={(event) => event.preventDefault()}
                    >
                      <span
                        className="jev-drag-handle"
                        draggable
                        onDragStart={(event) => handleCriterionDragStart(event, item.id)}
                        onDragEnd={handleCriterionDragEnd}
                        aria-label="ドラッグして並び替え"
                      >
                        <GripVertical aria-hidden="true" size={18} />
                      </span>
                      <span className="jev-criterion__index">{index}</span>
                      <input
                        className="jev-input"
                        value={item.text}
                        onChange={(event) => updateCriterion(item.id, event.target.value)}
                        placeholder={answerType === "choice" ? "選択肢を入力" : "評価基準を入力"}
                        draggable={false}
                      />
                      <div className="jev-criterion__actions">
                        <button
                          type="button"
                          className="jev-mini-button jev-mini-button--mobile-reorder"
                          onClick={() => moveCriterion(index, -1)}
                          disabled={index === 0}
                          aria-label="上へ移動"
                        >
                          <ChevronUp size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="jev-mini-button jev-mini-button--mobile-reorder"
                          onClick={() => moveCriterion(index, 1)}
                          disabled={index === criteriaItems.length - 1}
                          aria-label="下へ移動"
                        >
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="jev-mini-button"
                          onClick={() => removeCriterion(item.id)}
                          disabled={criteriaItems.length <= 2}
                          aria-label="削除"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="jev-submit">
              <button className="btn site-button" type="submit" disabled={!canSubmit}>
                {pending ? "実行中…" : "実行"}
              </button>
            </div>

            {error ? (
              <section className="jev-error" aria-live="polite">
                <div className="jev-error__top">
                  <strong>{error.message ?? "エラーが発生しました。"}</strong>
                  <span>{sourceLabel(error.source)}</span>
                </div>
                <div className="jev-error__meta">
                  {error.code ? <span>{error.code}</span> : null}
                  {typeof error.upstream_status === "number" ? <span>HTTP {error.upstream_status}</span> : null}
                  {typeof error.upstream_code === "number" ? <span>Code {error.upstream_code}</span> : null}
                  {error.retryable ? <span>retryable</span> : null}
                </div>
                {error.detail ? (
                  <details className="jev-error__details">
                    <summary>詳細</summary>
                    <pre>{error.detail}</pre>
                  </details>
                ) : null}
              </section>
            ) : null}
          </form>

          <section className="jev-panel jev-results" aria-live="polite">
            <div className="jev-section-heading">
              <h2 className="jev-title">Result</h2>
              {result?.translation?.enabled ? <span className="status-pill jev-translation-badge">EN</span> : null}
            </div>

            {!result || !answer || !resultContext ? (
              <p className="jev-empty">{pending ? "実行中…" : "未実行"}</p>
            ) : (
              <>
                {answer.type === "boolean" ? (
                  <div className="jev-result-main">
                    <span className="jev-result-main__label">Probability</span>
                    <strong className="jev-result-main__value">{percent(answer.probability)}</strong>
                  </div>
                ) : null}

                {answer.type === "choice" ? (
                  <div className="jev-result-main">
                    <span className="jev-result-main__label">Choice</span>
                    <strong className="jev-result-main__value jev-result-main__value--text">
                      {answer.choice !== undefined
                        ? resultContext.criteria[Number(answer.choice)] ?? answer.choice
                        : "-"}
                    </strong>
                  </div>
                ) : null}

                {answer.type === "score" ? (
                  <div className="jev-result-main">
                    <span className="jev-result-main__label">Score</span>
                    <strong className="jev-result-main__value">
                      {typeof answer.score === "number" ? answer.score.toFixed(2) : "-"}
                    </strong>
                  </div>
                ) : null}

                {probabilities.length > 0 ? (
                  answer.type === "score" ? (
                    <div className="jev-score-breakdown">
                      <div className="jev-probabilities">
                        {probabilities.map(([key, value]) => (
                          <div className="jev-probability" key={key}>
                            <div className="jev-probability__head">
                              <span>{resultContext.criteria[Number(key)] ?? key}</span>
                              <span>{percent(value)}</span>
                            </div>
                            <progress value={value} max={1} />
                          </div>
                        ))}
                      </div>

                      <div
                        className="jev-score-position"
                        aria-label={`スコア位置 ${typeof answer.score === "number" ? answer.score.toFixed(2) : "-"} / ${scoreMax}`}
                      >
                        <div className="jev-score-position__track">
                          <span
                            className="jev-score-position__marker"
                            style={{ top: `${scorePosition}%` }}
                          >
                            <Triangle size={14} fill="currentColor" aria-hidden="true" />
                          </span>

                          <div className="jev-score-position__ticks" aria-hidden="true">
                            {scoreTicks.map((tick) => {
                              const isMajor = Number.isInteger(tick);
                              const top = scoreMax > 0 ? (tick / scoreMax) * 100 : 0;

                              return (
                                <span
                                  className={`jev-score-position__tick${isMajor ? " is-major" : ""}`}
                                  key={tick}
                                  style={{ top: `${top}%` }}
                                >
                                  <span className="jev-score-position__tick-line" />
                                  {isMajor ? (
                                    <span className="jev-score-position__tick-label">{tick}</span>
                                  ) : null}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="jev-probabilities">
                      {probabilities.map(([key, value]) => (
                        <div className="jev-probability" key={key}>
                          <div className="jev-probability__head">
                            <span>{resultContext.criteria[Number(key)] ?? key}</span>
                            <span>{percent(value)}</span>
                          </div>
                          <progress value={value} max={1} />
                        </div>
                      ))}
                    </div>
                  )
                ) : null}

                {result.usage ? (
                  <div className="jev-usage">
                    <span>Input {result.usage.inputTokens ?? "-"} tokens</span>
                    <span>Output {result.usage.outputTokens ?? "-"} tokens</span>
                  </div>
                ) : null}

                <details className="jev-raw">
                  <summary>JSON</summary>
                  <div className="jev-raw__content">
                    <button
                      type="button"
                      className={`jev-copy-button${jsonCopied ? " is-copied" : ""}`}
                      onClick={copyResultJson}
                      aria-label={jsonCopied ? "コピー済み" : "JSONをコピー"}
                      title={jsonCopied ? "コピー済み" : "JSONをコピー"}
                    >
                      <Copy size={16} aria-hidden="true" />
                    </button>
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  </div>
                </details>
              </>
            )}
          </section>
        </section>
      )}
    </PageLayout>
  );
}
