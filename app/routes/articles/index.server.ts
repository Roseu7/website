import type { LoaderFunctionArgs } from "~/framework/http";
import { MAX_TAG_LENGTH, articleExcerpt, normalizeTag, readingMinutes } from "~/utils/articles/content";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import { listPublicArticles } from "~/utils/articles/store.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  // タグで絞り込む（/articles?tag=…）。タグに使えない長さの値は、絞り込まずに一覧全体を出す。
  const requested = normalizeTag(new URL(request.url).searchParams.get("tag") ?? "");
  const tag = requested && requested.length <= MAX_TAG_LENGTH ? requested : null;
  const articles = await listPublicArticles(requireArticlesDb(getArticlesEnv(context)), tag);
  // 一覧には本文を送らない。概要が空なら、本文の最初の段落から抜き出す。
  return {
    tag,
    articles: articles.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || (article.body ? articleExcerpt(article.body) : ""),
      firstPublishedAt: article.firstPublishedAt,
      contentPublishedAt: article.contentPublishedAt,
      tags: article.tags,
      readingMinutes: readingMinutes(article.charCount),
    })),
  };
}
