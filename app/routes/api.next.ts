import type { ActionFunctionArgs } from "react-router";
import {
  type LetterState,
  type WordleConstraint,
  filterAnswers,
  suggestMoves,
} from "~/utils/wordle";

interface NextApiRequestBody {
  constraints?: Array<{
    guess?: unknown;
    pattern?: unknown;
  }>;
}

const MAX_CONSTRAINTS = 6;
const MAX_REQUEST_BODY_BYTES = 8 * 1024;

const ALLOWED_ORIGINS = new Set([
  "https://roseu.net",
  "https://www.roseu.net",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function buildCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://roseu.net";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function isPatternValue(value: unknown): value is Exclude<LetterState, -1> {
  return value === 0 || value === 1 || value === 2;
}

function parseConstraints(value: NextApiRequestBody["constraints"]): WordleConstraint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: WordleConstraint[] = [];

  for (const row of value) {
    const guess = typeof row?.guess === "string" ? row.guess.toLowerCase() : "";
    const patternRaw = row?.pattern;

    if (!/^[a-z]{5}$/.test(guess)) {
      continue;
    }
    if (!Array.isArray(patternRaw) || patternRaw.length !== 5) {
      continue;
    }
    if (!patternRaw.every(isPatternValue)) {
      continue;
    }

    parsed.push({
      guess,
      pattern: [patternRaw[0], patternRaw[1], patternRaw[2], patternRaw[3], patternRaw[4]],
    });

    if (parsed.length >= MAX_CONSTRAINTS) {
      break;
    }
  }

  return parsed;
}

export async function action({ request }: ActionFunctionArgs) {
  const method = request.method.toUpperCase();
  const corsHeaders = buildCorsHeaders(request);

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method !== "POST") {
    return Response.json(
      { error: { code: "method_not_allowed", message: "POST only" } },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bodyBytes = Number(contentLength);
      if (Number.isFinite(bodyBytes) && bodyBytes > MAX_REQUEST_BODY_BYTES) {
        return Response.json(
          { error: { code: "payload_too_large", message: "Request body is too large." } },
          { status: 413, headers: corsHeaders }
        );
      }
    }

    const body = (await request.json()) as NextApiRequestBody;
    const constraints = parseConstraints(body?.constraints);
    const turnsLeft = Math.max(0, 6 - constraints.length);
    const candidates = filterAnswers(constraints);
    const solver = turnsLeft > 0
      ? suggestMoves(candidates, turnsLeft)
      : { suggestions: [], recommended: null, mode: "heuristic" as const };

    return Response.json({
      candidateCount: candidates.length,
      solver,
      mode: "api",
    }, { headers: corsHeaders });
  } catch {
    return Response.json(
      { error: { code: "invalid_json", message: "Invalid JSON request body." } },
      { status: 400, headers: corsHeaders }
    );
  }
}

export async function loader({ request }: ActionFunctionArgs) {
  const corsHeaders = buildCorsHeaders(request);
  return Response.json(
    { error: { code: "method_not_allowed", message: "Use POST /api/next" } },
    { status: 405, headers: corsHeaders }
  );
}
