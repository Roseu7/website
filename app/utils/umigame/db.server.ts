import type { UmigameAvatarType } from "./avatar";

export type FactImportance = "core" | "supporting";

export interface UmigameTag {
  id: string;
  name: string;
}

export interface UmigameFact {
  id: string;
  text: string;
  importance: FactImportance;
  weight: number;
}

export interface PuzzleAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarType: UmigameAvatarType;
  avatarIcon: string | null;
  avatarColor: string | null;
  externalAvatarUrl: string | null;
  deleted: boolean;
}

export interface PuzzleSummary {
  id: string;
  publicId: number;
  displayId: string;
  title: string;
  statement: string;
  difficulty: string;
  publishedAt: number | null;
  playCount: number;
  solvedCount: number;
  voteScore: number;
  tags: UmigameTag[];
  sourceUrl: string | null;
  licenseName: string | null;
  attributionText: string | null;
  author: PuzzleAuthor | null;
}

export interface PuzzlePublicDetail extends PuzzleSummary {
  hintCount: number;
}

export interface PuzzleLicenseEntry {
  puzzleId: string;
  publicId: number;
  displayId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  licenseName: string | null;
  attributionText: string | null;
}

export interface PuzzleRevisionState {
  puzzleId: string;
  publicId: number;
  displayId: string;
  revisionId: string;
  title: string;
  statement: string;
  canonicalTruth: string;
  difficulty: string;
  facts: UmigameFact[];
  hints: Array<{ level: number; text: string }>;
}

export interface PlaySessionState extends PuzzleRevisionState {
  sessionId: string;
  actorId: string;
  startedAt: number;
  solvedAt: number | null;
  gaveUpAt: number | null;
  questionCount: number;
}

export interface PlayHistoryItem {
  id: string;
  turnNo: number;
  kind: "question" | "guess";
  text: string;
  answerCode: string | null;
  coverage: number | null;
  createdAt: number;
}

export interface PlayProgressStats {
  questionCount: number;
  guessCount: number;
  hintCount: number;
  durationMs: number;
}

interface PuzzleRow {
  id: string;
  public_id: number;
  title: string;
  statement: string;
  difficulty: string;
  published_at: number | null;
  play_count: number;
  solved_count: number;
  vote_score: number;
  source_url?: string | null;
  license_name?: string | null;
  attribution_text?: string | null;
  author_id?: string | null;
  author_username?: string | null;
  author_display_name?: string | null;
  author_avatar_type?: string | null;
  author_avatar_icon?: string | null;
  author_avatar_color?: string | null;
  author_external_avatar_url?: string | null;
  author_deleted_at?: number | null;
  tags_text?: string | null;
}

interface RevisionRow {
  puzzle_id: string;
  public_id: number;
  revision_id: string;
  title: string;
  statement: string;
  canonical_truth: string;
  difficulty: string;
}

interface SessionRow extends RevisionRow {
  session_id: string;
  actor_id: string;
  started_at: number;
  solved_at: number | null;
  gave_up_at: number | null;
  question_count: number;
}

interface FactRow {
  id: string;
  fact_text: string;
  importance: string;
  weight: number;
}

interface HintRow {
  hint_level: number;
  hint_text: string;
}

export function formatPuzzlePublicId(value: number) {
  return String(value).padStart(7, "0");
}

export function parsePuzzlePublicId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function parseTags(value: string | null | undefined): UmigameTag[] {
  if (!value) return [];
  return value
    .split("\u001f")
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator < 1) return null;
      return {
        id: entry.slice(0, separator),
        name: entry.slice(separator + 1),
      };
    })
    .filter((tag): tag is UmigameTag => Boolean(tag));
}

function mapSummary(row: PuzzleRow): PuzzleSummary {
  return {
    id: row.id,
    publicId: row.public_id,
    displayId: formatPuzzlePublicId(row.public_id),
    title: row.title,
    statement: row.statement,
    difficulty: row.difficulty,
    publishedAt: row.published_at,
    playCount: row.play_count,
    solvedCount: row.solved_count,
    voteScore: Number.isFinite(row.vote_score) ? row.vote_score : 0,
    tags: parseTags(row.tags_text),
    sourceUrl: row.source_url ?? null,
    licenseName: row.license_name ?? null,
    attributionText: row.attribution_text ?? null,
    author:
      row.author_id && row.author_username && row.author_display_name
        ? {
            id: row.author_id,
            username: row.author_username,
            displayName: row.author_deleted_at
              ? "退会済みユーザー"
              : row.author_display_name,
            avatarType:
              row.author_avatar_type === "oauth" || row.author_avatar_type === "generated"
                ? row.author_avatar_type
                : "lucide",
            avatarIcon: row.author_avatar_icon ?? null,
            avatarColor: row.author_avatar_color ?? null,
            externalAvatarUrl: row.author_deleted_at
              ? null
              : row.author_external_avatar_url ?? null,
            deleted: Boolean(row.author_deleted_at),
          }
        : null,
  };
}

