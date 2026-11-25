import type { LoaderFunctionArgs } from "~/framework/http";
import { articleExcerpt } from "~/utils/articles/content";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import { listPublicArticles } from "~/utils/articles/store.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const articles = await listPublicArticles(requireArticlesDb(getArticlesEnv(context)));
  // 一覧には本文を送らない。概要が空なら、本文の最初の段落から抜き出す。
  return {
    articles: articles.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || (article.body ? articleExcerpt(article.body) : ""),
      firstPublishedAt: article.firstPublishedAt,
    })),
  };
}
