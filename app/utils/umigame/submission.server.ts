import { formatPuzzlePublicId } from "./db.server";
import type { UmigameEnv } from "./env.server";
import { reviewPuzzleRevision } from "./puzzle-review.server";
import {
  isAuthorSelectableUmigameTagId,
  type UmigameTagId,
} from "./tags";

export interface PuzzleSubmissionInput {
  title: string;
  statement: string;
  canonicalTruth: string;
  facts: string[];
  hints: string[];
  tags: UmigameTagId[];
}

export interface PuzzleSubmissionValidationError {
  field: string;
  message: string;
}

export interface EditablePuzzleSubmission extends PuzzleSubmissionInput {
  puzzleId: string;
  publicId: number;
  displayId: string;
  revisionId: string;
  version: number;
  status: string;
}

const MAX_TITLE = 100;
const MAX_STATEMENT = 2000;
const MAX_TRUTH = 5000;
const MAX_FACTS = 12;
const MAX_FACT_LENGTH = 500;
const MAX_HINTS = 5;
const MAX_HINT_LENGTH = 500;

function cleanLines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function normalizePuzzleSubmission(input: {
  title?: unknown;
  statement?: unknown;
  canonicalTruth?: unknown;
  facts?: unknown;
  hints?: unknown;
  tags?: unknown;
}) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const statement = typeof input.statement === "string" ? input.statement.trim() : "";
  const canonicalTruth =
    typeof input.canonicalTruth === "string" ? input.canonicalTruth.trim() : "";

  const facts = cleanLines(
    Array.isArray(input.facts)
      ? input.facts.filter((value): value is string => typeof value === "string")
      : typeof input.facts === "string"
        ? input.facts.split(/\r?\n/)
        : [],
  );
  const hints = cleanLines(
    Array.isArray(input.hints)
      ? input.hints.filter((value): value is string => typeof value === "string")
      : typeof input.hints === "string"
        ? input.hints.split(/\r?\n/)
        : [],
  );
  const tags = Array.from(
    new Set(
      (Array.isArray(input.tags)
        ? input.tags
        : typeof input.tags === "string"
          ? [input.tags]
          : []
      )
        .filter((value): value is string => typeof value === "string")
        .filter(isAuthorSelectableUmigameTagId),
    ),
  );

  const errors: PuzzleSubmissionValidationError[] = [];
  if (tags.includes("short") && tags.includes("deep")) {
    errors.push({
      field: "tags",
      message: "「短め」と「じっくり」はどちらか一方を選んでください。",
    });
  }
  if (title.length < 1 || title.length > MAX_TITLE) {
    errors.push({ field: "title", message: `タイトルは1〜${MAX_TITLE}文字で入力してください。` });
  }
  if (statement.length < 10 || statement.length > MAX_STATEMENT) {
    errors.push({
      field: "statement",
      message: `問題文は10〜${MAX_STATEMENT}文字で入力してください。`,
    });
  }
  if (canonicalTruth.length < 10 || canonicalTruth.length > MAX_TRUTH) {
    errors.push({
      field: "canonicalTruth",
      message: `真相は10〜${MAX_TRUTH}文字で入力してください。`,
    });
  }
  if (facts.length < 1 || facts.length > MAX_FACTS) {
    errors.push({
      field: "facts",
      message: `重要事実は1〜${MAX_FACTS}件、1行につき1件で入力してください。`,
    });
  } else if (facts.some((fact) => fact.length > MAX_FACT_LENGTH)) {
    errors.push({
      field: "facts",
      message: `重要事実は1件${MAX_FACT_LENGTH}文字以内にしてください。`,
    });
  }
  if (hints.length > MAX_HINTS) {
    errors.push({
      field: "hints",
      message: `ヒントは最大${MAX_HINTS}件までです。`,
    });
  } else if (hints.some((hint) => hint.length > MAX_HINT_LENGTH)) {
    errors.push({
      field: "hints",
      message: `ヒントは1件${MAX_HINT_LENGTH}文字以内にしてください。`,
    });
  }

  return {
    value: {
      title,
      statement,
      canonicalTruth,
      facts,
      hints,
      tags,
    } satisfies PuzzleSubmissionInput,
    errors,
  };
}

