import {
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { Activity, ArrowLeft, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import {
  applyAdminCommentAction,
  applyAdminPuzzleAction,
  getAdminJevSummary,
  listAdminFlaggedComments,
  listAdminPuzzleReviews,
  requireUmigameAdmin,
} from "~/utils/umigame/admin.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `管理 | ウミガメのスープ | ${siteConfig.fullName}` },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireUmigameAdmin(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));  const [puzzles, comments, jev] = await Promise.all([
    listAdminPuzzleReviews(db),
    listAdminFlaggedComments(db),
    getAdminJevSummary(db),
  ]);
  return { puzzles, comments, jev };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const admin = await requireUmigameAdmin(request, context);
  const env = getUmigameEnv(context);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const target = String(form.get("target") ?? "");
  const id = String(form.get("id") ?? "");
  const actionName = String(form.get("action") ?? "");

  if (target === "puzzle" && ["publish", "hide", "reject", "restore", "rerun"].includes(actionName)) {
    await applyAdminPuzzleAction(env, admin.id, id, actionName as "publish" | "hide" | "reject" | "restore" | "rerun");
    return redirect("/games/umigame/admin");
  }
  if (target === "comment" && ["show", "spoiler", "hide", "rerun"].includes(actionName)) {
    await applyAdminCommentAction(env, admin.id, id, actionName as "show" | "spoiler" | "hide" | "rerun");
    return redirect("/games/umigame/admin");
  }
  throw new Response("Invalid admin action.", { status: 400 });
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}export default function UmigameAdminPage() {
  const { puzzles, comments, jev } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-admin-head">
        <div>
          <h2>ウミガメ管理</h2>
        </div>
        <div className="umigame-admin-head__actions">
          <Link
            to="/games/umigame/admin/jev"
            className="btn site-button site-button--ghost"
          >
            <Activity size={15} aria-hidden="true" />
            Jev監視
          </Link>
          <ShieldCheck size={30} aria-hidden="true" />
        </div>
      </section>

      <section className="umigame-admin-stats" aria-label="Jev statistics">
        <div><strong>{jev.total}</strong><span>Jev実行 / 24h</span></div>
        <div><strong>{jev.errors}</strong><span>エラー / 24h</span></div>
        <div><strong>{jev.inputTokens + jev.outputTokens}</strong><span>tokens / 24h</span></div>
        <div><strong>{jev.avgLatency}ms</strong><span>平均latency</span></div>
      </section>      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <h2>問題レビュー</h2>
          <span className="umigame-count">{puzzles.length}件</span>
        </div>
        {puzzles.length === 0 ? (
          <p className="empty-card">確認が必要な問題はありません。</p>
        ) : (
          <div className="umigame-admin-list">
            {puzzles.map((puzzle) => (
              <article key={puzzle.puzzleId} className="umigame-admin-card">
                <div className="umigame-admin-card__head">
                  <div>
                    <span className="status-pill">{statusLabel(puzzle.status)}</span>
                    <h3>{puzzle.title}</h3>
                  </div>
                  {puzzle.status === "published" ? (
                    <Link to={`/games/umigame/p/${puzzle.displayId}`} target="_blank">
                      #{puzzle.displayId} <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                  ) : (
                    <span>#{puzzle.displayId}</span>
                  )}
                </div>
                <p><strong>作者:</strong> {puzzle.authorDisplayName ?? "seed / 不明"}</p>
                <p><strong>問題文:</strong> {puzzle.statement}</p>
                <details>
                  <summary>真相・Jev審査結果</summary>
                  <div className="umigame-admin-secret">
                    <p><strong>真相:</strong> {puzzle.canonicalTruth}</p>
                    <p><strong>Revision:</strong> v{puzzle.version} / {puzzle.difficulty}</p>
                    <p><strong>Jev:</strong> {puzzle.latestReason ?? "審査記録なし"}</p>
                    {puzzle.similarPuzzles.length > 0 ? (
                      <div className="umigame-admin-similarity">
                        <strong>類似候補</strong>
                        <div>
                          {puzzle.similarPuzzles.map((similar) => (
                            <Link
                              key={similar.puzzleId}
                              to={`/games/umigame/p/${similar.displayId}`}
                              target="_blank"
                            >
                              <span>#{similar.displayId} {similar.title}</span>
                              <span>{Math.round(similar.probability * 100)}%</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {puzzle.latestJevResult ? <pre>{JSON.stringify(puzzle.latestJevResult, null, 2)}</pre> : null}
                  </div>
                </details>
                <Form method="post" className="umigame-admin-actions">
                  <input type="hidden" name="target" value="puzzle" />
                  <input type="hidden" name="id" value={puzzle.puzzleId} />

                  <div className="umigame-admin-actions__primary">
                    {["needs_review", "pending_review", "draft"].includes(puzzle.status) ? (
                      <button name="action" value="publish" className="btn site-button" disabled={busy}>
                        公開
                      </button>
                    ) : null}
                    {["hidden", "rejected"].includes(puzzle.status) ? (
                      <button name="action" value="restore" className="btn site-button" disabled={busy}>
                        復元
                      </button>
                    ) : null}
                    {puzzle.status !== "pending_review" ? (
                      <button
                        name="action"
                        value="rerun"
                        className="btn site-button site-button--ghost"
                        disabled={busy}
                      >
                        <RefreshCw size={14} aria-hidden="true" /> Jev再審査
                      </button>
                    ) : null}
                  </div>

                  {puzzle.status !== "rejected" ? (
                    <div className="umigame-admin-actions__danger">
                      {puzzle.status === "published" ? (
                        <button
                          name="action"
                          value="hide"
                          className="btn site-button site-button--ghost umigame-admin-danger-button"
                          disabled={busy}
                          onClick={(event) => {
                            if (!window.confirm("この問題を非公開にする？")) event.preventDefault();
                          }}
                        >
                          非公開
                        </button>
                      ) : null}
                      <button
                        name="action"
                        value="reject"
                        className="btn site-button site-button--ghost umigame-admin-danger-button"
                        disabled={busy}
                        onClick={(event) => {
                          if (!window.confirm("この問題を却下する？")) event.preventDefault();
                        }}
                      >
                        却下
                      </button>
                    </div>
                  ) : null}
                </Form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <h2>コメント・通報</h2>
          <span className="umigame-count">{comments.length}件</span>
        </div>
        {comments.length === 0 ? (
          <p className="empty-card">確認が必要なコメントはありません。</p>
        ) : (
          <div className="umigame-admin-list">
            {comments.map((comment) => (
              <article key={comment.id} className="umigame-admin-card">                <div className="umigame-admin-card__head">
                  <div>
                    <span className="status-pill">{statusLabel(comment.status)}</span>
                    <h3>{comment.authorDisplayName}</h3>
                  </div>
                  <Link to={`/games/umigame/p/${comment.puzzleDisplayId}#comments`} target="_blank">
                    {comment.puzzleTitle} <ExternalLink size={13} aria-hidden="true" />
                  </Link>
                </div>
                <p>{comment.body}</p>
                <p className="umigame-admin-meta">通報 {comment.reportCount}件</p>
                <Form method="post" className="umigame-admin-actions">
                  <input type="hidden" name="target" value="comment" />
                  <input type="hidden" name="id" value={comment.id} />
                  <button name="action" value="show" className="btn site-button" disabled={busy}>表示</button>
                  <button name="action" value="spoiler" className="btn site-button site-button--ghost" disabled={busy}>ネタバレ</button>
                  <button name="action" value="hide" className="btn site-button site-button--ghost" disabled={busy}>非表示</button>
                  <button name="action" value="rerun" className="btn site-button site-button--ghost" disabled={busy}>
                    <RefreshCw size={14} aria-hidden="true" /> Jev再審査
                  </button>
                </Form>
              </article>
            ))}
          </div>
        )}
      </section>      <section className="umigame-admin-section">
        <div className="umigame-section-head">
          <h2>最近のJev実行</h2>
          <span className="umigame-count">{jev.latestRuns.length}件</span>
        </div>
        <div className="umigame-admin-run-list">
          {jev.latestRuns.map((run, index) => (
            <div key={`${run.created_at}-${index}`} className="umigame-admin-run">
              <span className="status-pill">{run.status}</span>
              <strong>{run.purpose}</strong>
              <span>{run.model ?? "model不明"}</span>
              <span>{run.provider}</span>
              {run.primary_error ? <code>{run.primary_error}</code> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="umigame-admin-section">
        <h2>DLQ</h2>
        <p>
          DLQのメッセージ本文・個別操作はCloudflare Dashboardで確認します。
          管理画面には将来的に件数・異常有無だけを表示し、失敗したJev実行の調査は上の実行履歴と併用します。
        </p>
      </section>
    </PageLayout>
  );
}