const PUBLIC_PUZZLE_SELECT = `
  SELECT p.id, p.public_id, r.title, r.statement, r.difficulty,
         r.source_url, r.license_name, r.attribution_text, p.published_at,
         u.id AS author_id, u.username AS author_username,
         u.display_name AS author_display_name, u.avatar_type AS author_avatar_type,
         u.avatar_icon AS author_avatar_icon, u.avatar_color AS author_avatar_color,
         u.external_avatar_url AS author_external_avatar_url,
         u.deleted_at AS author_deleted_at,
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
    (SELECT COALESCE(SUM(v.value), 0) FROM votes v WHERE v.puzzle_id = p.id) AS vote_score,
    GROUP_CONCAT(t.id || ':' || t.name, char(31)) AS tags_text
  FROM puzzles p
  JOIN puzzle_revisions r ON r.id = p.current_revision_id
  LEFT JOIN users u ON u.id = p.author_actor_id
  LEFT JOIN puzzle_tags pt ON pt.puzzle_id = p.id
  LEFT JOIN tags t ON t.id = pt.tag_id AND t.is_public = 1
`;

export async function listPublishedPuzzles(db: D1Database) {
  const result = await db.prepare(
    PUBLIC_PUZZLE_SELECT +
      ` WHERE p.status = 'published' AND p.public_id IS NOT NULL
        GROUP BY p.id, p.public_id, r.title, r.statement, r.difficulty,
                 r.source_url, r.license_name, r.attribution_text, p.published_at, r.id,
                 u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
                 u.avatar_color, u.external_avatar_url, u.deleted_at
        ORDER BY p.public_id DESC`,
  ).all<PuzzleRow>();

  return (result.results ?? []).map(mapSummary);
}

export async function listPublishedPuzzleLicenses(
  db: D1Database,
): Promise<PuzzleLicenseEntry[]> {
  const result = await db.prepare(
    `SELECT p.id AS puzzle_id, p.public_id, r.title, r.source_type,
            r.source_url, r.license_name, r.attribution_text
     FROM puzzles p
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     WHERE p.status = 'published' AND p.public_id IS NOT NULL
     ORDER BY p.public_id ASC`,
  ).all<{
    puzzle_id: string;
    public_id: number;
    title: string;
    source_type: string;
    source_url: string | null;
    license_name: string | null;
    attribution_text: string | null;
  }>();

  return (result.results ?? []).map((row) => ({
    puzzleId: row.puzzle_id,
    publicId: row.public_id,
    displayId: formatPuzzlePublicId(row.public_id),
    title: row.title,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    licenseName: row.license_name,
    attributionText: row.attribution_text,
  }));
}

export async function listRecommendationCandidates(
  db: D1Database,
  actorId: string | null,
  limit = 50,
) {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const unplayedClause = actorId
    ? ` AND NOT EXISTS (
          SELECT 1
          FROM play_sessions s
          JOIN puzzle_revisions sr ON sr.id = s.revision_id
          WHERE sr.puzzle_id = p.id
            AND s.started_at >= sr.created_at
            AND s.actor_id = ?
        )`
    : "";
  const query =
    PUBLIC_PUZZLE_SELECT +
    ` WHERE p.status = 'published' AND p.public_id IS NOT NULL` +
    unplayedClause +
    `
      GROUP BY p.id, p.public_id, r.title, r.statement, r.difficulty,
               r.source_url, r.license_name, r.attribution_text, p.published_at, r.id,
               u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
               u.avatar_color, u.external_avatar_url, u.deleted_at
      ORDER BY p.public_id DESC
      LIMIT ?`;

  const statement = db.prepare(query);
  const result = actorId
    ? await statement.bind(actorId, safeLimit).all<PuzzleRow>()
    : await statement.bind(safeLimit).all<PuzzleRow>();

  return (result.results ?? []).map(mapSummary);
}

