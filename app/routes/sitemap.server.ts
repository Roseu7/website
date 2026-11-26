import type { LoaderFunctionArgs } from "~/framework/http";
import { getArticlesEnv, requireArticlesDb } from "~/utils/articles/env.server";
import { listPublicArticles } from "~/utils/articles/store.server";

const SITE = "https://roseu.net";

// 検索エンジンに記事を見つけてもらうための一覧。限定公開の記事は noindex なので載せない（listPublicArticles は公開中だけを返す）。
// 記事一覧のページも載せる。更新日時は、本文を公開した日時（記事一覧は最新の記事の日時）にする。
export async function loader({ context }: LoaderFunctionArgs) {
  const articles = await listPublicArticles(requireArticlesDb(getArticlesEnv(context)), null);
  const latest = Math.max(0, ...articles.map(article => article.contentPublishedAt));
  const entries = [
    { loc: `${SITE}/articles`, lastmod: latest || null },
    ...articles.map(article => ({ loc: `${SITE}/articles/${article.id}`, lastmod: article.contentPublishedAt })),
  ];
  // 記事のIDは英数字だけで、URLにXMLで逃がす文字は入らない。
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(entry => `  <url><loc>${entry.loc}</loc>${entry.lastmod ? `<lastmod>${new Date(entry.lastmod).toISOString()}</lastmod>` : ""}</url>`),
    "</urlset>",
    "",
  ].join("\n");
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
