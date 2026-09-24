import type { ReactNode } from "react";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { ArrowRight, Award, CheckCircle2, ChevronRight, Play } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { UmigameAuthor } from "~/components/umigame/UmigameAuthor";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { listPublishedPuzzleRankings, type PuzzleSummary } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `ランキング | ウミガメのスープ | ${siteConfig.fullName}` },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireUmigameDb(getUmigameEnv(context));
  const rankings = await listPublishedPuzzleRankings(db, 10);
  return { rankings };
}

function RankingSection({
  title,
  description,
  puzzles,
  metric,
  rankingValue,
  icon,
}: {
  title: string;
  description: string;
  puzzles: PuzzleSummary[];
  metric: (puzzle: PuzzleSummary) => string;
  rankingValue: (puzzle: PuzzleSummary) => number;
  icon: ReactNode;
}) {
  const rankedPuzzles = puzzles.filter((puzzle) => rankingValue(puzzle) > 0);

  return (
    <section className="umigame-ranking-section">
      <div className="umigame-section-head">
        <div className="umigame-icon-label">
          {icon}
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>

      <div className="umigame-ranking-list">
        {rankedPuzzles.length > 0 ? (
          rankedPuzzles.map((puzzle, index) => (
            <article key={puzzle.id} className="umigame-ranking-card">
              <span className="umigame-ranking-card__rank">{index + 1}</span>
              <div className="umigame-ranking-card__body">
                <div className="umigame-ranking-card__head">
                  <Link to={`/games/umigame/p/${puzzle.displayId}`}>
                    <h3>{puzzle.title}</h3>
                  </Link>
                  <UmigameDifficulty value={puzzle.difficulty} />
                </div>
                <div className="umigame-ranking-card__meta">
                  {puzzle.author ? <UmigameAuthor author={puzzle.author} size={22} /> : null}
                  <span>{metric(puzzle)}</span>
                  <span>プレイ {puzzle.playCount}</span>
                  <span>解決 {puzzle.solvedCount}</span>
                </div>
              </div>
              <Link
                to={`/games/umigame/p/${puzzle.displayId}/play`}
                className="btn site-button site-button--ghost site-button--small umigame-ranking-card__play"
              >
                遊ぶ
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link
                to={`/games/umigame/p/${puzzle.displayId}`}
                className="umigame-ranking-card__detail-link"
                aria-label={`${puzzle.title}の詳細を開く`}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </article>
          ))
        ) : (
          <p className="umigame-ranking-empty">集計できるデータはまだありません。</p>
        )}
      </div>
    </section>
  );
}
export default function UmigameRankingsPage() {
  const { rankings } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack umigame-rankings-page">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-rankings-head">
        <h2>ランキング</h2>
      </section>

      <div className="umigame-rankings-grid">
        <RankingSection
          title="高評価"
          description="評価合計が高い順"
          puzzles={rankings.rated}
          metric={(puzzle) => `評価 ${puzzle.voteScore}`}
          rankingValue={(puzzle) => puzzle.voteScore}
          icon={<Award size={22} aria-hidden="true" />}
        />
        <RankingSection
          title="よく遊ばれている"
          description="プレイ開始数が多い順"
          puzzles={rankings.played}
          metric={(puzzle) => `プレイ ${puzzle.playCount}`}
          rankingValue={(puzzle) => puzzle.playCount}
          icon={<Play size={22} aria-hidden="true" />}
        />
        <RankingSection
          title="よく解かれている"
          description="解決済みセッション数が多い順"
          puzzles={rankings.solved}
          metric={(puzzle) => `解決 ${puzzle.solvedCount}`}
          rankingValue={(puzzle) => puzzle.solvedCount}
          icon={<CheckCircle2 size={22} aria-hidden="true" />}
        />
      </div>
    </PageLayout>
  );
}
