import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { requireUmigameUser } from "~/utils/umigame/auth.server";
import {
  getAuthorQualityAnalytics,
  type AuthorQualityReviewMetrics,
} from "~/utils/umigame/author-quality.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  return getAuthorQualityAnalytics(db, user);
}

export const meta = () => [
  { title: `作者向け分析 | ウミガメのスープ | ${siteConfig.fullName}` },
];

function percent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function decimal(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
  }).format(value);
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    published: "公開中",
    pending_review: "審査中",
    needs_review: "確認待ち",
    hidden: "非公開",
    rejected: "却下",
    draft: "下書き",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

const REVIEW_METRICS: Array<{
  key: keyof AuthorQualityReviewMetrics;
  label: string;
  direction: "higher" | "lower";
  help: string;
}> = [
  {
    key: "truthExplainsProblem",
    label: "真相の説明力",
    direction: "higher",
    help: "真相が問題文の重要な出来事や違和感を説明できている確率。",
  },
  {
    key: "fairToPlayer",
    label: "プレイヤーへの公平性",
    direction: "higher",
    help: "YES/NO質問を重ねれば、恣意的な当てずっぽうなしに辿れる確率。",
  },
  {
    key: "contradiction",
    label: "内部矛盾",
    direction: "lower",
    help: "問題文・真相・重要事実の間に大きな矛盾がある確率。",
  },
  {
    key: "multipleMajorSolutions",
    label: "大きな別解",
    direction: "lower",
    help: "大きく異なる複数の真相が同程度に成立する確率。",
  },
  {
    key: "arbitraryPosthoc",
    label: "後付け性",
    direction: "lower",
    help: "自由な設定を足せば成立するだけの、恣意的な真相になっている確率。",
  },
  {
    key: "tooTrivial",
    label: "自明さ",
    direction: "lower",
    help: "問題文から答えがほぼ直接分かり、水平思考の余地が少ない確率。",
  },
  {
    key: "requiresUnstatedExternalKnowledge",
    label: "外部知識依存",
    direction: "lower",
    help: "通常の質問だけでは補いづらい専門知識を必要とする確率。",
  },
  {
    key: "problemTextLeaksAnswer",
    label: "問題文からの答え漏れ",
    direction: "lower",
    help: "本来隠すべき真相の中核を問題文が直接明かしている確率。",
  },
];

function reviewReasonLabels(reason: string | null) {
  if (!reason) return [];
  const labels: Record<string, string> = {
    contradiction: "内部矛盾",
    arbitrary_posthoc: "後付け性",
    multiple_major_solutions: "大きな別解",
    truth_explains_problem: "真相の説明不足",
    possible_duplicate: "類似問題候補",
    passed_automatic_review: "自動審査通過",
    manual_admin_override: "管理者操作",
  };
  return reason
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => labels[item] ?? item);
}