export async function listPublishedPuzzleRankings(db: D1Database, limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const result = await db.prepare(
    PUBLIC_PUZZLE_SELECT +
      ` WHERE p.status = 'published' AND p.public_id IS NOT NULL
        GROUP BY p.id, p.public_id, r.title, r.statement, r.difficulty,
                 r.source_url, r.license_name, r.attribution_text, p.published_at, r.id,
                 u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
                 u.avatar_color, u.external_avatar_url, u.deleted_at`,
  ).all<PuzzleRow>();

  const puzzles = (result.results ?? []).map(mapSummary);
  const byPublicIdDesc = (a: PuzzleSummary, b: PuzzleSummary) => b.publicId - a.publicId;

  return {
    rated: [...puzzles]
      .sort((a, b) => b.voteScore - a.voteScore || b.playCount - a.playCount || byPublicIdDesc(a, b))
      .slice(0, safeLimit),
    played: [...puzzles]
      .sort((a, b) => b.playCount - a.playCount || b.voteScore - a.voteScore || byPublicIdDesc(a, b))
      .slice(0, safeLimit),
    solved: [...puzzles]
      .sort((a, b) => b.solvedCount - a.solvedCount || b.playCount - a.playCount || byPublicIdDesc(a, b))
      .slice(0, safeLimit),
  };
}

export async function listPublishedPuzzlesByAuthor(db: D1Database, userId: string) {
  const result = await db.prepare(
    PUBLIC_PUZZLE_SELECT +
      ` WHERE p.status = 'published' AND p.public_id IS NOT NULL AND p.author_actor_id = ?
        GROUP BY p.id, p.public_id, r.title, r.statement, r.difficulty,
                 r.source_url, r.license_name, r.attribution_text, p.published_at, r.id,
                 u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
                 u.avatar_color, u.external_avatar_url, u.deleted_at
        ORDER BY p.public_id DESC`,
  ).bind(userId).all<PuzzleRow>();

  return (result.results ?? []).map(mapSummary);
}

export async function getPublishedPuzzlePublicById(
  db: D1Database,
  publicId: number,
): Promise<PuzzlePublicDetail | null> {
  const row = await db.prepare(
    PUBLIC_PUZZLE_SELECT +
      ` WHERE p.public_id = ? AND p.status = 'published'
        GROUP BY p.id, p.public_id, r.title, r.statement, r.difficulty,
                 r.source_url, r.license_name, r.attribution_text, p.published_at, r.id,
                 u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
                 u.avatar_color, u.external_avatar_url, u.deleted_at
        LIMIT 1`,
  ).bind(publicId).first<PuzzleRow>();

  if (!row) return null;
  const hintRow = await db.prepare(
    "SELECT COUNT(*) AS count FROM puzzle_hints WHERE revision_id = (SELECT current_revision_id FROM puzzles WHERE id = ?)",
  ).bind(row.id).first<{ count: number }>();

  return {
    ...mapSummary(row),
    hintCount: hintRow?.count ?? 0,
    sourceUrl: row.source_url ?? null,
    licenseName: row.license_name ?? null,
    attributionText: row.attribution_text ?? null,
  };
}

export type PuzzleVoteValue = -1 | 1;

export async function getPuzzleVoteForUser(
  db: D1Database,
  puzzleId: string,
  userId: string,
): Promise<PuzzleVoteValue | null> {
  const row = await db.prepare(
    "SELECT value FROM votes WHERE puzzle_id = ? AND user_id = ? LIMIT 1",
  ).bind(puzzleId, userId).first<{ value: number }>();

  return row?.value === 1 || row?.value === -1 ? row.value : null;
}

export async function getPuzzleFavoriteForUser(
  db: D1Database,
  puzzleId: string,
  userId: string,
) {
  const row = await db.prepare(
    "SELECT 1 AS favorite FROM favorites WHERE puzzle_id = ? AND user_id = ? LIMIT 1",
  ).bind(puzzleId, userId).first<{ favorite: number }>();
  return row?.favorite === 1;
}

