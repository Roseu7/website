import { Link, useLoaderData } from "~/framework/navigation";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { ArticleDates } from "~/components/articles/ArticleDates";
import { siteConfig } from "~/utils/site";
import type { loader } from "./index.server";

type ListData = Awaited<ReturnType<typeof loader>>;

export const meta = ({ data }: { data?: ListData }) => [
  { title: data?.tag ? `タグ「${data.tag}」の記事 | ${siteConfig.fullName}` : `記事 | ${siteConfig.fullName}` },
  { name: "description", content: data?.tag ? `ろせが書いた記事のうち、タグ「${data.tag}」が付いたもの` : "ろせが書いた記事の一覧" },
];

export default function ArticlesPage() {
  const { articles, tag } = useLoaderData<typeof loader>();
  return (
    <PageLayout contentClassName="articles-index">
      <PageIntro title="記事" hideInOs />
      {tag && (
        <div className="articles-filter">
          <h2 className="articles-filter__title">タグ「{tag}」の記事</h2>
          <Link to="/articles">すべての記事</Link>
        </div>
      )}
      {articles.length === 0
        ? <p className="empty-card">{tag ? "このタグの記事はありません。" : "まだ記事はありません。"}</p>
        : (
          <ol className="articles-list">
            {articles.map(article => (
              <li key={article.id}>
                <Link to={`/articles/${article.id}`} className="articles-list__item">
                  <h2 className="articles-list__title">{article.title || "無題"}</h2>
                  <ArticleDates published={article.firstPublishedAt} updated={article.contentPublishedAt} className="articles-list__dates" />
                  {article.summary && <p className="articles-list__summary">{article.summary}</p>}
                  {/* 項目全体が記事へのリンクなので、ここのタグはリンクにしない（記事のページのタグから絞り込める）。 */}
                  {article.tags.length > 0 && <p className="articles-list__tags">{article.tags.map(item => <span key={item}>#{item}</span>)}</p>}
                </Link>
              </li>
            ))}
          </ol>
        )}
    </PageLayout>
  );
}
