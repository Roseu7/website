import type { PlaySessionState } from "./db.server";
import type { UmigameEnv } from "./env.server";
import { evaluateGmQuestion, GM_CODES, type GmAnswerCode } from "./game.server";
import {
  getJevErrorKind,
  isJevProviderConfigured,
  type JevProviderName,
} from "./jev.server";

interface GoldenCaseRow {
  id: string;
  question: string;
  expected_code: GmAnswerCode;
  puzzle_id: string;
  public_id: number;
  revision_id: string;
  title: string;
  statement: string;
  canonical_truth: string;
  difficulty: string;
}

interface GoldenBatchRow {
  batch_id: string;
  provider: string;
  model: string | null;
  total: number;
  passed: number;
  errors: number;
  timeouts: number;
  avg_latency: number;
  input_tokens: number;
  output_tokens: number;
  created_at: number;
}

function probabilityForCode(
  probabilities: Record<string, number> | null,
  code: GmAnswerCode,
) {
  if (!probabilities) return null;
  const direct = probabilities[code];
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const index = GM_CODES.indexOf(code);
  const indexed = probabilities[String(index)];
  return typeof indexed === "number" && Number.isFinite(indexed)
    ? indexed
    : null;
}

async function loadGoldenCases(db: D1Database) {
  const result = await db.prepare(
    `SELECT c.id, c.question, c.expected_code,
            p.id AS puzzle_id, p.public_id,
            r.id AS revision_id, r.title, r.statement, r.canonical_truth, r.difficulty
     FROM golden_test_cases c
     JOIN puzzles p ON p.id = c.puzzle_id
     JOIN puzzle_revisions r ON r.id = p.current_revision_id
     WHERE c.active = 1
     ORDER BY p.public_id ASC, c.sort_order ASC, c.id ASC`,
  ).all<GoldenCaseRow>();

  const rows = result.results ?? [];
  const revisionIds = Array.from(new Set(rows.map((row) => row.revision_id)));
  const factsByRevision = new Map<
    string,
    PlaySessionState["facts"]
  >();

  for (const revisionId of revisionIds) {
    const facts = await db.prepare(
      `SELECT id, fact_text, importance, weight
       FROM puzzle_facts
       WHERE revision_id = ?
       ORDER BY sort_order ASC`,
    ).bind(revisionId).all<{
      id: string;
      fact_text: string;
      importance: string;
      weight: number;
    }>();
    factsByRevision.set(
      revisionId,
      (facts.results ?? []).map((fact) => ({
        id: fact.id,
        text: fact.fact_text,
        importance: fact.importance === "core" ? "core" : "supporting",
        weight: fact.weight,
      })),
    );
  }

  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    expectedCode: row.expected_code,
    session: {
      sessionId: "golden:" + row.id,
      actorId: "golden-test",
      startedAt: 0,
      solvedAt: null,
      gaveUpAt: null,
      questionCount: 0,
      puzzleId: row.puzzle_id,
      publicId: row.public_id,
      displayId: String(row.public_id).padStart(7, "0"),
      revisionId: row.revision_id,
      title: row.title,
      statement: row.statement,
      canonicalTruth: row.canonical_truth,
      difficulty: row.difficulty,
      facts: factsByRevision.get(row.revision_id) ?? [],
      hints: [],
    } satisfies PlaySessionState,
  }));
}

