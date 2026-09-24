import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { ArrowLeft, ArrowRight, ExternalLink, Pencil, Play } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { PuzzleComments } from "~/components/umigame/PuzzleComments";
import { PuzzleFavorite } from "~/components/umigame/PuzzleFavorite";
import { PuzzleVote } from "~/components/umigame/PuzzleVote";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { UmigameAuthor } from "~/components/umigame/UmigameAuthor";
import { getOptionalUmigameUser } from "~/utils/umigame/auth.server";
import { listPuzzleComments } from "~/utils/umigame/comments.server";
import {
  formatPuzzlePublicId,
  getPublishedPuzzlePublicById,
  getPuzzleFavoriteForUser,
  getPuzzleVoteForUser,
  parsePuzzlePublicId,
} from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const rawId = params.id?.trim() ?? "";
  const publicId = parsePuzzlePublicId(rawId);
  if (!publicId || rawId !== formatPuzzlePublicId(publicId)) {
    throw new Response("Not Found", { status: 404 });
  }

  const db = requireUmigameDb(getUmigameEnv(context));
  const [puzzle, user] = await Promise.all([
    getPublishedPuzzlePublicById(db, publicId),
    getOptionalUmigameUser(request, context),
  ]);
  if (!puzzle) throw new Response("Not Found", { status: 404 });
  const [comments, viewerVote, viewerFavorite] = await Promise.all([
    listPuzzleComments(db, puzzle.id, user?.id ?? null),
    user ? getPuzzleVoteForUser(db, puzzle.id, user.id) : Promise.resolve(null),
    user ? getPuzzleFavoriteForUser(db, puzzle.id, user.id) : Promise.resolve(false),
  ]);
  return { puzzle, user, comments, viewerVote, viewerFavorite };
}

export const meta = ({ data }: { data?: { puzzle?: { title?: string } } }) => [
  { title: `${data?.puzzle?.title ?? "問題"} | ウミガメのスープ | ${siteConfig.fullName}` },
];

export default function UmigamePuzzlePage() {
  const { puzzle, user, comments, viewerVote, viewerFavorite } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack">
      <section className="umigame-detail-head">
        <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

        <div className="umigame-detail-head__main">
          <div className="umigame-detail-head__title">
            <h2>{puzzle.title}</h2>
            {puzzle.author ? <UmigameAuthor author={puzzle.author} size={30} /> : null}
          </div>

          <div className="umigame-detail-head__toolbar">
            <div className="umigame-detail-head__stats">
              <span
                className="umigame-play-count"
                aria-label={`プレイ数 ${puzzle.playCount}`}
              >
                <Play size={17} aria-hidden="true" />
                <span className="umigame-icon-pair__value">
                  {puzzle.playCount}
                </span>
              </span>
              <UmigameDifficulty value={puzzle.difficulty} />
              <PuzzleVote
                key={`${puzzle.displayId}:${user?.id ?? "anonymous"}`}
                publicId={puzzle.displayId}
                initialScore={puzzle.voteScore}
                initialVote={viewerVote}
                canVote={Boolean(user)}
              />
            </div>

            <div className="umigame-detail-head__actions">
              <PuzzleFavorite
                key={`${puzzle.displayId}:${user?.id ?? "anonymous"}`}
                publicId={puzzle.displayId}
                initialFavorite={viewerFavorite}
                canFavorite={Boolean(user)}
              />
              {user?.id === puzzle.author?.id ? (
                <Link
                  to={`/games/umigame/p/${puzzle.displayId}/edit`}
                  className="btn site-button site-button--ghost"
                >
                  <Pencil size={15} aria-hidden="true" />
                  編集
                </Link>
              ) : null}
              <Link
                to={`/games/umigame/p/${puzzle.displayId}/play`}
                className="btn site-button umigame-primary-action"
              >
                この問題を遊ぶ
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="umigame-problem-panel">
        <p>{puzzle.statement}</p>
      </section>

      {puzzle.tags.length > 0 || puzzle.sourceUrl || puzzle.attributionText ? (
        <section className="umigame-attribution">
          {puzzle.tags.length > 0 ? (
            <div className="umigame-tag-list umigame-detail-tags" aria-label="タグ">
              {puzzle.tags.map((tag) => (
                <span key={tag.id}>{tag.name}</span>
              ))}
            </div>
          ) : null}

          {puzzle.sourceUrl || puzzle.attributionText ? (
            <div className="umigame-attribution__meta">
              {puzzle.attributionText ? <p>{puzzle.attributionText}</p> : null}
              {puzzle.sourceUrl || puzzle.licenseName === "CC BY-SA 4.0" ? (
                <div>
                  {puzzle.sourceUrl ? (
                    <a href={puzzle.sourceUrl} target="_blank" rel="noreferrer">
                      出典
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                  {puzzle.licenseName === "CC BY-SA 4.0" ? (
                    <a
                      href="https://creativecommons.org/licenses/by-sa/4.0/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      CC BY-SA 4.0
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <PuzzleComments
        key={`${puzzle.displayId}:${user?.id ?? "anonymous"}`}
        publicId={puzzle.displayId}
        initialComments={comments}
        viewer={user}
      />
    </PageLayout>
  );
}
