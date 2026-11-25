import type { LoaderFunctionArgs } from "~/framework/http";
import { articleExcerpt, articleOutline, isArticleId } from "~/utils/articles/content";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import { renderArticleHtml } from "~/utils/articles/render";
import { getPublicArticle } from "~/utils/articles/store.server";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const id = params.id ?? "";
  // IDの形式は公開記事のURLから誰でも分かるので、形式が不正な値はD1を引かずに返してよい。
  // 下書きと存在しないIDは、同じクエリで「行がない」になり、どちらも同じ404になる。
  const article = isArticleId(id) ? await getPublicArticle(requireArticlesDb(getArticlesEnv(context)), id) : null;
  if (!article) throw new Response("Not Found", { status: 404 });
  // 本文のJSONはブラウザに送らず、サーバーで作ったHTMLと目次だけを渡す。
  return {
    article: {
      id: article.id,
      status: article.status,
      title: article.title,
      description: article.summary || articleExcerpt(article.body),
      firstPublishedAt: article.firstPublishedAt,
      contentPublishedAt: article.contentPublishedAt,
      html: renderArticleHtml(article.body),
      outline: articleOutline(article.body),
    },
  };
}
