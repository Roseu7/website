import type { AppLoadContext } from "react-router";
import { requireUmigameUser } from "./auth.server";
import { getUmigameEnv, requireUmigameDb, type UmigameEnv } from "./env.server";
import { enqueueCommentReview } from "./comments.server";
import { enqueuePuzzleReview } from "./submission.server";

export async function isUmigameAdmin(db: D1Database, userId: string) {
  const row = await db.prepare(
    "SELECT is_admin FROM users WHERE id = ? LIMIT 1",
  ).bind(userId).first<{ is_admin: number }>();
  return row?.is_admin === 1;
}

export async function requireUmigameAdmin(
  request: Request,
  context: AppLoadContext,
) {
  const user = await requireUmigameUser(request, context);
  const db = requireUmigameDb(getUmigameEnv(context));
  if (!(await isUmigameAdmin(db, user.id))) {
    throw new Response("Not Found", { status: 404 });
  }
  return user;
}

interface AdminPuzzleRow {
  puzzle_id: string;
  public_id: number;
  status: string;
  revision_id: string;
  version: number;
  title: string;
  statement: string;
  canonical_truth: string;
  difficulty: string;
  updated_at: number;
  author_id: string | null;
  author_display_name: string | null;
  latest_action: string | null;
  latest_reason: string | null;
  latest_result_json: string | null;
}

export interface AdminPuzzleSimilarityItem {
  puzzleId: string;
  displayId: string;
  title: string;
  probability: number;
}

export interface AdminPuzzleReviewItem {
  puzzleId: string;
  publicId: number;
  displayId: string;
  status: string;
  revisionId: string;
  version: number;
  title: string;
  statement: string;
  canonicalTruth: string;
  difficulty: string;
  updatedAt: number;
  authorId: string | null;
  authorDisplayName: string | null;
  latestAction: string | null;
  latestReason: string | null;
  latestJevResult: unknown;
  similarPuzzles: AdminPuzzleSimilarityItem[];
}
function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function formatDisplayId(publicId: number) {
  return String(publicId).padStart(7, "0");
}

export async function listAdminPuzzleReviews(db: D1Database) {
  const result = await db.prepare(
    `SELECT p.id AS puzzle_id, p.public_id, p.status, p.current_revision_id AS revision_id,
            p.updated_at, r.version, r.title, r.statement, r.canonical_truth, r.difficulty,
            u.id AS author_id, u.display_name AS author_display_name,
            me.action AS latest_action, me.reason AS latest_reason,
            jr.jev_result_json AS latest_result_json
     FROM puzzles p
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     LEFT JOIN users u ON u.id = p.author_actor_id
     LEFT JOIN moderation_events me ON me.id = (
       SELECT id FROM moderation_events
       WHERE target_type = 'puzzle_revision' AND target_id = p.current_revision_id
       ORDER BY created_at DESC LIMIT 1
     )
     LEFT JOIN moderation_events jr ON jr.id = (
       SELECT id FROM moderation_events
       WHERE target_type = 'puzzle_revision'
         AND target_id = p.current_revision_id
         AND jev_result_json IS NOT NULL
       ORDER BY created_at DESC LIMIT 1
     )`
  ).all<AdminPuzzleRow>();

  const similarityResult = await db.prepare(
    `SELECT sc.revision_id, sc.compared_puzzle_id,
            sc.similarity_probability, p.public_id, r.title
     FROM puzzle_similarity_checks sc
     JOIN puzzles p ON p.id = sc.compared_puzzle_id
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     WHERE sc.similarity_probability >= 0.55
     ORDER BY sc.revision_id, sc.similarity_probability DESC`,
  ).all<{
    revision_id: string;
    compared_puzzle_id: string;
    similarity_probability: number;
    public_id: number;
    title: string;
  }>();

  const similaritiesByRevision = new Map<
    string,
    AdminPuzzleSimilarityItem[]
  >();
  for (const item of similarityResult.results ?? []) {
    const items = similaritiesByRevision.get(item.revision_id) ?? [];
    if (items.length >= 5) continue;
    items.push({
      puzzleId: item.compared_puzzle_id,
      displayId: formatDisplayId(item.public_id),
      title: item.title,
      probability: item.similarity_probability,
    });
    similaritiesByRevision.set(item.revision_id, items);
  }

  const priority: Record<string, number> = {
    needs_review: 0,
    pending_review: 1,
    hidden: 2,
    rejected: 3,
    published: 4,
    draft: 5,
  };
  return (result.results ?? [])
    .sort((a, b) =>
      (priority[a.status] ?? 99) - (priority[b.status] ?? 99) ||
      b.updated_at - a.updated_at
    )
    .map((row) => ({
      puzzleId: row.puzzle_id,
      publicId: row.public_id,
      displayId: formatDisplayId(row.public_id),
      status: row.status,
      revisionId: row.revision_id,
      version: row.version,
      title: row.title,
      statement: row.statement,
      canonicalTruth: row.canonical_truth,
      difficulty: row.difficulty,
      updatedAt: row.updated_at,
      authorId: row.author_id,
      authorDisplayName: row.author_display_name,
      latestAction: row.latest_action,
      latestReason: row.latest_reason,
      latestJevResult: parseJson(row.latest_result_json),
      similarPuzzles: similaritiesByRevision.get(row.revision_id) ?? [],
    } satisfies AdminPuzzleReviewItem));
}

