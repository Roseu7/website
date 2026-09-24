import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `Licenses | ${siteConfig.fullName}` },
];

export default function LicensesPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Licenses" />

      <section className="license-block">
        <h2>ソフトウェア</h2>
        <ul>
          <li>isbot — Unlicense</li>
          <li>jose — MIT</li>
          <li>lucide-react — ISC</li>
          <li>Feather-derived icons (Lucide) — MIT</li>
          <li>React、React DOM、React Router — MIT</li>
          <li>cookie、scheduler、set-cookie-parser — MIT</li>
        </ul>
      </section>

      <section className="license-block">
        <h2>フォント</h2>
        <p>
          サイトで配布しているフォントファイルは、次の各ライセンスで提供されています。
        </p>
        <ul>
          <li>Noto Sans JP — SIL Open Font License 1.1</li>
          <li>Poppins — SIL Open Font License 1.1</li>
          <li>Encode Sans SC — SIL Open Font License 1.1</li>
        </ul>
      </section>

      <section className="license-block">
        <h2>ライセンス本文</h2>
        <p>
          各ソフトウェアの著作権表示とライセンス全文、フォントの著作権表示と
          SIL Open Font License全文を掲載しています。
        </p>
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
