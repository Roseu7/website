import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ExternalLink,
  Heart,
  Info,
  FileText,
  LogOut,
  ListFilter,
  Play,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import {
  Form,
  Link,
  useLoaderData,
  useSubmit,
  type LoaderFunctionArgs,
} from "react-router";
import { UmigameDialog } from "~/components/umigame/UmigameDialog";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { PageLayout } from "~/components/layout/PageLayout";
import { ProfileSettingsForm } from "~/components/umigame/ProfileSettingsForm";
import { UmigameAuthor } from "~/components/umigame/UmigameAuthor";
import { isUmigameAdmin } from "~/utils/umigame/admin.server";
import { UmigameAvatar } from "~/utils/umigame/avatar";
import { getOptionalUmigameUser, isAccessAuthConfigured } from "~/utils/umigame/auth.server";
import { listPublishedPuzzles } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `ウミガメのスープ | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "JevがGMを担当するウミガメのスープ掲示板",
  },
];

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

export default function UmigameIndexPage() {
  const {
    puzzles,
    availableTags,
    filters,
    filtersActive,
    page,
    pageCount,
    user,
    admin,
    authConfigured,
    submitted,
    edited,
  } = useLoaderData<typeof loader>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedPuzzleId, setExpandedPuzzleId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(filtersActive);
  const submit = useSubmit();
  const minimumVoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterKey = `${filters.tag}:${filters.difficulty}:${filters.minVote ?? ""}:${filters.sort}`;
  const submitFilters = (form: HTMLFormElement | null) => {
    if (!form) return;
    if (minimumVoteTimer.current) {
      clearTimeout(minimumVoteTimer.current);
      minimumVoteTimer.current = null;
    }
    const params = new URLSearchParams();
    for (const [name, rawValue] of new FormData(form)) {
      const value = String(rawValue).trim();
      if (!value || (name === "sort" && value === "newest")) continue;
      params.set(name, value);
    }
    submit(params, {
      method: "get",
      action: "/games/umigame",
      preventScrollReset: true,
    });
  };
  const submitMinimumVote = (form: HTMLFormElement | null) => {
    if (minimumVoteTimer.current) clearTimeout(minimumVoteTimer.current);
    minimumVoteTimer.current = setTimeout(() => submitFilters(form), 450);
  };
  useEffect(() => () => {
    if (minimumVoteTimer.current) clearTimeout(minimumVoteTimer.current);
  }, []);
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.minVote !== null) params.set("minVote", String(filters.minVote));
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    params.set("page", String(targetPage));
    return `/games/umigame?${params.toString()}`;
  };


  return (
    <PageLayout contentClassName="page-stack">
      <section className="umigame-page-head">
        <h2>ウミガメのスープ</h2>

        {authConfigured ? (
          <div className="umigame-page-head__account">
            {user ? (
              <>
                <Link
                  to={`/games/umigame/u/${user.username}`}
                  className="umigame-account-bar__user"
                >
                  <UmigameAvatar
                    userId={user.id}
                    type={user.avatarType}
                    icon={user.avatarIcon}
                    color={user.avatarColor}
                    externalUrl={user.externalAvatarUrl}
                    size={42}
                  />
                  <span>{user.displayName}</span>
                </Link>
                <div className="umigame-account-bar__actions">
                  <Link
                    to="/games/umigame/favorites"
                    className="btn site-button site-button--ghost"
                  >
                    <Heart size={15} aria-hidden="true" />
                    お気に入り
                  </Link>
                  {admin ? (
                    <Link
                      to="/games/umigame/admin"
                      className="btn site-button site-button--ghost"
                    >
                      <ShieldCheck size={15} aria-hidden="true" />
                      管理
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="btn site-button site-button--ghost umigame-icon-button"
                    aria-label="ユーザー設定"
                    title="ユーザー設定"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings size={16} aria-hidden="true" />
                  </button>
                  <form method="post" action="/auth/access/logout">
                    <button
                      type="submit"
                      className="btn site-button site-button--ghost umigame-icon-button"
                      aria-label="ログアウト"
                      title="ログアウト"
                    >
                      <LogOut size={16} aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <Link
                to="/auth/access/start?returnTo=%2Fgames%2Fumigame"
                className="btn site-button site-button--ghost"
              >
                ログイン
              </Link>
            )}
          </div>
        ) : null}
      </section>

      {submitted || edited ? (
        <p className="umigame-submit-notice" role="status">
          {edited
            ? "編集内容を保存しました。Jevの再審査後、問題がなければ再公開されます。"
            : "問題を受け付けました。Jevの審査後、問題がなければ公開されます。"}
        </p>
      ) : null}

      <section className="umigame-index">
        <div className="umigame-section-head umigame-list-head">
          <div className="umigame-list-head__title">
            <h2>公開中の問題</h2>
            <button
              type="button"
              className={`btn site-button site-button--ghost umigame-list-filter-toggle${filtersActive ? " is-active" : ""}`}
              aria-label={filtersActive ? "問題を絞り込む（適用中）" : "問題を絞り込む"}
              aria-expanded={filtersOpen}
              aria-controls="umigame-puzzle-filters"
              title={filtersActive ? "絞り込み条件を表示（適用中）" : "絞り込み条件を表示"}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <ListFilter size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="umigame-list-head__actions">
            <Link
              to="/games/umigame/recommend"
              className="btn site-button site-button--ghost"
            >
              <Sparkles size={15} aria-hidden="true" />
              おすすめ
            </Link>
            <Link
              to="/games/umigame/rankings"
              className="btn site-button site-button--ghost"
            >
              <Trophy size={15} aria-hidden="true" />
              ランキング
            </Link>
            {user ? (
              <Link
                to="/games/umigame/new"
                className="btn site-button umigame-new-puzzle-button"
              >
                <Plus size={15} aria-hidden="true" />
                問題を投稿
              </Link>
            ) : null}
          </div>
        </div>

        <div
          className={`umigame-puzzle-filters-shell${filtersOpen ? " is-open" : ""}`}
          aria-hidden={!filtersOpen}
          inert={!filtersOpen}
        >
          <div className="umigame-puzzle-filters-shell__inner">
            <Form
              key={filterKey}
              id="umigame-puzzle-filters"
              method="get"
              className="umigame-puzzle-filters"
              aria-label="問題を絞り込む"
            >
              <label className="umigame-filter-field">
                <span>タグ</span>
                <select
                  name="tag"
                  defaultValue={filters.tag}
                  onChange={(event) => submitFilters(event.currentTarget.form)}
                >
                  <option value="">すべて</option>
                  {availableTags.map((tagOption) => (
                    <option key={tagOption.id} value={tagOption.id}>{tagOption.name}</option>
                  ))}
                </select>
              </label>
              <label className="umigame-filter-field">
                <span>難易度</span>
                <select
                  name="difficulty"
                  defaultValue={filters.difficulty}
                  onChange={(event) => submitFilters(event.currentTarget.form)}
                >
                  <option value="">すべて</option>
                  <option value="VERY_EASY">★1</option>
                  <option value="EASY">★2</option>
                  <option value="MEDIUM">★3</option>
                  <option value="HARD">★4</option>
                  <option value="VERY_HARD">★5</option>
                </select>
              </label>
              <label className="umigame-filter-field">
                <span>最低評価数</span>
                <input
                  type="number"
                  name="minVote"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={filters.minVote ?? ""}
                  placeholder="指定なし"
                  onChange={(event) => submitMinimumVote(event.currentTarget.form)}
                />
              </label>
              <label className="umigame-filter-field">
                <span>並び替え</span>
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  onChange={(event) => submitFilters(event.currentTarget.form)}
                >
                  <option value="newest">新着順</option>
                  <option value="rating">評価が高い順</option>
                  <option value="plays">プレイ数が多い順</option>
                  <option value="difficulty-desc">難易度が高い順</option>
                  <option value="difficulty-asc">難易度が低い順</option>
                </select>
              </label>
              {filtersActive ? (
                <div className="umigame-puzzle-filters__actions">
                  <Link
                    to="/games/umigame"
                    className="btn site-button site-button--ghost"
                    preventScrollReset
                  >
                    クリア
                  </Link>
                </div>
              ) : null}
            </Form>
          </div>
        </div>

        {puzzles.length === 0 ? (
          <p className="empty-card">
            {filtersActive ? "条件に一致する問題はありません。" : "現在公開中の問題はありません。"}
          </p>
        ) : (
          <div
            className="umigame-list"
            onClick={() => setExpandedPuzzleId(null)}
          >
            {puzzles.map((puzzle) => {
              const expanded = expandedPuzzleId === puzzle.id;
              return (
                <article
                  className={expanded ? "umigame-card is-expanded" : "umigame-card"}
                  key={puzzle.id}
                >
                  <button
                    type="button"
                    className="umigame-card__summary"
                    aria-expanded={expanded}
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedPuzzleId((current) =>
                        current === puzzle.id ? null : puzzle.id,
                      );
                    }}
                  >
                    <div className="umigame-card__top">
                      <h3>{puzzle.title}</h3>
                      <UmigameDifficulty
                        value={puzzle.difficulty}
                        className="umigame-card__difficulty"
                      />
                    </div>
                    <div className="umigame-card__meta">
                      <div className="umigame-card__stats">
                        {puzzle.author ? (
                          <UmigameAuthor author={puzzle.author} size={24} linked={false} />
                        ) : null}
                        <span
                          className="umigame-play-count"
                          aria-label={`プレイ数 ${puzzle.playCount}`}
                        >
                          <Play size={15} aria-hidden="true" />
                          <span className="umigame-icon-pair__value">
                            {puzzle.playCount}
                          </span>
                        </span>
                        <span
                          className="umigame-vote-summary"
                          aria-label={`評価 ${puzzle.voteScore}`}
                        >
                          <ArrowUpDown aria-hidden="true" />
                          <span className="umigame-icon-pair__value">
                            {puzzle.voteScore}
                          </span>
                        </span>
                      </div>
                      <ChevronDown
                        className="umigame-card__chevron"
                        size={16}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  <div className="umigame-card__expand">
                    <div className="umigame-card__expand-inner">
                      <p className="umigame-card__statement">{puzzle.statement}</p>

                      {puzzle.tags.length > 0 ? (
                        <div className="umigame-tag-list" aria-label="タグ">
                          {puzzle.tags.map((tag) => (
                            <span key={tag.id}>{tag.name}</span>
                          ))}
                        </div>
                      ) : null}

                      {puzzle.attributionText ? (
                        <div className="umigame-card__source">
                          <span>{puzzle.attributionText}</span>
                          {puzzle.sourceUrl ? (
                            <a
                              href={puzzle.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              出典
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          ) : null}
                          {puzzle.licenseName === "CC BY-SA 4.0" ? (
                            <a
                              href="https://creativecommons.org/licenses/by-sa/4.0/"
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              CC BY-SA 4.0
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="umigame-card__actions">
                        <Link
                          to={`/games/umigame/p/${puzzle.displayId}`}
                          className="btn site-button site-button--ghost"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <FileText size={15} aria-hidden="true" />
                          詳細を開く
                        </Link>
                        <Link
                          to={`/games/umigame/p/${puzzle.displayId}/play`}
                          className="btn site-button"
                          onClick={(event) => event.stopPropagation()}
                        >
                          この問題を遊ぶ
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="umigame-list-footer">
          <div className="umigame-list-footer__pagination" aria-label="問題一覧ページ">
            {page > 1 ? (
              <Link
                to={pageHref(page - 1)}
                className="btn site-button site-button--ghost"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                前へ
              </Link>
            ) : null}
            {pageCount > 1 ? (
              <span className="umigame-list-footer__page">
                {page} / {pageCount}
              </span>
            ) : null}
            {page < pageCount ? (
              <Link
                to={pageHref(page + 1)}
                className="btn site-button site-button--ghost"
              >
                次へ
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <div className="umigame-list-footer__links">
            <Link
              to="/games/umigame/about"
              className="btn site-button site-button--ghost umigame-icon-button"
              aria-label="Jevの実装例"
              title="Jevの実装例"
            >
              <Info size={18} aria-hidden="true" />
            </Link>
            <Link
              to="/games/umigame/licenses"
              className="btn site-button site-button--ghost umigame-icon-button"
              aria-label="ライセンス"
              title="ライセンス"
            >
              <ScrollText size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {settingsOpen && user ? (
        <UmigameDialog
          className="umigame-modal-backdrop"
          labelledBy="umigame-settings-title"
          dismissOnBackdrop
          onDismiss={() => setSettingsOpen(false)}
        >
          <section
            className="umigame-modal"
          >
            <div className="umigame-modal__head">
              <div className="umigame-profile-head">
                <UmigameAvatar
                  userId={user.id}
                  type={user.avatarType}
                  icon={user.avatarIcon}
                  color={user.avatarColor}
                  externalUrl={user.externalAvatarUrl}
                  size={48}
                />
                <h2 id="umigame-settings-title">プロフィール設定</h2>
              </div>
              <button
                type="button"
                className="umigame-modal__close"
                aria-label="設定を閉じる"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <ProfileSettingsForm
              user={user}
              returnTo="/games/umigame"
              compact
            />
          </section>
        </UmigameDialog>
      ) : null}
    </PageLayout>
  );
}
