import { Link, useLoaderData } from "~/framework/navigation";
import { PageLayout } from "~/components/layout/PageLayout";
import { ArticleBody } from "~/components/articles/ArticleBody";
import { siteConfig } from "~/utils/site";
import { articleDate } from "~/utils/articles/date";
import type { loader } from "./article.server";

type ArticleData = Awaited<ReturnType<typeof loader>>;

export const meta = ({ data }: { data?: ArticleData }) => {
  const article = data?.article;
  if (!article) return [{ title: `記事 | ${siteConfig.fullName}` }];
  return [
    { title: `${article.title || "無題"} | ${siteConfig.fullName}` },
    { name: "description", content: article.description },
    // 限定公開は、URLを知っている人だけが読む記事なので、検索結果に載せない。
    ...(article.status === "unlisted" ? [{ name: "robots", content: "noindex" }] : []),
  ];
};

// 目次は、見出しが少ない短い記事では出さない。
const MIN_OUTLINE_ITEMS = 3;

export default function ArticlePage() {
  const { article } = useLoaderData<typeof loader>();
  const published = new Date(article.firstPublishedAt);
  const updated = new Date(article.contentPublishedAt);
  const showUpdated = articleDate.format(updated) !== articleDate.format(published);
  return (
    <PageLayout contentClassName="article-page">
      <p className="article-page__back article-page__back--top"><Link to="/articles">← 記事の一覧へ</Link></p>
      <article className="article-page__article">
        <header className="article-page__header">
          <h1 className="article-page__title">{article.title || "無題"}</h1>
          <p className="article-page__meta">
            <span>公開 <time dateTime={published.toISOString()}>{articleDate.format(published)}</time></span>
            {showUpdated && <span>更新 <time dateTime={updated.toISOString()}>{articleDate.format(updated)}</time></span>}
          </p>
        </header>
        {article.outline.length >= MIN_OUTLINE_ITEMS && (
          <nav className="article-toc" aria-label="目次">
            <details open>
              <summary>目次</summary>
              <ol>
                {article.outline.map(item => (
                  <li key={item.id} data-level={item.level}><a href={`#${item.id}`}>{item.text || "（無題の節）"}</a></li>
                ))}
              </ol>
            </details>
          </nav>
        )}
        <ArticleBody html={article.html} />
      </article>
      <p className="article-page__back"><Link to="/articles">記事の一覧へ</Link></p>
    </PageLayout>
  );
}
