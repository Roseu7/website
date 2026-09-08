import { Link } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { siteConfig } from "~/utils/site";

export const meta = () => {
  return [
    { title: `Tools | ${siteConfig.fullName}` },
    { name: "description", content: "利用できるツール一覧" },
  ];
};

export default function ToolsPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Tools" />

      <section className="tool-directory">
        <article className="tool-card">
          <div className="tool-card__body">
            <h2 className="tool-card__title">Wordle Solver</h2>
            <p className="tool-card__copy">
              Wordleの候補を絞り込み、次の推測候補を提示するツール
            </p>
            <Link to="/tools/wsolver" className="btn cta-link" viewTransition>
              <span>ツールを開く</span>
            </Link>
          </div>
        </article>
      </section>
    </PageLayout>
  );
}
