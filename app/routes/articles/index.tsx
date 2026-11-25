import { Link, useLoaderData } from "~/framework/navigation";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { ArticleDates } from "~/components/articles/ArticleDates";
import { siteConfig } from "~/utils/site";
import type { loader } from "./index.server";

export const meta = () => [
  { title: `記事 | ${siteConfig.fullName}` },
  { name: "description", content: "ろせが書いた記事の一覧" },
];

export default function ArticlesPage() {
  const { articles } = useLoaderData<typeof loader>();
  return (
    <PageLayout contentClassName="articles-index">
      <PageIntro title="記事" hideInOs />
      {articles.length === 0
        ? <p className="empty-card">まだ記事はありません。</p>
        : (
          <ol className="articles-list">
            {articles.map(article => (
              <li key={article.id}>
                <Link to={`/articles/${article.id}`} className="articles-list__item">
                  <h2 className="articles-list__title">{article.title || "無題"}</h2>
                  <ArticleDates published={article.firstPublishedAt} updated={article.contentPublishedAt} className="articles-list__dates" />
                  {article.summary && <p className="articles-list__summary">{article.summary}</p>}
                </Link>
              </li>
            ))}
          </ol>
        )}
    </PageLayout>
  );
}
