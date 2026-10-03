

import { type LoaderFunctionArgs } from "~/framework/http";

import { isUmigameAdmin } from "~/utils/umigame/admin.server";

import { getOptionalUmigameUser, isAccessAuthConfigured } from "~/utils/umigame/auth.server";

import { listPublishedPuzzles } from "~/utils/umigame/db.server";

import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";

const DIFFICULTY_ORDER: Record<string, number> = {
  VERY_EASY: 1,
  EASY: 2,
  MEDIUM: 3,
  HARD: 4,
  VERY_HARD: 5,
};

const SORT_OPTIONS = [
  "newest",
  "rating",
  "plays",
  "difficulty-desc",
  "difficulty-asc",
] as const;

type PuzzleSort = (typeof SORT_OPTIONS)[number];

function isPuzzleSort(value: string): value is PuzzleSort {
  return SORT_OPTIONS.some((option) => option === value);
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const [allPuzzles, user] = await Promise.all([
    listPublishedPuzzles(db),
    getOptionalUmigameUser(request, context),
  ]);
  const admin = user ? await isUmigameAdmin(db, user.id) : false;
  const url = new URL(request.url);
  const availableTags = Array.from(
    new Map(
      allPuzzles.flatMap((puzzle) => puzzle.tags).map((tag) => [tag.id, tag]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const requestedTag = url.searchParams.get("tag")?.trim() ?? "";
  const tag = availableTags.some((option) => option.id === requestedTag)
    ? requestedTag
    : "";
  const requestedDifficulty = url.searchParams.get("difficulty")?.trim() ?? "";
  const difficulty = requestedDifficulty in DIFFICULTY_ORDER
    ? requestedDifficulty
    : "";
  const requestedMinimumVote = url.searchParams.get("minVote")?.trim() ?? "";
  const parsedMinimumVote = Number(requestedMinimumVote);
  const minVote = requestedMinimumVote !== "" && Number.isFinite(parsedMinimumVote)
    ? Math.max(0, Math.trunc(parsedMinimumVote))
    : null;
  const requestedSort = url.searchParams.get("sort")?.trim() ?? "newest";
  const sort: PuzzleSort = isPuzzleSort(requestedSort) ? requestedSort : "newest";
  const filteredPuzzles = allPuzzles.filter((puzzle) =>
    (!tag || puzzle.tags.some((puzzleTag) => puzzleTag.id === tag)) &&
    (!difficulty || puzzle.difficulty === difficulty) &&
    (minVote === null || puzzle.voteScore >= minVote)
  );
  const byNewest = (a: (typeof allPuzzles)[number], b: (typeof allPuzzles)[number]) =>
    b.publicId - a.publicId;
  filteredPuzzles.sort((a, b) => {
    if (sort === "rating") {
      return b.voteScore - a.voteScore || b.playCount - a.playCount || byNewest(a, b);
    }
    if (sort === "plays") {
      return b.playCount - a.playCount || b.voteScore - a.voteScore || byNewest(a, b);
    }
    if (sort === "difficulty-desc") {
      return (DIFFICULTY_ORDER[b.difficulty] ?? 0) - (DIFFICULTY_ORDER[a.difficulty] ?? 0) || byNewest(a, b);
    }
    if (sort === "difficulty-asc") {
      return (DIFFICULTY_ORDER[a.difficulty] ?? 0) - (DIFFICULTY_ORDER[b.difficulty] ?? 0) || byNewest(a, b);
    }
    return byNewest(a, b);
  });
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(filteredPuzzles.length / pageSize));
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const visiblePuzzles = filteredPuzzles.slice((page - 1) * pageSize, page * pageSize);
  return {
    puzzles: visiblePuzzles,
    availableTags,
    filters: { tag, difficulty, minVote, sort },
    filtersActive: Boolean(tag || difficulty || minVote !== null || sort !== "newest"),
    page,
    pageCount,
    user,
    admin,
    authConfigured: isAccessAuthConfigured(env),
    submitted: url.searchParams.get("submitted") === "1",
    edited: url.searchParams.get("edited") === "1",
  };
}