export default function UmigameAuthorQualityPage() {
  const { user, overview, puzzles } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink
        fallbackTo={`/games/umigame/u/${user.username}`}
        fallbackLabel="プロフィールに戻る"
      />

      <section className="umigame-author-quality-head">
        <div>
          <h2>作者向け分析</h2>
        </div>
      </section>

      <section
        className="umigame-author-quality-overview"
        aria-label="作者向け集計"
      >
        <div>
          <span>公開問題</span>
          <strong>{overview.publishedCount}</strong>
        </div>
        <div>
          <span>プレイ</span>
          <strong>{overview.totalPlays}</strong>
        </div>
        <div>
          <span>解決</span>
          <strong>{overview.totalSolved}</strong>
        </div>
        <div>
          <span>解決率</span>
          <strong>{percent(overview.solveRate)}</strong>
        </div>
        <div>
          <span>Vote合計</span>
          <strong>{overview.totalVoteScore}</strong>
        </div>
        <div>
          <span>平均質問</span>
          <strong>{decimal(overview.averageQuestions)}</strong>
        </div>
        <div>
          <span>平均真相回答</span>
          <strong>{decimal(overview.averageGuesses)}</strong>
        </div>
        <div>
          <span>平均ヒント</span>
          <strong>{decimal(overview.averageHints)}</strong>
        </div>
      </section>

      <section className="umigame-author-quality-list">
        <div className="umigame-section-head">
          <div>
            <h2>問題ごとの分析</h2>
          </div>
        </div>

        {puzzles.length === 0 ? (
          <div className="empty-card umigame-empty-state">
            <p>まだ投稿した問題がありません。</p>
            <Link
              to="/games/umigame/new"
              className="btn site-button site-button--ghost site-button--small"
            >
              問題を投稿する
            </Link>
          </div>
        ) : (
          <div className="umigame-author-quality-cards">
            {puzzles.map((puzzle) => {
              const reasons = reviewReasonLabels(puzzle.reviewReason);
              return (
                <article
                  key={puzzle.puzzleId}
                  className="umigame-author-quality-card"
                >
                  <div className="umigame-author-quality-card__head">
                    <div>
                      <div className="umigame-author-quality-card__status">
                        <span className="status-pill">
                          {statusLabel(puzzle.status)}
                        </span>
                        <UmigameDifficulty value={puzzle.difficulty} />
                      </div>
                      <h3>{puzzle.title}</h3>
                    </div>
                    <div className="umigame-author-quality-card__actions">
                      {puzzle.displayId && puzzle.status === "published" ? (
                        <Link
                          to={`/games/umigame/p/${puzzle.displayId}`}
                          className="btn site-button site-button--ghost"
                        >
                          問題を見る
                        </Link>
                      ) : null}
                      {puzzle.displayId ? (
                        <Link
                          to={`/games/umigame/p/${puzzle.displayId}/edit`}
                          className="btn site-button site-button--ghost"
                        >
                          編集
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <dl className="umigame-author-quality-card__engagement">
                    <div>
                      <dt>プレイ</dt>
                      <dd>{puzzle.playCount}</dd>
                    </div>
                    <div>
                      <dt>解決</dt>
                      <dd>{puzzle.solvedCount}</dd>
                    </div>
                    <div>
                      <dt>解決率</dt>
                      <dd>
                        {percent(
                          puzzle.playCount > 0
                            ? puzzle.solvedCount / puzzle.playCount
                            : null,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>ギブアップ</dt>
                      <dd>{puzzle.gaveUpCount}</dd>
                    </div>
                    <div>
                      <dt>Vote</dt>
                      <dd>{puzzle.voteScore}</dd>
                    </div>
                    <div>
                      <dt>平均質問</dt>
                      <dd>{decimal(puzzle.averageQuestions)}</dd>
                    </div>
                    <div>
                      <dt>平均真相回答</dt>
                      <dd>{decimal(puzzle.averageGuesses)}</dd>
                    </div>
                    <div>
                      <dt>平均ヒント</dt>
                      <dd>{decimal(puzzle.averageHints)}</dd>
                    </div>
                  </dl>

                  {reasons.length > 0 ? (
                    <div className="umigame-author-quality-card__reasons">
                      {reasons.map((reason) => (
                        <span key={reason} className="status-pill">
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {puzzle.reviewMetrics ? (
                    <div className="umigame-author-quality-review">
                      <div className="umigame-author-quality-review__head">
                        <h4>Jev審査指標</h4>
                        <p>
                          「高いほど良い」「低いほど良い」は指標ごとに異なります。
                          probabilityは品質の総合点ではありません。
                        </p>
                      </div>
                      <div className="umigame-author-quality-metrics">
                        {REVIEW_METRICS.map((metric) => {
                          const value = puzzle.reviewMetrics?.[metric.key] ?? null;
                          return (
                            <div
                              key={metric.key}
                              className="umigame-author-quality-metric"
                              title={metric.help}
                            >
                              <div>
                                <span>{metric.label}</span>
                                <small>
                                  {metric.direction === "higher"
                                    ? "高いほど良い"
                                    : "低いほど良い"}
                                </small>
                              </div>
                              <strong>{percent(value)}</strong>
                              <span
                                className="umigame-author-quality-metric__bar"
                                aria-hidden="true"
                              >
                                <span
                                  style={{
                                    width:
                                      value === null
                                        ? "0%"
                                        : `${Math.round(value * 100)}%`,
                                  }}
                                />
                              </span>
                              <p>{metric.help}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="umigame-author-quality-card__no-review">
                      現在revisionのJev審査データはありません。
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