async function insertGoldenRun(
  db: D1Database,
  input: {
    batchId: string;
    caseId: string;
    provider: JevProviderName;
    model: string | null;
    expectedCode: GmAnswerCode;
    actualCode: GmAnswerCode | null;
    probabilities: Record<string, number> | null;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    status: "ok" | "error";
    errorKind: string | null;
  },
) {
  await db.prepare(
    `INSERT INTO golden_test_runs
      (id, batch_id, case_id, provider, model, expected_code, actual_code,
       probabilities_json, input_tokens, output_tokens, latency_ms,
       status, error_kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    input.batchId,
    input.caseId,
    input.provider,
    input.model,
    input.expectedCode,
    input.actualCode,
    input.probabilities ? JSON.stringify(input.probabilities) : null,
    input.inputTokens,
    input.outputTokens,
    input.latencyMs,
    input.status,
    input.errorKind,
    Date.now(),
  ).run();
}

export async function runGoldenTestBatch(
  env: UmigameEnv,
  provider: JevProviderName,
) {
  if (!isJevProviderConfigured(env, provider)) {
    throw new Response(
      provider === "typesafe"
        ? "TYPESAFE_API_KEYが設定されていません。"
        : "JEV_API_TOKENが設定されていません。",
      { status: 503 },
    );
  }

  const cases = await loadGoldenCases(env.DB);
  if (cases.length === 0) {
    throw new Response("有効なGolden Test Caseがありません。", { status: 400 });
  }

  const batchId = crypto.randomUUID();
  let passed = 0;
  let errors = 0;

  for (let offset = 0; offset < cases.length; offset += 4) {
    const chunk = cases.slice(offset, offset + 4);
    const results = await Promise.all(
      chunk.map(async (testCase) => {
        const startedAt = Date.now();
        try {
          const result = await evaluateGmQuestion(
            env,
            testCase.session,
            testCase.question,
            {
              purpose: "golden_test",
              targetId: testCase.id,
              provider,
            },
          );
          await insertGoldenRun(env.DB, {
            batchId,
            caseId: testCase.id,
            provider,
            model: result.model,
            expectedCode: testCase.expectedCode,
            actualCode: result.code,
            probabilities: result.probabilities,
            inputTokens: result.inputTokens ?? 0,
            outputTokens: result.outputTokens ?? 0,
            latencyMs: result.latencyMs,
            status: "ok",
            errorKind: null,
          });
          return result.code === testCase.expectedCode ? "pass" : "fail";
        } catch (error) {
          await insertGoldenRun(env.DB, {
            batchId,
            caseId: testCase.id,
            provider,
            model: env.JEV_MODEL ?? null,
            expectedCode: testCase.expectedCode,
            actualCode: null,
            probabilities: null,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: Date.now() - startedAt,
            status: "error",
            errorKind: getJevErrorKind(error),
          });
          return "error";
        }
      }),
    );

    passed += results.filter((result) => result === "pass").length;
    errors += results.filter((result) => result === "error").length;
  }

  return {
    batchId,
    provider,
    total: cases.length,
    passed,
    errors,
  };
}

async function latestBatchForProvider(
  db: D1Database,
  provider: JevProviderName,
) {
  return db.prepare(
    `SELECT batch_id
     FROM golden_test_runs
     WHERE provider = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  ).bind(provider).first<{ batch_id: string }>();
}

async function probabilityDifference(
  db: D1Database,
  vercelBatchId: string | null,
  typesafeBatchId: string | null,
) {
  if (!vercelBatchId || !typesafeBatchId) return null;
  const [vercel, typesafe] = await Promise.all([
    db.prepare(
      `SELECT case_id, expected_code, probabilities_json
       FROM golden_test_runs WHERE batch_id = ? AND status = 'ok'`,
    ).bind(vercelBatchId).all<{
      case_id: string;
      expected_code: GmAnswerCode;
      probabilities_json: string | null;
    }>(),
    db.prepare(
      `SELECT case_id, expected_code, probabilities_json
       FROM golden_test_runs WHERE batch_id = ? AND status = 'ok'`,
    ).bind(typesafeBatchId).all<{
      case_id: string;
      expected_code: GmAnswerCode;
      probabilities_json: string | null;
    }>(),
  ]);

  const right = new Map(
    (typesafe.results ?? []).map((row) => [row.case_id, row]),
  );
  const differences: number[] = [];

  for (const left of vercel.results ?? []) {
    const other = right.get(left.case_id);
    if (!other) continue;
    let leftProbabilities: Record<string, number> | null = null;
    let rightProbabilities: Record<string, number> | null = null;
    try {
      leftProbabilities = left.probabilities_json
        ? JSON.parse(left.probabilities_json)
        : null;
      rightProbabilities = other.probabilities_json
        ? JSON.parse(other.probabilities_json)
        : null;
    } catch {
      continue;
    }
    const a = probabilityForCode(leftProbabilities, left.expected_code);
    const b = probabilityForCode(rightProbabilities, other.expected_code);
    if (a !== null && b !== null) differences.push(Math.abs(a - b));
  }

  if (differences.length === 0) return null;
  return differences.reduce((sum, value) => sum + value, 0) / differences.length;
}

