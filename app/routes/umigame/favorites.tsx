import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { ArrowRight, Play } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { UmigameAuthor } from "~/components/umigame/UmigameAuthor";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { requireUmigameUser } from "~/utils/umigame/auth.server";
import { listFavoritePuzzles } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `お気に入り | ウミガメのスープ | ${siteConfig.fullName}` },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  const puzzles = await listFavoritePuzzles(db, user.id);
  return { puzzles };
}

export default function UmigameFavoritesPage() {
  const { puzzles } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-favorites-head">
        <div>
          <h2>お気に入り</h2>
        </div>
      </section>

      {puzzles.length === 0 ? (
        <div className="empty-card umigame-empty-state">
          <p>お気に入りに登録した問題はありません。</p>
          <Link
            to="/games/umigame"
            className="btn site-button site-button--ghost site-button--small"
          >
            問題一覧を見る
          </Link>
        </div>
      ) : (
        <div className="umigame-favorite-list">
          {puzzles.map((puzzle) => (
            <article key={puzzle.id} className="umigame-favorite-card">
              <div className="umigame-favorite-card__head">
                <div>
                  <Link to={`/games/umigame/p/${puzzle.displayId}`}>
                    <h2>{puzzle.title}</h2>
                  </Link>
                  {puzzle.author ? (
                    <UmigameAuthor author={puzzle.author} size={24} />
                  ) : null}
                </div>
                <UmigameDifficulty value={puzzle.difficulty} />
              </div>

              <p>{puzzle.statement}</p>

              {puzzle.tags.length > 0 ? (
                <div className="umigame-tag-list" aria-label="タグ">
                  {puzzle.tags.map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </div>
              ) : null}

              <div className="umigame-favorite-card__footer">
                <div className="umigame-favorite-card__meta">
                  <span className="umigame-play-count">
                    <Play size={15} aria-hidden="true" />
                    {puzzle.playCount}
                  </span>
                  <span>評価 {puzzle.voteScore}</span>
                </div>

                <div className="umigame-favorite-card__actions">
                  <Link
                    to={`/games/umigame/p/${puzzle.displayId}`}
                    className="btn site-button site-button--ghost"
                  >
                    問題詳細
                  </Link>
                  <Link
                    to={`/games/umigame/p/${puzzle.displayId}/play`}
                    className="btn site-button"
                  >
                    この問題を遊ぶ
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
