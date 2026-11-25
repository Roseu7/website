import { Form, useLoaderData, useNavigation } from "~/framework/navigation";
import { Plus } from "lucide-react";
import { siteConfig } from "~/utils/site";
import type { loader } from "./articles.server";

export const meta = () => [
  { title: `記事の管理 | ${siteConfig.fullName}` },
  { name: "robots", content: "noindex, nofollow" },
];

const STATUS_LABEL = { draft: "下書き", unlisted: "限定公開", published: "公開中" } as const;
const dateFormat = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });

function AdminDate({ label, at }: { label: string; at: number }) {
  return <span>{label} <time dateTime={new Date(at).toISOString()}>{dateFormat.format(at)}</time></span>;
}

export default function ArticlesAdminPage() {
  const { articles } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <main className="article-admin">
      <header className="article-admin__head">
        <h1>記事</h1>
        <Form method="post">
          <button type="submit" className="site-button" disabled={navigation.state === "submitting"}>
            <Plus size={14} aria-hidden />新しい記事
          </button>
        </Form>
      </header>
      {articles.length === 0
        ? <p className="empty-card">まだ記事はありません。</p>
        : (
          <ul className="article-list">
            {articles.map(article => (
              <li key={article.id}>
                <a className="article-list__item" href={`/admin/articles/${article.id}`}>
                  <span className="article-list__title">{article.title || "無題"}</span>
                  <span className="article-list__meta">
                    <span className="article-status" data-status={article.status}>{STATUS_LABEL[article.status]}</span>
                    {article.hasUnpublishedChanges && <span className="article-list__changed">公開版と違う変更あり</span>}
                  </span>
                  <span className="article-list__meta">
                    <AdminDate label="作成" at={article.createdAt} />
                    {article.firstPublishedAt !== null && <AdminDate label="初回公開" at={article.firstPublishedAt} />}
                    <AdminDate label="更新" at={article.updatedAt} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
    </main>
  );
}
