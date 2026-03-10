import answersRaw from "../assets/wordle-answers.json";
import allowedRaw from "../assets/wordle-allowed.json";

export type LetterState = -1 | 0 | 1 | 2;

export interface WordleConstraint {
  guess: string;
  pattern: [number, number, number, number, number];
}

export interface SolverSuggestion {
  word: string;
  expectedRemaining: number | null;
  worstBucket: number | null;
  safe: boolean;
  inAnswers: boolean;
  inCandidates: boolean;
  probeLetterCount: number;
  probeLetterScore: number;
}

export interface SolverResult {
  candidateSuggestions: SolverSuggestion[];
  explorationSuggestions: SolverSuggestion[];
  recommended: SolverSuggestion | null;
  mode: "heuristic" | "late-exact";
}

function parseWordList(raw: string[]): string[] {
  return raw
    .map((word) => word.trim().toLowerCase())
    .filter((word) => /^[a-z]{5}$/.test(word));
}

function uniqueWords(words: string[]): string[] {
  return Array.from(new Set(words));
}

const parsedAnswers = uniqueWords(parseWordList(answersRaw));
const parsedAllowed = uniqueWords(parseWordList(allowedRaw));
const allowedSet = new Set(parsedAllowed);
for (const answer of parsedAnswers) {
  if (!allowedSet.has(answer)) {
    parsedAllowed.push(answer);
    allowedSet.add(answer);
  }
}

export const WORDLE_ANSWERS = parsedAnswers;
export const WORDLE_ALLOWED = parsedAllowed;

const ANSWER_SET = new Set(WORDLE_ANSWERS);
const ALLOWED_SET = new Set(WORDLE_ALLOWED);
const ANSWER_INDEX = new Map<string, number>(WORDLE_ANSWERS.map((word, index) => [word, index]));

const FEEDBACK_CACHE_LIMIT = 1200;
const FEEDBACK_UNKNOWN = 255;
const CANDIDATE_SUGGESTION_LIMIT = 5;
const EXPLORATION_SUGGESTION_LIMIT = 5;
const feedbackRowCache = new Map<string, Uint8Array>();

function getFeedbackRow(guess: string): Uint8Array {
  const cached = feedbackRowCache.get(guess);
  if (cached) {
    return cached;
  }

  const row = new Uint8Array(WORDLE_ANSWERS.length);
  row.fill(FEEDBACK_UNKNOWN);
  feedbackRowCache.set(guess, row);

  if (feedbackRowCache.size > FEEDBACK_CACHE_LIMIT) {
    const oldestKey = feedbackRowCache.keys().next().value as string | undefined;
    if (oldestKey) {
      feedbackRowCache.delete(oldestKey);
    }
  }

  return row;
}

function toPatternCode(pattern: readonly number[]): number {
  let code = 0;
  for (let i = 0; i < 5; i += 1) {
    code = code * 3 + pattern[i];
  }
  return code;
}

function partitionByPattern(candidates: readonly string[], guess: string): Map<number, string[]> {
  const buckets = new Map<number, string[]>();
  for (const secret of candidates) {
    const code = feedbackCodeCached(secret, guess);
    const bucket = buckets.get(code);
    if (bucket) {
      bucket.push(secret);
    } else {
      buckets.set(code, [secret]);
    }
  }
  return buckets;
}

function coverageScore(guess: string, letterScore: Map<string, number>): number {
  const used = new Set<string>();
  let score = 0;
  for (const letter of guess) {
    if (used.has(letter)) continue;
    used.add(letter);
    score += letterScore.get(letter) ?? 0;
  }
  return score;
}