export async function getEditablePuzzleSubmission(
  db: D1Database,
  publicId: number,
  authorUserId: string,
): Promise<EditablePuzzleSubmission | null> {
  const row = await db.prepare(
    `SELECT p.id AS puzzle_id, p.public_id, p.status, p.current_revision_id,
            r.version, r.title, r.statement, r.canonical_truth
     FROM puzzles p
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     WHERE p.public_id = ? AND p.author_actor_id = ?
     LIMIT 1`,
  ).bind(publicId, authorUserId).first<{
    puzzle_id: string;
    public_id: number;
    status: string;
    current_revision_id: string;
    version: number;
    title: string;
    statement: string;
    canonical_truth: string;
  }>();

  if (!row) return null;

  const [factsResult, hintsResult, tagsResult] = await Promise.all([
    db.prepare(
      "SELECT fact_text FROM puzzle_facts WHERE revision_id = ? ORDER BY sort_order ASC",
    ).bind(row.current_revision_id).all<{ fact_text: string }>(),
    db.prepare(
      "SELECT hint_text FROM puzzle_hints WHERE revision_id = ? ORDER BY hint_level ASC",
    ).bind(row.current_revision_id).all<{ hint_text: string }>(),
    db.prepare(
      "SELECT tag_id FROM puzzle_tags WHERE puzzle_id = ? ORDER BY tag_id ASC",
    ).bind(row.puzzle_id).all<{ tag_id: string }>(),
  ]);

  return {
    puzzleId: row.puzzle_id,
    publicId: row.public_id,
    displayId: formatPuzzlePublicId(row.public_id),
    revisionId: row.current_revision_id,
    version: row.version,
    status: row.status,
    title: row.title,
    statement: row.statement,
    canonicalTruth: row.canonical_truth,
    facts: (factsResult.results ?? []).map((item) => item.fact_text),
    hints: (hintsResult.results ?? []).map((item) => item.hint_text),
    tags: (tagsResult.results ?? [])
      .map((item) => item.tag_id)
      .filter(isAuthorSelectableUmigameTagId),
  };
}