export async function setPuzzleFavorite(
  db: D1Database,
  puzzleId: string,
  userId: string,
  favorite: boolean,
) {
  if (favorite) {
    await db.prepare(
      `INSERT INTO favorites (puzzle_id, user_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(puzzle_id, user_id) DO NOTHING`,
    ).bind(puzzleId, userId, Date.now()).run();
  } else {
    await db.prepare(
      "DELETE FROM favorites WHERE puzzle_id = ? AND user_id = ?",
    ).bind(puzzleId, userId).run();
  }
  return favorite;
}

export async function listFavoritePuzzles(db: D1Database, userId: string) {
  const result = await db.prepare(
    PUBLIC_PUZZLE_SELECT +
      ` WHERE p.status = 'published'
          AND p.public_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM favorites f
            WHERE f.puzzle_id = p.id AND f.user_id = ?
          )
        GROUP BY p.id, p.public_id, r.title, r.statement, r.difficulty,
                 r.source_url, r.license_name, r.attribution_text, p.published_at, r.id,
                 u.id, u.username, u.display_name, u.avatar_type, u.avatar_icon,
                 u.avatar_color, u.external_avatar_url, u.deleted_at
        ORDER BY (
          SELECT f.created_at FROM favorites f
          WHERE f.puzzle_id = p.id AND f.user_id = ?
        ) DESC`,
  ).bind(userId, userId).all<PuzzleRow>();

  return (result.results ?? []).map(mapSummary);
}

