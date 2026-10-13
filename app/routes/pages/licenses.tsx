import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `Licenses | ${siteConfig.fullName}` },
];

export default function LicensesPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="ライセンス" hideInOs />

      <section className="license-block">
        <h2>ソフトウェア</h2>
        <ul>
          <li>jose — MIT</li>
          <li>lucide-react — ISC</li>
          <li>Feather-derived icons (Lucide) — MIT</li>
          <li>React、React DOM、TanStack Router、TanStack Start — MIT</li>
          <li>cookie、scheduler、set-cookie-parser — MIT</li>
        </ul>
      </section>

      <section className="license-block">
        <h2>フォント</h2>
        <ul>
          <li>DotGothic16 — SIL Open Font License 1.1</li>
        </ul>
      </section>

      <section className="license-block">
        <p>
          <a
            href="/third-party-notices.txt"
            className="btn site-button site-button--ghost"
          >
            ライセンス全文を開く (TXT)
          </a>
        </p>
      </section>
    </PageLayout>
  );
}