export interface AdminFlaggedComment {
  id: string;
  puzzleDisplayId: string;
  puzzleTitle: string;
  body: string;
  status: string;
  authorDisplayName: string;
  reportCount: number;
  createdAt: number;
}export async function listAdminFlaggedComments(db: D1Database) {
  const result = await db.prepare(
    `SELECT c.id, c.body, c.status, c.created_at, u.display_name,
            p.public_id, r.title, COUNT(cr.id) AS report_count
     FROM comments c
     JOIN users u ON u.id = c.author_user_id
     JOIN puzzles p ON p.id = c.puzzle_id
     JOIN puzzle_revisions r ON r.id = c.revision_id
     LEFT JOIN comment_reports cr ON cr.comment_id = c.id
     WHERE c.status = 'hidden_pending_review' OR cr.id IS NOT NULL
     GROUP BY c.id, c.body, c.status, c.created_at, u.display_name, p.public_id, r.title
     ORDER BY c.created_at DESC`
  ).all<{
    id: string; body: string; status: string; created_at: number;
    display_name: string; public_id: number; title: string; report_count: number;
  }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    puzzleDisplayId: formatDisplayId(row.public_id),
    puzzleTitle: row.title,
    body: row.body,
    status: row.status,
    authorDisplayName: row.display_name,
    reportCount: row.report_count ?? 0,
    createdAt: row.created_at,
  } satisfies AdminFlaggedComment));
}export async function getAdminJevSummary(db: D1Database) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const [summary, latest] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(AVG(latency_ms), 0) AS avg_latency
       FROM jev_runs WHERE created_at >= ?`
    ).bind(since).first<{ total: number; errors: number; input_tokens: number; output_tokens: number; avg_latency: number }>(),
    db.prepare(
      `SELECT model, provider, purpose, status, primary_error, created_at
       FROM jev_runs ORDER BY created_at DESC LIMIT 10`
    ).all<{ model: string | null; provider: string; purpose: string; status: string; primary_error: string | null; created_at: number }>(),
  ]);
  return {
    total: summary?.total ?? 0,
    errors: summary?.errors ?? 0,
    inputTokens: summary?.input_tokens ?? 0,
    outputTokens: summary?.output_tokens ?? 0,
    avgLatency: Math.round(summary?.avg_latency ?? 0),
    latestRuns: latest.results ?? [],
  };
}

function adminEventStatement(db: D1Database, targetType: string, targetId: string, action: string, adminUserId: string) {
  return db.prepare(
    `INSERT INTO moderation_events
      (id, target_type, target_id, action, reason, jev_result_json, admin_actor_id, created_at)
     VALUES (?, ?, ?, ?, 'manual_admin_override', NULL, ?, ?)`
  ).bind(crypto.randomUUID(), targetType, targetId, action, adminUserId, Date.now());
}

export async function applyAdminPuzzleAction(
  env: UmigameEnv,
  adminUserId: string,
  puzzleId: string,
  action: "publish" | "hide" | "reject" | "restore" | "rerun",
) {
  const db = env.DB;
  const row = await db.prepare(
    "SELECT current_revision_id FROM puzzles WHERE id = ? LIMIT 1",
  ).bind(puzzleId).first<{ current_revision_id: string }>();
  if (!row) throw new Response("Puzzle not found.", { status: 404 });
  const now = Date.now();

  if (action === "rerun") {
    await db.batch([
      db.prepare(
        "UPDATE puzzles SET status = 'pending_review', updated_at = ? WHERE id = ?",
      ).bind(now, puzzleId),
      adminEventStatement(db, "puzzle_revision", row.current_revision_id, "rerun_jev", adminUserId),
    ]);
    await enqueuePuzzleReview(env, row.current_revision_id);
    return;
  }

  const nextStatus = action === "publish" || action === "restore"
    ? "published"
    : action === "hide" ? "hidden" : "rejected";
  await db.batch([
    db.prepare(
      "UPDATE puzzles SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?",
    ).bind(nextStatus, now, nextStatus, now, puzzleId),
    adminEventStatement(db, "puzzle_revision", row.current_revision_id, action, adminUserId),
  ]);
}export async function applyAdminCommentAction(
  env: UmigameEnv,
  adminUserId: string,
  commentId: string,
  action: "show" | "spoiler" | "hide" | "rerun",
) {
  const db = env.DB;
  const exists = await db.prepare("SELECT id FROM comments WHERE id = ? LIMIT 1")
    .bind(commentId).first<{ id: string }>();
  if (!exists) throw new Response("Comment not found.", { status: 404 });

  if (action === "rerun") {
    await db.batch([
      db.prepare("UPDATE comments SET status = 'pending', updated_at = MAX(updated_at + 1, ?), reviewed_at = NULL WHERE id = ?")
        .bind(Date.now(), commentId),
      db.prepare("DELETE FROM comment_reports WHERE comment_id = ?").bind(commentId),
      adminEventStatement(db, "comment", commentId, "rerun_jev", adminUserId),
    ]);
    await enqueueCommentReview(env, commentId);
    return;
  }

  const status = action === "show" ? "visible" : action === "spoiler" ? "spoiler" : "hidden_pending_review";
  await db.batch([
    db.prepare("UPDATE comments SET status = ?, updated_at = ?, reviewed_at = ? WHERE id = ?")
      .bind(status, Date.now(), Date.now(), commentId),
    db.prepare("DELETE FROM comment_reports WHERE comment_id = ?").bind(commentId),
    adminEventStatement(db, "comment", commentId, action, adminUserId),
  ]);
}

export interface AdminJevProviderStats {
  provider: string;
  calls: number;
  errors: number;
  fallbacks: number;
  inputTokens: number;
  outputTokens: number;
  avgLatency: number;
  estimatedCostUsd: number | null;
}

export interface AdminJevPurposeStats {
  purpose: string;
  calls: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  avgLatency: number;
}

function parsePrice(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function estimateProviderCost(
  provider: string,
  inputTokens: number,
  env: UmigameEnv,
) {
  const price =
    provider === "vercel"
      ? parsePrice(env.JEV_VERCEL_INPUT_USD_PER_MILLION)
      : provider === "typesafe"
        ? parsePrice(env.JEV_TYPESAFE_INPUT_USD_PER_MILLION)
        : null;
  return price === null ? null : (inputTokens / 1_000_000) * price;
}

export async function getAdminJevAnalytics(env: UmigameEnv) {
  const db = requireUmigameDb(env);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const jstOffset = 9 * 60 * 60 * 1000;
  const todayStart = Math.floor((now + jstOffset) / dayMs) * dayMs - jstOffset;
  const sevenDayStart = todayStart - 6 * dayMs;

  const [summary, providers, purposes, errors, models, daily, latest] =
    await Promise.all([
      db.prepare(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END) AS fallbacks,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(AVG(latency_ms), 0) AS avg_latency
         FROM jev_runs
         WHERE created_at >= ?`,
      ).bind(todayStart).first<{
        total: number;
        errors: number;
        fallbacks: number;
        input_tokens: number;
        output_tokens: number;
        avg_latency: number;
      }>(),
      db.prepare(
        `SELECT provider,
                COUNT(*) AS calls,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN fallback_used = 1 THEN 1 ELSE 0 END) AS fallbacks,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(AVG(latency_ms), 0) AS avg_latency
         FROM jev_runs
         WHERE created_at >= ?
         GROUP BY provider
         ORDER BY calls DESC`,
      ).bind(todayStart).all<{
        provider: string;
        calls: number;
        errors: number;
        fallbacks: number;
        input_tokens: number;
        output_tokens: number;
        avg_latency: number;
      }>(),
      db.prepare(
        `SELECT purpose,
                COUNT(*) AS calls,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                COALESCE(SUM(input_tokens), 0) AS input_tokens,
                COALESCE(SUM(output_tokens), 0) AS output_tokens,
                COALESCE(AVG(latency_ms), 0) AS avg_latency
         FROM jev_runs
         WHERE created_at >= ?
         GROUP BY purpose
         ORDER BY calls DESC`,
      ).bind(todayStart).all<{
        purpose: string;
        calls: number;
        errors: number;
        input_tokens: number;
        output_tokens: number;
        avg_latency: number;
      }>(),
      db.prepare(
        `SELECT
            SUM(CASE WHEN primary_error = '429' THEN 1 ELSE 0 END) AS rate_limited,
            SUM(CASE WHEN primary_error = 'timeout' THEN 1 ELSE 0 END) AS timeouts,
            SUM(CASE WHEN primary_error = 'network_error' THEN 1 ELSE 0 END) AS network_errors,
            SUM(CASE WHEN primary_error GLOB '5[0-9][0-9]' THEN 1 ELSE 0 END) AS server_errors
         FROM jev_runs
         WHERE created_at >= ?`,
      ).bind(todayStart).first<{
        rate_limited: number;
        timeouts: number;
        network_errors: number;
        server_errors: number;
      }>(),
      db.prepare(
        `SELECT COALESCE(model, 'unknown') AS model, COUNT(*) AS calls
         FROM jev_runs
         WHERE created_at >= ?
         GROUP BY COALESCE(model, 'unknown')
         ORDER BY calls DESC`,
      ).bind(todayStart).all<{ model: string; calls: number }>(),
      db.prepare(
        `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', '+9 hours') AS day,
                COUNT(*) AS calls,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                COALESCE(SUM(input_tokens), 0) AS input_tokens
         FROM jev_runs
         WHERE created_at >= ?
         GROUP BY day
         ORDER BY day ASC`,
      ).bind(sevenDayStart).all<{
        day: string;
        calls: number;
        errors: number;
        input_tokens: number;
      }>(),
      db.prepare(
        `SELECT purpose, provider, model, status, fallback_used, primary_error,
                input_tokens, output_tokens, latency_ms, created_at
         FROM jev_runs
         ORDER BY created_at DESC
         LIMIT 50`,
      ).all<{
        purpose: string;
        provider: string;
        model: string | null;
        status: string;
        fallback_used: number;
        primary_error: string | null;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        created_at: number;
      }>(),
    ]);

  const providerStats: AdminJevProviderStats[] = (providers.results ?? []).map(
    (row) => ({
      provider: row.provider,
      calls: row.calls ?? 0,
      errors: row.errors ?? 0,
      fallbacks: row.fallbacks ?? 0,
      inputTokens: row.input_tokens ?? 0,
      outputTokens: row.output_tokens ?? 0,
      avgLatency: Math.round(row.avg_latency ?? 0),
      estimatedCostUsd: estimateProviderCost(
        row.provider,
        row.input_tokens ?? 0,
        env,
      ),
    }),
  );

  const estimatedCostUsd = providerStats.some(
    (provider) => provider.estimatedCostUsd !== null,
  )
    ? providerStats.reduce(
        (sum, provider) => sum + (provider.estimatedCostUsd ?? 0),
        0,
      )
    : null;

  const total = summary?.total ?? 0;
  const errorCount = summary?.errors ?? 0;

  return {
    currentProvider: env.JEV_PROVIDER?.trim() || "vercel",
    fallbackProvider: env.JEV_FALLBACK_PROVIDER?.trim() || "none",
    configuredModel:
      env.JEV_MODEL?.trim() ||
      (models.results ?? [])[0]?.model ||
      "provider default",
    todayStart,
    total,
    errors: errorCount,
    successRate: total > 0 ? (total - errorCount) / total : 1,
    fallbacks: summary?.fallbacks ?? 0,
    inputTokens: summary?.input_tokens ?? 0,
    outputTokens: summary?.output_tokens ?? 0,
    avgLatency: Math.round(summary?.avg_latency ?? 0),
    estimatedCostUsd,
    providers: providerStats,
    purposes: (purposes.results ?? []).map((row) => ({
      purpose: row.purpose,
      calls: row.calls ?? 0,
      errors: row.errors ?? 0,
      inputTokens: row.input_tokens ?? 0,
      outputTokens: row.output_tokens ?? 0,
      avgLatency: Math.round(row.avg_latency ?? 0),
    })) satisfies AdminJevPurposeStats[],
    errorBreakdown: {
      rateLimited: errors?.rate_limited ?? 0,
      timeouts: errors?.timeouts ?? 0,
      networkErrors: errors?.network_errors ?? 0,
      serverErrors: errors?.server_errors ?? 0,
    },
    models: models.results ?? [],
    daily: daily.results ?? [],
    latestRuns: latest.results ?? [],
  };
}
