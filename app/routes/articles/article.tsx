import { useContext, useEffect } from "react";
import { Link, useLoaderData, useLocation } from "~/framework/navigation";
import { OsWindowTitleContext } from "~/components/os/OsContext";
import { PageLayout } from "~/components/layout/PageLayout";
import { ArticleBody } from "~/components/articles/ArticleBody";
import { ArticleSideToc } from "~/components/articles/ArticleSideToc";
import { ShareButton } from "~/components/articles/ShareButton";
import { ReadingProgress } from "~/components/articles/ReadingProgress";
import { ArticleDates } from "~/components/articles/ArticleDates";
import { siteConfig } from "~/utils/site";
import { articleDate } from "~/utils/articles/date";
import type { loader } from "./article.server";

type ArticleData = Awaited<ReturnType<typeof loader>>;

const articleUrl = (id: string) => `https://roseu.net/articles/${id}`;
// 本文に画像が無い記事のカードには、サイトの画像を出す。
const fallbackImage = { src: "https://roseu.net/images/R%20OS.3u.png", alt: "R OS.3u", width: 1600, height: 900 };

// 共有したときのカード（OGP）と、検索エンジンやAIが読む構造化データ（JSON-LD）も出す。
export const meta = ({ data }: { data?: ArticleData }) => {
  const article = data?.article;
  if (!article) return [{ title: `記事 | ${siteConfig.fullName}` }];
  const title = article.title || "無題";
  const url = articleUrl(article.id);
  const image = article.image ?? fallbackImage;
  const published = new Date(article.firstPublishedAt).toISOString();
  const modified = new Date(article.contentPublishedAt).toISOString();
  return [
    { title: `${title} | ${siteConfig.fullName}` },
    { name: "description", content: article.description },
    { name: "author", content: siteConfig.owner },
    // 限定公開は、URLを知っている人だけが読む記事なので、検索結果に載せない。
    ...(article.status === "unlisted" ? [{ name: "robots", content: "noindex" }] : []),
    { property: "og:type", content: "article" },
    { property: "og:title", content: title },
    { property: "og:description", content: article.description },
    { property: "og:url", content: url },
    { property: "og:site_name", content: siteConfig.name },
    { property: "og:locale", content: "ja_JP" },
    { property: "og:image", content: image.src },
    ...(image.width && image.height ? [{ property: "og:image:width", content: String(image.width) }, { property: "og:image:height", content: String(image.height) }] : []),
    ...(image.alt ? [{ property: "og:image:alt", content: image.alt }] : []),
    { property: "article:published_time", content: published },
    { property: "article:modified_time", content: modified },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:creator", content: "@Roseu_7" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description: article.description,
        url,
        mainEntityOfPage: url,
        image: [image.src],
        datePublished: published,
        dateModified: modified,
        inLanguage: "ja",
        author: { "@type": "Person", name: siteConfig.owner, url: "https://roseu.net/about" },
      },
    },
  ];
};

export const links = ({ data }: { data?: ArticleData }) =>
  data?.article ? [{ rel: "canonical", href: articleUrl(data.article.id) }] : [];

// 目次は、見出しが少ない短い記事では出さない。
const MIN_OUTLINE_ITEMS = 3;

export default function ArticlePage() {
  const { article, adjacent } = useLoaderData<typeof loader>();
  const shareUrl = articleUrl(article.id);
  const title = article.title || "無題";
  const hasOutline = article.outline.length >= MIN_OUTLINE_ITEMS;
  const { pathname } = useLocation();
  const setWindowTitle = useContext(OsWindowTitleContext);
  // R OSのウィンドウのタイトルバーを「記事｜記事のタイトル」にする。
  useEffect(() => {
    setWindowTitle?.({ path: pathname, title });
    return () => setWindowTitle?.(null);
  }, [setWindowTitle, pathname, title]);
  return (
    <PageLayout contentClassName="article-page">
      <p className="article-page__back article-page__back--top"><Link to="/articles">← 記事の一覧へ</Link></p>
      {/* 広い画面では、本文の右に目次を出す（CSSのコンテナクエリで切り替える）。 */}
      <div className={`article-page__layout${hasOutline ? " article-page__layout--toc" : ""}`}>
        <article className="article-page__article">
          <header className="article-page__header">
            <h1 className="article-page__title">{title}</h1>
            <ArticleDates published={article.firstPublishedAt} updated={article.contentPublishedAt} className="article-page__meta" />
          </header>
          {hasOutline && (
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
        {hasOutline && <aside className="article-page__aside"><ArticleSideToc outline={article.outline} /></aside>}
      </div>
      {(adjacent.previous || adjacent.next) && (
        <nav className="article-pager" aria-label="前後の記事">
          {adjacent.previous && (
            <Link to={`/articles/${adjacent.previous.id}`} className="article-pager__item" data-direction="previous">
              <span className="article-pager__label">← 前の記事</span>
              <span className="article-pager__title">{adjacent.previous.title || "無題"}</span>
              <time className="article-pager__date" dateTime={new Date(adjacent.previous.firstPublishedAt).toISOString()}>{articleDate.format(adjacent.previous.firstPublishedAt)}</time>
            </Link>
          )}
          {adjacent.next && (
            <Link to={`/articles/${adjacent.next.id}`} className="article-pager__item" data-direction="next">
              <span className="article-pager__label">次の記事 →</span>
              <span className="article-pager__title">{adjacent.next.title || "無題"}</span>
              <time className="article-pager__date" dateTime={new Date(adjacent.next.firstPublishedAt).toISOString()}>{articleDate.format(adjacent.next.firstPublishedAt)}</time>
            </Link>
          )}
        </nav>
      )}
      <div className="article-page__footer">
        <Link to="/articles">← 記事の一覧へ</Link>
        <ShareButton title={title} url={shareUrl} />
      </div>
      <ReadingProgress targetSelector=".article-page__article" />
    </PageLayout>
  );
}
