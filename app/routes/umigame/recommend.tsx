import {
  data,
  Form,
  Link,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
} from "react-router";
import { ArrowRight, ArrowUpDown, Play, Search } from "lucide-react";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { UmigameAuthor } from "~/components/umigame/UmigameAuthor";
import { UmigameDifficulty } from "~/components/umigame/UmigameDifficulty";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";
import { resolveUmigameActor } from "~/utils/umigame/actor.server";
import { listRecommendationCandidates } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { reserveUmigameDailyQuota } from "~/utils/umigame/quota.server";
import { checkRecommendationRateLimit } from "~/utils/umigame/rate-limit.server";
import { recommendPuzzles } from "~/utils/umigame/recommendation.server";
import { siteConfig } from "~/utils/site";

const MAX_QUERY_LENGTH = 400;

export const meta = () => [
  { title: `おすすめを探す | ウミガメのスープ | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "Jevが自然言語の希望に合うウミガメのスープ問題を探します。",
  },
];
export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const query = String(form.get("query") ?? "").trim();

  if (!query) {
    return data(
      {
        query,
        error: "探したい問題の条件を入力してください。",
        recommendations: [],
        candidateCount: null,
      },
      { status: 400 },
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return data(
      {
        query,
        error: `条件は${MAX_QUERY_LENGTH}文字以内で入力してください。`,
        recommendations: [],
        candidateCount: null,
      },
      { status: 400 },
    );
  }

  const env = getUmigameEnv(context);
  const db = requireUmigameDb(env);
  const actor = await resolveUmigameActor(request, context, true);

  if (!(await checkRecommendationRateLimit(env, request, actor))) {
    return data(
      {
        query,
        error: "おすすめ検索の利用回数が上限に達しました。少し時間を空けてください。",
        recommendations: [],
        candidateCount: null,
      },
      { status: 429 },
    );
  }

  const candidates = await listRecommendationCandidates(db, actor.actorId, 50);
  const headers = actor.setCookie
    ? { "Set-Cookie": actor.setCookie }
    : undefined;

  if (candidates.length === 0) {
    return data(
      {
        query,
        error: null,
        recommendations: [],
        candidateCount: 0,
      },
      { headers },
    );
  }

  const quota = await reserveUmigameDailyQuota(
    env,
    request,
    actor,
    "ai",
    candidates.length,
  );
  if (quota !== "reserved") {
    return data(
      {
        query,
        error: quota === "limited"
          ? "本日分のAI判定枠を使い切りました。明日また利用してください。"
          : "利用枠を確認できませんでした。少し待ってから再試行してください。",
        recommendations: [],
        candidateCount: candidates.length,
      },
      { status: quota === "limited" ? 429 : 503, headers },
    );
  }

  try {
    const recommendations = await recommendPuzzles(env, query, candidates, 10);
    return data(
      {
        query,
        error: null,
        recommendations,
        candidateCount: candidates.length,
      },
      { headers },
    );
  } catch (error) {
    console.error("Umigame recommendation failed.", error);
    return data(
      {
        query,
        error: "Jevでおすすめを判定できませんでした。もう一度試してください。",
        recommendations: [],
        candidateCount: candidates.length,
      },
      { status: 503, headers },
    );
  }
}

export default function UmigameRecommendPage() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const pending = navigation.state === "submitting";

  return (
    <PageLayout contentClassName="page-stack umigame-recommend-page">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-recommend-head">
        <h2>おすすめを探す</h2>
      </section>

      <Form method="post" className="umigame-recommend-form">
        <label className="umigame-field">
          <span>どんな問題を遊びたい？</span>
          <input
            type="text"
            className="umigame-input umigame-recommend-query"
            name="query"
            maxLength={MAX_QUERY_LENGTH}
            defaultValue={result?.query ?? ""}
            placeholder="例: 難しめだけど理不尽じゃなくて、10分くらいで解けそうな問題"
            required
          />
        </label>
        <small className="umigame-recommend-note">
          真相はおすすめに使用されません
        </small>
        <div className="umigame-recommend-form__actions">
          <button type="submit" className="btn site-button" disabled={pending}>
            <Search size={15} aria-hidden="true" />
            {pending ? "探しています..." : "おすすめを探す"}
          </button>
        </div>
      </Form>

      {result?.error ? (
        <p className="umigame-error" role="alert">{result.error}</p>
      ) : null}
      {result && !result.error && result.candidateCount === 0 ? (
        <p className="empty-card">
          未プレイの公開問題はありません。新しい問題が公開されたらここに表示されます。
        </p>
      ) : null}

      {result && !result.error && result.recommendations.length > 0 ? (
        <section className="umigame-recommend-results">
          <div className="umigame-section-head">
            <h2>おすすめ</h2>
          </div>

          <div className="umigame-recommend-list">
            {result.recommendations.map(({ puzzle, probability }) => (
              <article key={puzzle.id} className="umigame-recommend-card">
                <div className="umigame-recommend-card__score">
                  <span>おすすめ率</span>
                  <strong>{Math.round(probability * 100)}%</strong>
                </div>

                <div className="umigame-recommend-card__body">
                  <div className="umigame-recommend-card__head">
                    <Link to={`/games/umigame/p/${puzzle.displayId}`}>
                      <h3>{puzzle.title}</h3>
                    </Link>
                    <UmigameDifficulty value={puzzle.difficulty} />
                  </div>

                  <p>{puzzle.statement}</p>

                  <div className="umigame-recommend-card__meta umigame-card__stats">
                    {puzzle.author ? (
                      <UmigameAuthor author={puzzle.author} size={22} />
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

                  {puzzle.tags.length > 0 ? (
                    <div className="umigame-tag-list">
                      {puzzle.tags.map((tag) => (
                        <span key={tag.id}>{tag.name}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="umigame-recommend-card__actions">
                  <Link
                    to={`/games/umigame/p/${puzzle.displayId}`}
                    className="btn site-button site-button--ghost"
                  >
                    問題詳細
                  </Link>
                  <Link
                    to={`/games/umigame/p/${puzzle.displayId}/play`}
                    className="btn site-button"
                  >
                    この問題を遊ぶ
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </PageLayout>
  );
}
