import { Link } from "~/framework/navigation";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";
import { PixelIcon } from "~/components/os/PixelIcon";
import { useContext } from "react";
import { OsOpenAppContext } from "~/components/os/OsContext";
import { getOsApp } from "~/utils/os";

export const meta = () => [
    { title: `ゲーム | ${siteConfig.fullName}` },
  { name: "description", content: "Games" },
];

export default function GamesPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="ゲーム" hideInOs />

      <GamesDirectory />
    </PageLayout>
  );
}

export function GamesDirectory({ headingLevel = "h2" }: { headingLevel?: "h2" | "h3" }) {
  const openApp = useContext(OsOpenAppContext);
  const Heading = headingLevel;
  return (
      <section className="os-directory" aria-label="ゲーム一覧">
        <div className="os-directory-row">
          <Link to="/games/umigame" className="os-directory-entry" onClick={event => openApp?.(getOsApp("umigame"), event)}>
            <PixelIcon kind="game" />
            <div className="os-directory-entry__copy">
              <Heading className="tool-card__title">ウミガメのスープ</Heading>
              <p className="tool-card__copy">
                JevがGMや判定を担当するウミガメのスープ
              </p>
            </div>
          </Link>
          <Link to="/games/umigame/about" className="os-directory-info btn site-button" aria-label="ウミガメのスープについて" title="ウミガメのスープについて" onClick={event => openApp?.(getOsApp("umigame"), event)}><PixelIcon kind="info" /></Link>
        </div>
      </section>
  );
}
