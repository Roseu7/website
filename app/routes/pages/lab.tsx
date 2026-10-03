import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { GamesDirectory } from "~/routes/pages/games/index";
import { ToolsDirectory } from "~/routes/pages/tools/index";

export default function LabPage() {
  return <PageLayout contentClassName="page-stack">
    <PageIntro title="Lab" />
    <section className="page-stack" aria-labelledby="lab-games-title">
      <h2 id="lab-games-title" className="content-panel__eyebrow">Games</h2>
      <GamesDirectory headingLevel="h3" />
    </section>
    <section className="page-stack" aria-labelledby="lab-tools-title">
      <h2 id="lab-tools-title" className="content-panel__eyebrow">Tools</h2>
      <ToolsDirectory headingLevel="h3" />
    </section>
  </PageLayout>;
}
