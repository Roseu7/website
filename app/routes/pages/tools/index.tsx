import { Link } from "~/framework/navigation";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { siteConfig } from "~/utils/site";
import { PixelIcon } from "~/components/os/PixelIcon";
import { useContext } from "react";
import { OsOpenAppContext } from "~/components/os/OsContext";
import { getOsApp } from "~/utils/os";

export const meta = () => {
  return [
    { title: `ツール | ${siteConfig.fullName}` },
    { name: "description", content: "利用できるツール一覧" },
  ];
};

export default function ToolsPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="ツール" hideInOs />

      <ToolsDirectory />
    </PageLayout>
  );
}

export function ToolsDirectory({ headingLevel = "h2" }: { headingLevel?: "h2" | "h3" }) {
  const openApp = useContext(OsOpenAppContext);
  const Heading = headingLevel;
  return (
      <section className="os-directory" aria-label="ツール一覧">
        <Link to="/tools/wsolver" className="os-directory-entry" onClick={event => openApp?.(getOsApp("wsolver"), event)}>
          <PixelIcon kind="tools" />
          <div className="os-directory-entry__copy">
            <Heading className="tool-card__title">Wordle Solver</Heading>
            <p className="tool-card__copy">
              Wordleの候補を絞り込み、次の推測候補を提示するツール
            </p>
          </div>
        </Link>

        <Link to="/tools/jev" className="os-directory-entry" onClick={event => openApp?.(getOsApp("jev"), event)}>
          <PixelIcon kind="tools" />
          <div className="os-directory-entry__copy">
            <Heading className="tool-card__title">Jev</Heading>
            <p className="tool-card__copy">状況や選択肢を確率で評価するツール (アクセス制限中)</p>
          </div>
        </Link>
      </section>
  );
}
