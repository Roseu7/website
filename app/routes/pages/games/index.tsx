import { Info } from "lucide-react";
import { Link } from "react-router";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `Games | ${siteConfig.fullName}` },
  { name: "description", content: "Games" },
];

export default function GamesPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Games" />

      <section className="tool-directory">
        <article className="tool-card">
          <div className="tool-card__body">
            <h2 className="tool-card__title">ウミガメのスープ</h2>
            <p className="tool-card__copy">
              JevがGMや判定を担当するウミガメのスープ
            </p>
            <div className="game-card__actions">
              <Link to="/games/umigame" className="btn cta-link" viewTransition>
                <span>遊ぶ</span>
              </Link>
              <Link
                to="/games/umigame/about"
                className="btn site-button site-button--ghost game-card__info"
                aria-label="ウミガメのスープの情報"
                title="情報"
                viewTransition
              >
                <Info size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </article>
      </section>
    </PageLayout>
  );
}