export async function createPuzzleSubmission(
  db: D1Database,
  authorUserId: string,
  input: PuzzleSubmissionInput,
) {
  const now = Date.now();
  const since = now - 24 * 60 * 60 * 1000;
  const puzzleId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO puzzle_id_sequence (id)
       SELECT NULL
       WHERE (SELECT COUNT(*) FROM puzzles WHERE author_actor_id = ? AND created_at >= ?) < 5
       RETURNING id`,
    ).bind(authorUserId, since),
    db.prepare(
      `INSERT INTO puzzles
        (id, public_id, author_actor_id, status, current_revision_id, created_at, updated_at, published_at)
       SELECT ?, (SELECT MAX(id) FROM puzzle_id_sequence), ?, 'pending_review', ?, ?, ?, NULL
       WHERE (SELECT COUNT(*) FROM puzzles WHERE author_actor_id = ? AND created_at >= ?) < 5
       RETURNING public_id`,
    ).bind(puzzleId, authorUserId, revisionId, now, now, authorUserId, since),
    db.prepare(
      `INSERT INTO puzzle_revisions
        (id, puzzle_id, version, title, statement, canonical_truth, author_notes,
         difficulty, source_type, source_url, license_name, attribution_text, created_at)
       SELECT ?, ?, 1, ?, ?, ?, NULL, 'MEDIUM', 'original', NULL, NULL, NULL, ?
       WHERE EXISTS (SELECT 1 FROM puzzles WHERE id = ?)`,
    ).bind(
      revisionId,
      puzzleId,
      input.title,
      input.statement,
      input.canonicalTruth,
      now,
      puzzleId,
    ),
  ];

  input.facts.forEach((fact, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO puzzle_facts
          (id, revision_id, fact_text, importance, weight, sort_order)
         SELECT ?, ?, ?, 'core', 1, ?
         WHERE EXISTS (SELECT 1 FROM puzzles WHERE id = ?)`,
      ).bind(crypto.randomUUID(), revisionId, fact, index + 1, puzzleId),
    );
  });

  input.hints.forEach((hint, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO puzzle_hints
          (id, revision_id, hint_level, hint_text)
         SELECT ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM puzzles WHERE id = ?)`,
      ).bind(crypto.randomUUID(), revisionId, index + 1, hint, puzzleId),
    );
  });

  input.tags.forEach((tagId) => {
    statements.push(
      db.prepare(
        `INSERT INTO puzzle_tags (puzzle_id, tag_id, source, probability)
         SELECT ?, ?, 'author', NULL
         WHERE EXISTS (SELECT 1 FROM puzzles WHERE id = ?)`,
      ).bind(puzzleId, tagId, puzzleId),
    );
  });

  const results = await db.batch(statements);
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    throw new Response("問題投稿は24時間に5件までです。", { status: 429 });
  }

  const sequenceRow = results[0]?.results?.[0] as { id?: unknown } | undefined;
  const publicId = Number(sequenceRow?.id ?? 0);
  if (!publicId) {
    throw new Error("Failed to allocate puzzle public ID.");
  }

  return {
    puzzleId,
    publicId,
    displayId: formatPuzzlePublicId(publicId),
    revisionId,
  };
}

export async function createPuzzleRevision(
  db: D1Database,
  publicId: number,
  authorUserId: string,
  input: PuzzleSubmissionInput,
) {
  const current = await db.prepare(
    `SELECT p.id AS puzzle_id, p.public_id, p.current_revision_id,
            r.version, r.author_notes, r.difficulty, r.source_type,
            r.source_url, r.license_name, r.attribution_text
     FROM puzzles p
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     WHERE p.public_id = ? AND p.author_actor_id = ?
     LIMIT 1`,
  ).bind(publicId, authorUserId).first<{
    puzzle_id: string;
    public_id: number;
    current_revision_id: string;
    version: number;
    author_notes: string | null;
    difficulty: string;
    source_type: string;
    source_url: string | null;
    license_name: string | null;
    attribution_text: string | null;
  }>();

  if (!current) {
    throw new Response("問題が見つかりません。", { status: 404 });
  }

  const now = Date.now();
  const revisionId = crypto.randomUUID();
  const version = current.version + 1;
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO puzzle_revisions
        (id, puzzle_id, version, title, statement, canonical_truth, author_notes,
         difficulty, source_type, source_url, license_name, attribution_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      revisionId,
      current.puzzle_id,
      version,
      input.title,
      input.statement,
      input.canonicalTruth,
      current.author_notes,
      current.difficulty,
      current.source_type,
      current.source_url,
      current.license_name,
      current.attribution_text,
      now,
    ),
  ];

  input.facts.forEach((fact, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO puzzle_facts
          (id, revision_id, fact_text, importance, weight, sort_order)
         VALUES (?, ?, ?, 'core', 1, ?)`,
      ).bind(crypto.randomUUID(), revisionId, fact, index + 1),
    );
  });

  input.hints.forEach((hint, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO puzzle_hints
          (id, revision_id, hint_level, hint_text)
         VALUES (?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), revisionId, index + 1, hint),
    );
  });

  statements.push(
    db.prepare("DELETE FROM puzzle_tags WHERE puzzle_id = ?").bind(current.puzzle_id),
  );
  input.tags.forEach((tagId) => {
    statements.push(
      db.prepare(
        `INSERT INTO puzzle_tags (puzzle_id, tag_id, source, probability)
         VALUES (?, ?, 'author', NULL)`,
      ).bind(current.puzzle_id, tagId),
    );
  });

  statements.push(
    db.prepare(
      `UPDATE puzzles
       SET current_revision_id = ?, status = 'pending_review', updated_at = ?
       WHERE id = ? AND current_revision_id = ?`,
    ).bind(revisionId, now, current.puzzle_id, current.current_revision_id),
  );

  await db.batch(statements);
  return {
    puzzleId: current.puzzle_id,
    publicId: current.public_id,
    displayId: formatPuzzlePublicId(current.public_id),
    revisionId,
    version,
  };
}

export async function enqueuePuzzleReview(
  env: UmigameEnv,
  revisionId: string,
) {
  if (env.UMIGAME_AI_QUEUE) {
    await env.UMIGAME_AI_QUEUE.send({
      type: "puzzle_review",
      revisionId,
    });
    return "queued" as const;
  }

  await reviewPuzzleRevision(env, revisionId);
  return "inline" as const;
}
