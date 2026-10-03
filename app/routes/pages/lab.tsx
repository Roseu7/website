import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import { GamesDirectory } from "~/routes/pages/games/index";
import { ToolsDirectory } from "~/routes/pages/tools/index";

export default function LabPage() {
  return <PageLayout contentClassName="page-stack lab-page">
    <PageIntro title="Lab" />
    <section className="lab-section" aria-labelledby="lab-games-title">
      <h2 id="lab-games-title" className="lab-section__title">Games</h2>
      <GamesDirectory headingLevel="h3" />
    </section>
    <section className="lab-section" aria-labelledby="lab-tools-title">
      <h2 id="lab-tools-title" className="lab-section__title">Tools</h2>
      <ToolsDirectory headingLevel="h3" />
    </section>
  </PageLayout>;
}
