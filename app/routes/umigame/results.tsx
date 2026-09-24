import { Link, data, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { requireUmigameUser } from "~/utils/umigame/auth.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { listUserFirstPlayResults } from "~/utils/umigame/user.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `プレイ結果 | ウミガメのスープ | ${siteConfig.fullName}` },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  const requestedPage = Number(new URL(request.url).searchParams.get("page") ?? "1");
  const results = await listUserFirstPlayResults(db, user.id, requestedPage);
  return data(results, { headers: { "Cache-Control": "private, no-store" } });
}

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) return `${hours}時間${minutes}分${remainder}秒`;
  if (minutes > 0) return `${minutes}分${remainder}秒`;
  return `${remainder}秒`;
}

export default function UmigameResultsPage() {
  const { results, page, pageCount } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-results-head">
        <h2>プレイ結果</h2>
      </section>

      {results.length === 0 ? (
        <div className="empty-card umigame-empty-state">
          <p>記録されたプレイ結果はありません。</p>
          <Link to="/games/umigame" className="btn site-button site-button--ghost site-button--small">
            問題一覧を見る
          </Link>
        </div>
      ) : (
        <div className="umigame-results-list">
          {results.map((result) => (
            <article key={result.puzzleId} className="umigame-result-record">
              <div className="umigame-result-record__head">
                <div>
                  <h3>{result.title}</h3>
                </div>
                <span className="status-pill">
                  {result.outcome === "solved" ? "真相に到達" : "ギブアップ"}
                </span>
              </div>
              <time dateTime={new Date(result.completedAt).toISOString()}>
                完了：{dateFormatter.format(result.completedAt)} JST
              </time>
              <dl className="umigame-result-record__stats">
                <div><dt>質問</dt><dd>{result.questionCount}回</dd></div>
                <div><dt>真相回答</dt><dd>{result.guessCount}回</dd></div>
                <div><dt>ヒント</dt><dd>{result.hintCount}回</dd></div>
                <div><dt>プレイ時間</dt><dd>{formatDuration(result.durationMs)}</dd></div>
              </dl>
              {result.published ? (
                <Link to={`/games/umigame/p/${result.displayId}`} className="umigame-result-record__link">
                  この問題の現在の内容を見る
                </Link>
              ) : (
                <span className="umigame-result-record__unavailable">この問題は現在公開されていません。</span>
              )}
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 ? (
        <nav className="umigame-results-pages" aria-label="プレイ結果のページ">
          {page > 1 ? <Link to={`?page=${page - 1}`}>前のページ</Link> : <span />}
          <span>{page} / {pageCount}</span>
          {page < pageCount ? <Link to={`?page=${page + 1}`}>次のページ</Link> : <span />}
        </nav>
      ) : null}
    </PageLayout>
  );
}