export async function setPuzzleVote(
  db: D1Database,
  puzzleId: string,
  userId: string,
  value: PuzzleVoteValue | null,
) {
  const now = Date.now();
  if (value === null) {
    await db.prepare(
      "DELETE FROM votes WHERE puzzle_id = ? AND user_id = ?",
    ).bind(puzzleId, userId).run();
  } else {
    await db.prepare(
      `INSERT INTO votes (puzzle_id, user_id, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(puzzle_id, user_id) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    ).bind(puzzleId, userId, value, now, now).run();
  }

  const score = await db.prepare(
    "SELECT COALESCE(SUM(value), 0) AS score FROM votes WHERE puzzle_id = ?",
  ).bind(puzzleId).first<{ score: number }>();
  return Number.isFinite(score?.score) ? score!.score : 0;
}

async function loadFactsAndHints(db: D1Database, revisionId: string) {
  const [factsResult, hintsResult] = await Promise.all([
    db.prepare(
      "SELECT id, fact_text, importance, weight FROM puzzle_facts WHERE revision_id = ? ORDER BY sort_order ASC",
    ).bind(revisionId).all<FactRow>(),
    db.prepare(
      "SELECT hint_level, hint_text FROM puzzle_hints WHERE revision_id = ? ORDER BY hint_level ASC",
    ).bind(revisionId).all<HintRow>(),
  ]);

  const facts: UmigameFact[] = (factsResult.results ?? []).map((row) => ({
    id: row.id,
    text: row.fact_text,
    importance: row.importance === "core" ? "core" : "supporting",
    weight: Number.isFinite(row.weight) ? row.weight : 1,
  }));
  const hints = (hintsResult.results ?? []).map((row) => ({
    level: row.hint_level,
    text: row.hint_text,
  }));
  return { facts, hints };
}

export async function getPublishedRevisionForPublicId(
  db: D1Database,
  publicId: number,
): Promise<PuzzleRevisionState | null> {
  const row = await db.prepare(
    `SELECT p.id AS puzzle_id, p.public_id, r.id AS revision_id,
            r.title, r.statement, r.canonical_truth, r.difficulty
     FROM puzzles p
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     WHERE p.public_id = ? AND p.status = 'published'
     LIMIT 1`,
  ).bind(publicId).first<RevisionRow>();

  if (!row) return null;
  const { facts, hints } = await loadFactsAndHints(db, row.revision_id);
  return {
    puzzleId: row.puzzle_id,
    publicId: row.public_id,
    displayId: formatPuzzlePublicId(row.public_id),
    revisionId: row.revision_id,
    title: row.title,
    statement: row.statement,
    canonicalTruth: row.canonical_truth,
    difficulty: row.difficulty,
    facts,
    hints,
  };
}

export async function createPlaySession(
  db: D1Database,
  revisionId: string,
  actorId: string,
) {
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO play_sessions
      (id, revision_id, actor_id, started_at, solved_at, gave_up_at, question_count)
     VALUES (?, ?, ?, ?, NULL, NULL, 0)`,
  ).bind(id, revisionId, actorId, Date.now()).run();
  return id;
}

export async function getPlaySession(
  db: D1Database,
  sessionId: string,
  actorId: string,
): Promise<PlaySessionState | null> {
  const row = await db.prepare(
    `SELECT s.id AS session_id, s.actor_id, s.started_at, s.solved_at, s.gave_up_at, s.question_count,
            p.id AS puzzle_id, p.public_id, r.id AS revision_id, r.title, r.statement,
            r.canonical_truth, r.difficulty
     FROM play_sessions s
     JOIN puzzle_revisions r ON r.id = s.revision_id
     JOIN puzzles p ON p.id = r.puzzle_id
     WHERE s.id = ? AND s.actor_id = ?
       AND s.started_at >= r.created_at
     LIMIT 1`,
  ).bind(sessionId, actorId).first<SessionRow>();

  if (!row) return null;
  const { facts, hints } = await loadFactsAndHints(db, row.revision_id);
  return {
    sessionId: row.session_id,
    actorId: row.actor_id,
    startedAt: row.started_at,
    solvedAt: row.solved_at,
    gaveUpAt: row.gave_up_at,
    questionCount: row.question_count,
    puzzleId: row.puzzle_id,
    publicId: row.public_id,
    displayId: formatPuzzlePublicId(row.public_id),
    revisionId: row.revision_id,
    title: row.title,
    statement: row.statement,
    canonicalTruth: row.canonical_truth,
    difficulty: row.difficulty,
    facts,
    hints,
  };
}

const OPEN_PLAY_SESSION_SELECT = `
  SELECT s.id AS session_id, s.actor_id, s.started_at, s.solved_at, s.gave_up_at, s.question_count,
         p.id AS puzzle_id, p.public_id, r.id AS revision_id, r.title, r.statement,
         r.canonical_truth, r.difficulty
  FROM play_sessions s
  JOIN puzzle_revisions r ON r.id = s.revision_id
  JOIN puzzles p ON p.id = r.puzzle_id
  WHERE p.id = ?
    AND s.actor_id = ?
    AND s.started_at >= r.created_at
    AND s.solved_at IS NULL
    AND s.gave_up_at IS NULL
  ORDER BY s.started_at DESC
  LIMIT 1`;

async function mapPlaySessionRow(
  db: D1Database,
  row: SessionRow,
): Promise<PlaySessionState> {
  const { facts, hints } = await loadFactsAndHints(db, row.revision_id);
  return {
    sessionId: row.session_id,
    actorId: row.actor_id,
    startedAt: row.started_at,
    solvedAt: row.solved_at,
    gaveUpAt: row.gave_up_at,
    questionCount: row.question_count,
    puzzleId: row.puzzle_id,
    publicId: row.public_id,
    displayId: formatPuzzlePublicId(row.public_id),
    revisionId: row.revision_id,
    title: row.title,
    statement: row.statement,
    canonicalTruth: row.canonical_truth,
    difficulty: row.difficulty,
    facts,
    hints,
  };
}

export async function createOrResumeOpenPlaySessionForPuzzle(
  db: D1Database,
  puzzleId: string,
  revisionId: string,
  actorId: string,
): Promise<{ session: PlaySessionState; resumed: boolean } | null> {
  const sessionId = crypto.randomUUID();
  const startedAt = Date.now();
  // Keep the conditional insert and lookup in one D1 transaction so parallel
  // starts cannot both observe an empty state and create separate sessions.
  const results = await db.batch([
    db.prepare(
      `INSERT INTO play_sessions
        (id, revision_id, actor_id, started_at, solved_at, gave_up_at, question_count)
       SELECT ?, ?, ?, ?, NULL, NULL, 0
       WHERE NOT EXISTS (
         SELECT 1
         FROM play_sessions s
         JOIN puzzle_revisions r ON r.id = s.revision_id
         JOIN puzzles p ON p.id = r.puzzle_id
         WHERE p.id = ?
           AND s.actor_id = ?
           AND s.started_at >= r.created_at
           AND s.solved_at IS NULL
           AND s.gave_up_at IS NULL
       )`,
    ).bind(sessionId, revisionId, actorId, startedAt, puzzleId, actorId),
    db.prepare(OPEN_PLAY_SESSION_SELECT).bind(puzzleId, actorId),
  ]);

  const row = results[1]?.results[0] as SessionRow | undefined;
  if (!row) return null;
  const created = results[0]?.meta.changes === 1;
  return {
    session: await mapPlaySessionRow(db, row),
    resumed: !created,
  };
}

export async function appendPlayTurn(
  db: D1Database,
  input: {
    sessionId: string;
    kind: "question" | "guess" | "hint" | "system";
    userText: string;
    answerCode?: string | null;
    probabilities?: unknown;
    jevModel?: string | null;
    inputTokens?: number | null;
    finishAs?: "solved" | "gave_up";
  },
) {
  const turnId = crypto.randomUUID();
  const now = Date.now();
  const questionCountDelta = input.kind === "question" ? 1 : 0;
  let finishStatement: D1PreparedStatement;

  if (input.finishAs === "solved") {
    finishStatement = db.prepare(
      `UPDATE play_sessions
       SET solved_at = ?, question_count = question_count + ?
       WHERE id = ? AND solved_at IS NULL AND gave_up_at IS NULL
         AND EXISTS (SELECT 1 FROM play_turns WHERE id = ? AND session_id = ?)`
    ).bind(now, questionCountDelta, input.sessionId, turnId, input.sessionId);
  } else if (input.finishAs === "gave_up") {
    finishStatement = db.prepare(
      `UPDATE play_sessions
       SET gave_up_at = ?, question_count = question_count + ?
       WHERE id = ? AND solved_at IS NULL AND gave_up_at IS NULL
         AND EXISTS (SELECT 1 FROM play_turns WHERE id = ? AND session_id = ?)`
    ).bind(now, questionCountDelta, input.sessionId, turnId, input.sessionId);
  } else {
    finishStatement = db.prepare(
      `UPDATE play_sessions SET question_count = question_count + ?
       WHERE id = ? AND solved_at IS NULL AND gave_up_at IS NULL
         AND EXISTS (SELECT 1 FROM play_turns WHERE id = ? AND session_id = ?)`
    ).bind(questionCountDelta, input.sessionId, turnId, input.sessionId);
  }

  const results = await db.batch([
    db.prepare(
      `INSERT INTO play_turns
        (id, session_id, turn_no, kind, user_text, answer_code, probabilities_json,
         confidence, useful_probability, jev_model, input_tokens, created_at)
       SELECT ?, ?,
              COALESCE((SELECT MAX(turn_no) + 1 FROM play_turns WHERE session_id = ?), 1),
              ?, ?, ?, ?, NULL, NULL, ?, ?, ?
       FROM play_sessions
       WHERE id = ? AND solved_at IS NULL AND gave_up_at IS NULL`,
    ).bind(
      turnId,
      input.sessionId,
      input.sessionId,
      input.kind,
      input.userText,
      input.answerCode ?? null,
      input.probabilities === undefined ? null : JSON.stringify(input.probabilities),
      input.jevModel ?? null,
      input.inputTokens ?? null,
      now,
      input.sessionId,
    ),
    finishStatement,
  ]);

  return Number(results[0]?.meta?.changes ?? 0) === 1
    && Number(results[1]?.meta?.changes ?? 0) === 1;
}

export async function revealNextHint(
  db: D1Database,
  sessionId: string,
  revisionId: string,
) {
  const row = await db.prepare(
    `INSERT INTO play_turns
      (id, session_id, turn_no, kind, user_text, answer_code, probabilities_json,
       confidence, useful_probability, jev_model, input_tokens, created_at)
     SELECT
       ?,
       ?,
       COALESCE(
         (SELECT MAX(turn_no) FROM play_turns WHERE session_id = ?),
         0
       ) + 1,
       'hint',
       h.hint_text,
       'HINT_' || h.hint_level,
       NULL,
       NULL,
       NULL,
       NULL,
       NULL,
       ?
     FROM puzzle_hints h
     WHERE h.revision_id = ?
       AND h.hint_level > COALESCE(
         (
           SELECT MAX(CAST(SUBSTR(answer_code, 6) AS INTEGER))
           FROM play_turns
           WHERE session_id = ?
             AND kind = 'hint'
             AND answer_code LIKE 'HINT_%'
         ),
         0
       )
       AND EXISTS (
         SELECT 1 FROM play_sessions s
         WHERE s.id = ? AND s.solved_at IS NULL AND s.gave_up_at IS NULL
       )
     ORDER BY h.hint_level ASC
     LIMIT 1
     RETURNING user_text, answer_code`,
  ).bind(
    crypto.randomUUID(),
    sessionId,
    sessionId,
    Date.now(),
    revisionId,
    sessionId,
    sessionId,
  ).first<{ user_text: string; answer_code: string }>();

  if (!row) return null;
  const level = Number(row.answer_code.slice("HINT_".length));
  if (!Number.isSafeInteger(level) || level < 1) return null;
  return { level, text: row.user_text };
}

export async function getLatestOpenPlaySessionForPuzzle(
  db: D1Database,
  puzzleId: string,
  actorId: string,
): Promise<PlaySessionState | null> {
  const row = await db.prepare(OPEN_PLAY_SESSION_SELECT)
    .bind(puzzleId, actorId)
    .first<SessionRow>();

  if (!row) return null;
  return mapPlaySessionRow(db, row);
}

export async function getPlaySessionResumeData(
  db: D1Database,
  sessionId: string,
) {
  const result = await db.prepare(
    `SELECT id, turn_no, kind, user_text, answer_code, probabilities_json, created_at
     FROM play_turns
     WHERE session_id = ?
       AND kind IN ('question', 'guess', 'hint')
     ORDER BY turn_no DESC`,
  ).bind(sessionId).all<{
    id: string;
    turn_no: number;
    kind: string;
    user_text: string;
    answer_code: string | null;
    probabilities_json: string | null;
    created_at: number;
  }>();

  const history: PlayHistoryItem[] = [];
  const revealedHints: Array<{ level: number; text: string }> = [];

  for (const row of result.results ?? []) {
    if (row.kind === "hint") {
      const level =
        row.answer_code?.startsWith("HINT_")
          ? Number(row.answer_code.slice("HINT_".length))
          : NaN;
      if (Number.isSafeInteger(level) && level > 0) {
        revealedHints.push({ level, text: row.user_text });
      }
      continue;
    }

    if (row.kind !== "question" && row.kind !== "guess") continue;

    let coverage: number | null = null;
    if (row.kind === "guess" && row.probabilities_json) {
      try {
        const parsed = JSON.parse(row.probabilities_json) as {
          coverage?: unknown;
        };
        if (
          typeof parsed.coverage === "number" &&
          Number.isFinite(parsed.coverage)
        ) {
          coverage = Math.min(1, Math.max(0, parsed.coverage));
        }
      } catch {
        coverage = null;
      }
    }

    history.push({
      id: row.id,
      turnNo: row.turn_no,
      kind: row.kind,
      text: row.user_text,
      answerCode: row.answer_code,
      coverage,
      createdAt: row.created_at,
    });
  }

  revealedHints.sort((a, b) => a.level - b.level);
  return { history, revealedHints };
}

export async function getPlayProgressStats(
  db: D1Database,
  sessionId: string,
  startedAt: number,
  endedAt = Date.now(),
): Promise<PlayProgressStats> {
  const row = await db.prepare(
    `SELECT
       SUM(CASE WHEN kind = 'question' THEN 1 ELSE 0 END) AS question_count,
       SUM(CASE WHEN kind = 'guess' THEN 1 ELSE 0 END) AS guess_count,
       SUM(CASE WHEN kind = 'hint' THEN 1 ELSE 0 END) AS hint_count
     FROM play_turns
     WHERE session_id = ?`,
  ).bind(sessionId).first<{
    question_count: number | null;
    guess_count: number | null;
    hint_count: number | null;
  }>();

  return {
    questionCount: row?.question_count ?? 0,
    guessCount: row?.guess_count ?? 0,
    hintCount: row?.hint_count ?? 0,
    durationMs: Math.max(0, endedAt - startedAt),
  };
}

export async function recordFirstPlayResult(
  db: D1Database,
  input: {
    userId: string;
    puzzleId: string;
    sessionId: string;
    outcome: "solved" | "gave_up";
    stats: PlayProgressStats;
    completedAt: number;
  },
) {
  await db.prepare(
    `INSERT INTO user_puzzle_first_results
      (user_id, puzzle_id, session_id, outcome, question_count, guess_count,
       hint_count, duration_ms, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, puzzle_id) DO NOTHING`,
  ).bind(
    input.userId,
    input.puzzleId,
    input.sessionId,
    input.outcome,
    input.stats.questionCount,
    input.stats.guessCount,
    input.stats.hintCount,
    input.stats.durationMs,
    input.completedAt,
  ).run();
}
