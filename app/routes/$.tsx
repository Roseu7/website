import { data, Link } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";

export function loader() {
  return data(null, { status: 404 });
}

export const meta = () => {
  return [
    { title: `404 Not Found | ${siteConfig.fullName}` },
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: `404 Not Found | ${siteConfig.fullName}` },
    { property: "og:type", content: "website" },
  ];
};

export function NotFoundPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <section className="empty-state">
        <div className="empty-state__panel">
          <h1 className="empty-state__title">404 Not Found</h1>
          <p className="empty-state__copy">お探しのページは見つかりませんでした。</p>
          <Link to="/" className="btn site-button" viewTransition>
            トップページに戻る
          </Link>
        </div>
      </section>
    </PageLayout>
  );
}

export default function NotFound() {
  return <NotFoundPage />;
}

export function ErrorBoundary() {
  return <NotFoundPage />;
}