export async function getGoldenTestOverview(env: UmigameEnv) {
  const db = env.DB;
  const [caseCount, batchRows, latestRuns, vercelLatest, typesafeLatest] =
    await Promise.all([
      db.prepare(
        "SELECT COUNT(*) AS count FROM golden_test_cases WHERE active = 1",
      ).first<{ count: number }>(),
      db.prepare(
        `SELECT batch_id, provider, MAX(model) AS model,
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'ok' AND actual_code = expected_code THEN 1 ELSE 0 END) AS passed,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN error_kind = 'timeout' THEN 1 ELSE 0 END) AS timeouts,
                AVG(latency_ms) AS avg_latency,
                SUM(input_tokens) AS input_tokens,
                SUM(output_tokens) AS output_tokens,
                MAX(created_at) AS created_at
         FROM golden_test_runs
         GROUP BY batch_id, provider
         ORDER BY created_at DESC
         LIMIT 12`,
      ).all<GoldenBatchRow>(),
      db.prepare(
        `SELECT r.id, r.batch_id, r.case_id, r.provider, r.model,
                r.expected_code, r.actual_code, r.probabilities_json,
                r.input_tokens, r.output_tokens, r.latency_ms,
                r.status, r.error_kind, r.created_at,
                c.question, p.public_id, pr.title
         FROM golden_test_runs r
         JOIN golden_test_cases c ON c.id = r.case_id
         JOIN puzzles p ON p.id = c.puzzle_id
         JOIN puzzle_revisions pr ON pr.id = p.current_revision_id
         ORDER BY r.created_at DESC
         LIMIT 36`,
      ).all<{
        id: string;
        batch_id: string;
        case_id: string;
        provider: string;
        model: string | null;
        expected_code: GmAnswerCode;
        actual_code: GmAnswerCode | null;
        probabilities_json: string | null;
        input_tokens: number;
        output_tokens: number;
        latency_ms: number;
        status: string;
        error_kind: string | null;
        created_at: number;
        question: string;
        public_id: number;
        title: string;
      }>(),
      latestBatchForProvider(db, "vercel"),
      latestBatchForProvider(db, "typesafe"),
    ]);

  return {
    caseCount: caseCount?.count ?? 0,
    providers: {
      vercel: isJevProviderConfigured(env, "vercel"),
      typesafe: isJevProviderConfigured(env, "typesafe"),
    },
    batches: (batchRows.results ?? []).map((row) => ({
      batchId: row.batch_id,
      provider: row.provider,
      model: row.model,
      total: row.total ?? 0,
      passed: row.passed ?? 0,
      errors: row.errors ?? 0,
      timeouts: row.timeouts ?? 0,
      avgLatency: Math.round(row.avg_latency ?? 0),
      inputTokens: row.input_tokens ?? 0,
      outputTokens: row.output_tokens ?? 0,
      createdAt: row.created_at,
    })),
    latestRuns: (latestRuns.results ?? []).map((row) => {
      let probabilities: Record<string, number> | null = null;
      try {
        probabilities = row.probabilities_json
          ? JSON.parse(row.probabilities_json)
          : null;
      } catch {
        probabilities = null;
      }
      return {
        id: row.id,
        batchId: row.batch_id,
        caseId: row.case_id,
        provider: row.provider,
        model: row.model,
        expectedCode: row.expected_code,
        actualCode: row.actual_code,
        expectedProbability: probabilityForCode(
          probabilities,
          row.expected_code,
        ),
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        latencyMs: row.latency_ms,
        status: row.status,
        errorKind: row.error_kind,
        createdAt: row.created_at,
        question: row.question,
        publicId: row.public_id,
        displayId: String(row.public_id).padStart(7, "0"),
        title: row.title,
      };
    }),
    comparison: {
      vercelBatchId: vercelLatest?.batch_id ?? null,
      typesafeBatchId: typesafeLatest?.batch_id ?? null,
      averageExpectedProbabilityDifference: await probabilityDifference(
        db,
        vercelLatest?.batch_id ?? null,
        typesafeLatest?.batch_id ?? null,
      ),
    },
  };
}
