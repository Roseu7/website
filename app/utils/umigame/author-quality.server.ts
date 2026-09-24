import type { UmigameUser } from "./user.server";

export interface AuthorQualityReviewMetrics {
  contradiction: number | null;
  arbitraryPosthoc: number | null;
  multipleMajorSolutions: number | null;
  tooTrivial: number | null;
  requiresUnstatedExternalKnowledge: number | null;
  problemTextLeaksAnswer: number | null;
  truthExplainsProblem: number | null;
  fairToPlayer: number | null;
}

export interface AuthorQualityPuzzle {
  puzzleId: string;
  publicId: number | null;
  displayId: string | null;
  title: string;
  status: string;
  difficulty: string;
  updatedAt: number;
  publishedAt: number | null;
  playCount: number;
  solvedCount: number;
  gaveUpCount: number;
  voteScore: number;
  averageQuestions: number;
  averageGuesses: number;
  averageHints: number;
  reviewMetrics: AuthorQualityReviewMetrics | null;
  reviewReason: string | null;
}

export interface AuthorQualityOverview {
  puzzleCount: number;
  publishedCount: number;
  totalPlays: number;
  totalSolved: number;
  totalGaveUp: number;
  totalVoteScore: number;
  solveRate: number | null;
  averageQuestions: number;
  averageGuesses: number;
  averageHints: number;
}

interface QualityRow {
  puzzle_id: string;
  public_id: number | null;
  status: string;
  title: string;
  difficulty: string;
  updated_at: number;
  published_at: number | null;
  play_count: number;
  solved_count: number;
  gave_up_count: number;
  vote_score: number;
  avg_questions: number;
  avg_guesses: number;
  avg_hints: number;
  review_reason: string | null;
  review_json: string | null;
}

function boundedProbability(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;
}

function parseReviewMetrics(value: string | null): AuthorQualityReviewMetrics | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as {
      metrics?: Record<string, unknown>;
    };
    const metrics = parsed.metrics;
    if (!metrics || typeof metrics !== "object") return null;
    return {
      contradiction: boundedProbability(metrics.contradiction),
      arbitraryPosthoc: boundedProbability(metrics.arbitraryPosthoc),
      multipleMajorSolutions: boundedProbability(metrics.multipleMajorSolutions),
      tooTrivial: boundedProbability(metrics.tooTrivial),
      requiresUnstatedExternalKnowledge: boundedProbability(
        metrics.requiresUnstatedExternalKnowledge,
      ),
      problemTextLeaksAnswer: boundedProbability(metrics.problemTextLeaksAnswer),
      truthExplainsProblem: boundedProbability(metrics.truthExplainsProblem),
      fairToPlayer: boundedProbability(metrics.fairToPlayer),
    };
  } catch {
    return null;
  }
}

function displayId(publicId: number | null) {
  return publicId === null ? null : String(publicId).padStart(7, "0");
}

export async function getAuthorQualityAnalytics(
  db: D1Database,
  user: UmigameUser,
) {
  const result = await db.prepare(
    `SELECT
       p.id AS puzzle_id,
       p.public_id,
       p.status,
       p.updated_at,
       p.published_at,
       r.title,
       r.difficulty,
       (SELECT COUNT(*)
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
         WHERE sr.puzzle_id = p.id
           AND s.started_at >= sr.created_at) AS play_count,
       (SELECT COUNT(*)
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
         WHERE sr.puzzle_id = p.id
           AND s.started_at >= sr.created_at
           AND s.solved_at IS NOT NULL) AS solved_count,
       (SELECT COUNT(*)
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
         WHERE sr.puzzle_id = p.id
           AND s.started_at >= sr.created_at
           AND s.gave_up_at IS NOT NULL) AS gave_up_count,
       (SELECT COALESCE(SUM(v.value), 0)
          FROM votes v
         WHERE v.puzzle_id = p.id) AS vote_score,
       (SELECT COALESCE(AVG(s.question_count), 0)
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
         WHERE sr.puzzle_id = p.id
           AND s.started_at >= sr.created_at) AS avg_questions,
       (SELECT COALESCE(AVG((
           SELECT COUNT(*) FROM play_turns t
            WHERE t.session_id = s.id AND t.kind = 'guess'
         )), 0)
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
         WHERE sr.puzzle_id = p.id
           AND s.started_at >= sr.created_at) AS avg_guesses,
       (SELECT COALESCE(AVG((
           SELECT COUNT(*) FROM play_turns t
            WHERE t.session_id = s.id AND t.kind = 'hint'
         )), 0)
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
         WHERE sr.puzzle_id = p.id
           AND s.started_at >= sr.created_at) AS avg_hints,
       me.reason AS review_reason,
       me.jev_result_json AS review_json
     FROM puzzles p
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     LEFT JOIN moderation_events me ON me.id = (
       SELECT id
       FROM moderation_events
       WHERE target_type = 'puzzle_revision'
         AND target_id = p.current_revision_id
         AND jev_result_json IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1
     )
     WHERE p.author_actor_id = ?
     ORDER BY p.updated_at DESC, p.created_at DESC`,
  ).bind(user.id).all<QualityRow>();

  const puzzles: AuthorQualityPuzzle[] = (result.results ?? []).map((row) => ({
    puzzleId: row.puzzle_id,
    publicId: row.public_id,
    displayId: displayId(row.public_id),
    title: row.title,
    status: row.status,
    difficulty: row.difficulty,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    playCount: row.play_count ?? 0,
    solvedCount: row.solved_count ?? 0,
    gaveUpCount: row.gave_up_count ?? 0,
    voteScore: row.vote_score ?? 0,
    averageQuestions: Number(row.avg_questions ?? 0),
    averageGuesses: Number(row.avg_guesses ?? 0),
    averageHints: Number(row.avg_hints ?? 0),
    reviewMetrics: parseReviewMetrics(row.review_json),
    reviewReason: row.review_reason,
  }));

  const totals = puzzles.reduce(
    (sum, puzzle) => {
      sum.plays += puzzle.playCount;
      sum.solved += puzzle.solvedCount;
      sum.gaveUp += puzzle.gaveUpCount;
      sum.voteScore += puzzle.voteScore;
      sum.weightedQuestions += puzzle.averageQuestions * puzzle.playCount;
      sum.weightedGuesses += puzzle.averageGuesses * puzzle.playCount;
      sum.weightedHints += puzzle.averageHints * puzzle.playCount;
      return sum;
    },
    {
      plays: 0,
      solved: 0,
      gaveUp: 0,
      voteScore: 0,
      weightedQuestions: 0,
      weightedGuesses: 0,
      weightedHints: 0,
    },
  );

  const overview: AuthorQualityOverview = {
    puzzleCount: puzzles.length,
    publishedCount: puzzles.filter((puzzle) => puzzle.status === "published").length,
    totalPlays: totals.plays,
    totalSolved: totals.solved,
    totalGaveUp: totals.gaveUp,
    totalVoteScore: totals.voteScore,
    solveRate: totals.plays > 0 ? totals.solved / totals.plays : null,
    averageQuestions:
      totals.plays > 0 ? totals.weightedQuestions / totals.plays : 0,
    averageGuesses:
      totals.plays > 0 ? totals.weightedGuesses / totals.plays : 0,
    averageHints:
      totals.plays > 0 ? totals.weightedHints / totals.plays : 0,
  };

  return { user, overview, puzzles };
}