function buildCoveragePool(candidates: readonly string[], poolSize: number): string[] {
  const letterScore = new Map<string, number>();
  for (const word of candidates) {
    const used = new Set<string>();
    for (const letter of word) {
      if (used.has(letter)) continue;
      used.add(letter);
      letterScore.set(letter, (letterScore.get(letter) ?? 0) + 1);
    }
  }

  const ranked = WORDLE_ALLOWED
    .map((guess) => ({
      guess,
      score: coverageScore(guess, letterScore),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, poolSize)
    .map((entry) => entry.guess);

  return uniqueWords([...candidates, ...ranked]);
}

function buildKnownPresentLetterSet(constraints: readonly WordleConstraint[]): Set<string> {
  const presentLetters = new Set<string>();

  for (const constraint of constraints) {
    for (let index = 0; index < constraint.guess.length; index += 1) {
      if (constraint.pattern[index] === 1 || constraint.pattern[index] === 2) {
        presentLetters.add(constraint.guess[index]);
      }
    }
  }

  return presentLetters;
}

function buildProbeLetterScoreMap(
  candidates: readonly string[],
  knownPresentLetters: ReadonlySet<string>
): Map<string, number> {
  const probeScore = new Map<string, number>();

  for (let index = 0; index < 5; index += 1) {
    const positionCounts = new Map<string, number>();

    for (const word of candidates) {
      const letter = word[index];
      positionCounts.set(letter, (positionCounts.get(letter) ?? 0) + 1);
    }

    if (positionCounts.size <= 1) {
      continue;
    }

    for (const [letter, count] of positionCounts) {
      if (knownPresentLetters.has(letter)) continue;
      probeScore.set(letter, (probeScore.get(letter) ?? 0) + count);
    }
  }

  return probeScore;
}

function getProbeMetrics(
  word: string,
  probeLetterScoreMap: ReadonlyMap<string, number>
): { probeLetterCount: number; probeLetterScore: number } {
  const counted = new Set<string>();
  let probeLetterCount = 0;
  let probeLetterScore = 0;

  for (const letter of word) {
    if (counted.has(letter)) continue;
    counted.add(letter);

    const score = probeLetterScoreMap.get(letter);
    if (!score) continue;
    probeLetterCount += 1;
    probeLetterScore += score;
  }

  return {
    probeLetterCount,
    probeLetterScore,
  };
}

function buildUnusedLetterScoreMap(candidates: readonly string[], knownPresentLetters: ReadonlySet<string>): Map<string, number> {
  const letterScore = new Map<string, number>();

  for (const word of candidates) {
    const counted = new Set<string>();
    for (const letter of word) {
      if (knownPresentLetters.has(letter) || counted.has(letter)) continue;
      counted.add(letter);
      letterScore.set(letter, (letterScore.get(letter) ?? 0) + 1);
    }
  }

  return letterScore;
}

function getUnusedLetterMetrics(
  word: string,
  knownPresentLetters: ReadonlySet<string>,
  letterScore: ReadonlyMap<string, number>
) {
  const unseen = new Set<string>();
  let unusedLetterScore = 0;

  for (const letter of word) {
    if (knownPresentLetters.has(letter) || unseen.has(letter)) continue;
    unseen.add(letter);
    unusedLetterScore += letterScore.get(letter) ?? 0;
  }

  return {
    unusedLetterCount: unseen.size,
    unusedLetterScore,
  };
}

function expectedRemaining(candidates: readonly string[], guess: string): number {
  const counts = new Map<number, number>();
  for (const secret of candidates) {
    const pattern = feedbackCodeCached(secret, guess);
    counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  }

  const size = Math.max(1, candidates.length);
  let sumSquares = 0;
  for (const count of counts.values()) {
    sumSquares += count * count;
  }

  return sumSquares / size;
}

function worstBucket(candidates: readonly string[], guess: string): number {
  const counts = new Map<number, number>();
  let maxBucket = 0;
  for (const secret of candidates) {
    const pattern = feedbackCodeCached(secret, guess);
    const next = (counts.get(pattern) ?? 0) + 1;
    counts.set(pattern, next);
    if (next > maxBucket) {
      maxBucket = next;
    }
  }
  return maxBucket;
}

interface ProofContext {
  nodes: number;
  maxNodes: number;
}

function proofOptions(candidates: readonly string[], turnsLeft: number): string[] {
  if (turnsLeft <= 2) {
    return [...candidates];
  }

  if (candidates.length <= 12) {
    return buildCoveragePool(candidates, 400);
  }

  return buildCoveragePool(candidates, 180);
}

function proofMemoKey(candidates: readonly string[], turnsLeft: number): string {
  return `${turnsLeft}|${candidates.join(",")}`;
}

function canForceWin(
  candidates: readonly string[],
  turnsLeft: number,
  memo: Map<string, boolean>,
  context: ProofContext
): boolean {
  context.nodes += 1;
  if (context.nodes > context.maxNodes) {
    return false;
  }

  if (candidates.length <= 1) {
    return true;
  }

  if (turnsLeft <= 0) {
    return false;
  }

  if (turnsLeft === 1) {
    return false;
  }

  const memoKey = proofMemoKey(candidates, turnsLeft);
  const cached = memo.get(memoKey);
  if (cached !== undefined) {
    return cached;
  }

  const options = proofOptions(candidates, turnsLeft);

  for (const guess of options) {
    const buckets = partitionByPattern(candidates, guess);
    let isWinningMove = true;

    for (const bucket of buckets.values()) {
      if (!canForceWin(bucket, turnsLeft - 1, memo, context)) {
        isWinningMove = false;
        break;
      }
    }

    if (isWinningMove) {
      memo.set(memoKey, true);
      return true;
    }
  }

  memo.set(memoKey, false);
  return false;
}

function isSafeMove(
  candidates: readonly string[],
  guess: string,
  turnsLeft: number,
  memo: Map<string, boolean>
): boolean {
  if (turnsLeft <= 0) {
    return false;
  }

  if (turnsLeft === 1) {
    return candidates.length === 1 && candidates[0] === guess;
  }

  const context: ProofContext = {
    nodes: 0,
    maxNodes: 25000,
  };

  const buckets = partitionByPattern(candidates, guess);
  for (const bucket of buckets.values()) {
    if (!canForceWin(bucket, turnsLeft - 1, memo, context)) {
      return false;
    }
  }

  return true;
}

export function feedbackPattern(secret: string, guess: string): [number, number, number, number, number] {
  const result: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const used = [false, false, false, false, false];

  for (let i = 0; i < 5; i += 1) {
    if (secret[i] === guess[i]) {
      result[i] = 2;
      used[i] = true;
    }
  }

  for (let i = 0; i < 5; i += 1) {
    if (result[i] === 2) continue;

    const letter = guess[i];
    for (let j = 0; j < 5; j += 1) {
      if (used[j]) continue;
      if (secret[j] !== letter) continue;
      result[i] = 1;
      used[j] = true;
      break;
    }
  }

  return result;
}

export function feedbackCode(secret: string, guess: string): number {
  return feedbackCodeCached(secret, guess);
}

function feedbackCodeCached(secret: string, guess: string): number {
  const answerIndex = ANSWER_INDEX.get(secret);
  if (answerIndex === undefined) {
    return toPatternCode(feedbackPattern(secret, guess));
  }

  const row = getFeedbackRow(guess);
  const cached = row[answerIndex];
  if (cached !== FEEDBACK_UNKNOWN) {
    return cached;
  }

  const code = toPatternCode(feedbackPattern(secret, guess));
  row[answerIndex] = code;
  return code;
}

export function isCompletePattern(pattern: readonly LetterState[]): pattern is [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] {
  return pattern.length === 5 && pattern.every((value) => value === 0 || value === 1 || value === 2);
}

function filterMatchingWords(wordPool: readonly string[], constraints: readonly WordleConstraint[]): string[] {
  return wordPool.filter((candidate) => {
    for (const constraint of constraints) {
      if (feedbackCode(candidate, constraint.guess) !== toPatternCode(constraint.pattern)) {
        return false;
      }
    }
    return true;
  });
}

export function filterAnswers(constraints: readonly WordleConstraint[]): string[] {
  const fromAnswers = filterMatchingWords(WORDLE_ANSWERS, constraints);

  if (constraints.length === 0) {
    return fromAnswers;
  }

  const shouldProbeFallback = constraints.length >= 3 && fromAnswers.length <= 24;
  if (!shouldProbeFallback && fromAnswers.length > 0) {
    return fromAnswers;
  }

  const fromAllowed = filterMatchingWords(WORDLE_ALLOWED, constraints);
  if (fromAnswers.length === 0) {
    return fromAllowed;
  }

  const extraFallbackCandidates = fromAllowed.length - fromAnswers.length;
  const fallbackPoolCap = Math.max(32, fromAnswers.length * 4);
  if (extraFallbackCandidates > 0 && fromAllowed.length <= fallbackPoolCap) {
    return fromAllowed;
  }

  return fromAnswers;
}

export function isAllowedGuess(word: string): boolean {
  return ALLOWED_SET.has(word.toLowerCase());
}

export function isAnswerWord(word: string): boolean {
  return ANSWER_SET.has(word.toLowerCase());
}

export function suggestMoves(
  candidates: readonly string[],
  turnsLeft: number,
  constraints: readonly WordleConstraint[] = []
): SolverResult {
  if (candidates.length === 0) {
    return {
      candidateSuggestions: [],
      explorationSuggestions: [],
      recommended: null,
      mode: "heuristic",
    };
  }

  const candidateSet = new Set(candidates);
  const fallbackMode = candidates.some((word) => !isAnswerWord(word));
  const knownPresentLetters = buildKnownPresentLetterSet(constraints);
  const probeLetterScoreMap = buildProbeLetterScoreMap(candidates, knownPresentLetters);
  const unknownLetterScoreMap = buildUnusedLetterScoreMap(candidates, knownPresentLetters);

  const candidateEvaluated = candidates.map((word) => ({
    word,
    expectedRemaining: expectedRemaining(candidates, word),
    worstBucket: worstBucket(candidates, word),
    inAnswers: isAnswerWord(word),
    inCandidates: true,
    safe: false,
    ...getProbeMetrics(word, probeLetterScoreMap),
  }));

  const exactMode = candidates.length <= 60 && turnsLeft <= 4;
  if (exactMode) {
    const memo = new Map<string, boolean>();
    for (let i = 0; i < candidateEvaluated.length; i += 1) {
      candidateEvaluated[i].safe = isSafeMove(candidates, candidateEvaluated[i].word, turnsLeft, memo);
    }
  }

  candidateEvaluated.sort((a, b) => {
    if (a.safe !== b.safe) {
      return a.safe ? -1 : 1;
    }
    if (a.expectedRemaining !== b.expectedRemaining) {
      return (a.expectedRemaining ?? Number.POSITIVE_INFINITY) - (b.expectedRemaining ?? Number.POSITIVE_INFINITY);
    }
    if (a.worstBucket !== b.worstBucket) {
      return (a.worstBucket ?? Number.POSITIVE_INFINITY) - (b.worstBucket ?? Number.POSITIVE_INFINITY);
    }
    if (!fallbackMode && a.inAnswers !== b.inAnswers) {
      return a.inAnswers ? -1 : 1;
    }
    if (a.probeLetterCount !== b.probeLetterCount) {
      return b.probeLetterCount - a.probeLetterCount;
    }
    if (a.probeLetterScore !== b.probeLetterScore) {
      return b.probeLetterScore - a.probeLetterScore;
    }
    return a.word.localeCompare(b.word);
  });

  const candidateSuggestions = candidateEvaluated.slice(0, CANDIDATE_SUGGESTION_LIMIT);
  const candidateSuggestionSet = new Set(candidateSuggestions.map((item) => item.word));

  const explorationRanked = WORDLE_ALLOWED
    .filter((word) => !candidateSet.has(word) && !candidateSuggestionSet.has(word))
    .map((word) => ({
      word,
      expectedRemaining: null,
      worstBucket: null,
      inAnswers: isAnswerWord(word),
      inCandidates: candidateSet.has(word),
      safe: false,
      ...getProbeMetrics(word, probeLetterScoreMap),
      unknownLetterScore: getUnusedLetterMetrics(word, knownPresentLetters, unknownLetterScoreMap).unusedLetterScore,
    }))
    .sort((a, b) => {
      if (a.probeLetterCount !== b.probeLetterCount) {
        return b.probeLetterCount - a.probeLetterCount;
      }
      if (a.probeLetterScore !== b.probeLetterScore) {
        return b.probeLetterScore - a.probeLetterScore;
      }
      if (a.unknownLetterScore !== b.unknownLetterScore) {
        return b.unknownLetterScore - a.unknownLetterScore;
      }
      return a.word.localeCompare(b.word);
    });

  const explorationSuggestions = explorationRanked
    .filter((item) => item.probeLetterCount > 0)
    .slice(0, EXPLORATION_SUGGESTION_LIMIT);

  const recommended =
    candidateSuggestions.find((item) => item.safe) ??
    candidateSuggestions[0] ??
    null;

  return {
    candidateSuggestions,
    explorationSuggestions,
    recommended,
    mode: exactMode ? "late-exact" : "heuristic",
  };
}
