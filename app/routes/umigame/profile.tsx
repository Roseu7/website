import { Play } from "lucide-react";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import { UmigameAvatar } from "~/utils/umigame/avatar";
import { listPublishedPuzzlesByAuthor } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import {
  getUmigameProfileStats,
  getUmigameUserByUsername,
} from "~/utils/umigame/user.server";
import { siteConfig } from "~/utils/site";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const username = params.username?.trim() ?? "";
  if (!/^[a-z0-9_-]{3,64}$/i.test(username)) {
    throw new Response("Not Found", { status: 404 });
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const user = await getUmigameUserByUsername(db, username);
  if (!user) throw new Response("Not Found", { status: 404 });

  const [viewer, stats, puzzles] = await Promise.all([
    getOptionalUmigameUser(request, context),
    getUmigameProfileStats(db, user.id),
    listPublishedPuzzlesByAuthor(db, user.id),
  ]);
  return { user, stats, puzzles, isOwner: viewer?.id === user.id };
}

export const meta = ({ data }: { data?: { user?: { displayName?: string } } }) => [
  { title: `${data?.user?.displayName ?? "プロフィール"} | ウミガメのスープ | ${siteConfig.fullName}` },
];

export default function UmigameProfilePage() {
  const { user, stats, puzzles, isOwner } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-public-profile-head">
        <UmigameAvatar
          userId={user.id}
          type={user.avatarType}
          icon={user.avatarIcon}
          color={user.avatarColor}
          externalUrl={user.externalAvatarUrl}
          size={64}
        />
        <div>
          <h2>{user.displayName}</h2>
          <span>@{user.username}</span>
        </div>
        {isOwner ? (
          <div className="umigame-public-profile-head__actions">
            <Link to="/games/umigame/results" className="btn site-button site-button--ghost">
              プレイ結果
            </Link>
            <Link to="/games/umigame/author/quality" className="btn site-button site-button--ghost">
              作者向け分析
            </Link>
          </div>
        ) : null}
      </section>

      <section className="umigame-profile-stats" aria-label="プロフィール統計">
        <div><span>プレイ済み</span><strong>{stats.playedCount}</strong></div>
        <div><span>真相到達数</span><strong>{stats.truthReachedCount}</strong></div>
      </section>

      <section className="umigame-profile-puzzles">
        <div className="umigame-section-head">
          <h2>投稿した問題</h2>
        </div>

        {puzzles.length === 0 ? (
          <p className="empty-card">公開中の問題はありません。</p>
        ) : (
          <div className="umigame-profile-puzzle-list">
            {puzzles.map((puzzle) => (
              <Link
                key={puzzle.id}
                to={`/games/umigame/p/${puzzle.displayId}`}
                className="umigame-profile-puzzle"
              >
                <div>
                  <h3>{puzzle.title}</h3>
                  <UmigameDifficulty value={puzzle.difficulty} />
                </div>
                <span className="umigame-play-count" aria-label={`プレイ数 ${puzzle.playCount}`}>
                  <Play size={14} aria-hidden="true" />
                  {puzzle.playCount}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
