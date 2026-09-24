import { Link, useRouteLoaderData } from "react-router";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `利用規約 | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "Digital Sandboxのサイトおよび各サービスの利用条件です。",
  },
];

export default function TermsPage() {
  const rootData = useRouteLoaderData("root") as { legalBaseHref?: string } | undefined;
  const legalBaseHref = rootData?.legalBaseHref ?? "";

  return (
    <PageLayout contentClassName="page-stack legal-document">
      <PageIntro title="利用規約" />

      <section className="legal-section">
        <h2>第1条（適用範囲）</h2>
        <p>
          この利用規約は、Roseuが運営するDigital Sandbox（roseu.net）および同サイトから提供するゲーム、ツール、関連機能の利用に適用されます。利用者は、本規約に同意のうえ、本サービスを利用するものとします。
        </p>
      </section>

      <section className="legal-section">
        <h2>第2条（利用条件）</h2>
        <ul>
          <li>未成年者は、法定代理人の同意を得て利用してください。</li>
          <li>ログイン情報を適切に管理し、第三者に使わせないでください。</li>
          <li>投稿や入力は、自身が利用・共有する権利を持つ内容に限ってください。</li>
          <li>公開問題やコメントなどは、他の利用者に表示される場合があります。秘密情報や公開を望まない情報は入力しないでください。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>第3条（禁止事項）</h2>
        <ul>
          <li>法令または公序良俗に反する行為、第三者の権利やプライバシーを侵害する行為。</li>
          <li>嫌がらせ、脅迫、差別、スパム、なりすまし、虚偽情報の投稿。</li>
          <li>不正アクセス、脆弱性の悪用、過剰なリクエスト、サービス運営を妨げる行為。</li>
          <li>自動判定やレート制限を不正に回避する行為、サービスやデータを無断で収集・再配布する行為。</li>
          <li>運営者が不適切と判断するその他の行為。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>第4条（投稿コンテンツ）</h2>
        <p>
          投稿した問題、コメントその他のコンテンツの権利は、投稿者に留保されます。投稿者は、サービスの運営、表示、配信、モデレーション、形式変換およびバックアップに必要な範囲で、Roseuに対し、無償・非独占で利用する権利を許諾します。この許諾はサービス運営に必要な範囲に限り、投稿者の著作権を移転するものではありません。
        </p>
        <p>
          アカウントを削除した場合、問題とコメントは「退会済みユーザー」名義で残ることがあります。個別の削除を希望する場合は
          <Link to={`${legalBaseHref}/contact`}>お問い合わせ</Link>ください。
        </p>
      </section>

      <section className="legal-section">
        <h2>第5条（自動判定）</h2>
        <p>
          ウミガメのスープ機能では、質問、最終回答、投稿、コメントなどの判定にJevなどのAIサービスを利用することがあります。判定結果は誤る場合があり、常に正確または公平であることを保証しません。投稿内容が公開可能か、または確認を要するかは、必要に応じて運営者が確認します。
        </p>
      </section>

      <section className="legal-section">
        <h2>第6条（サービスの変更・停止）</h2>
        <p>
          保守、障害、セキュリティ対応、外部サービスの状況その他の事情により、機能の変更、一時停止または終了を行うことがあります。継続的な提供や保存を保証するものではありません。
        </p>
      </section>

      <section className="legal-section">
        <h2>第7条（免責と責任）</h2>
        <p>
          サービスは現状有姿で提供されます。運営者は、法令上認められる範囲で、サービスの利用または利用不能によって生じた損害について責任を負いません。ただし、運営者に故意または重大な過失がある場合など、法令上免責が認められない場合はこの限りではありません。
        </p>
      </section>

      <section className="legal-section">
        <h2>第8条（規約の変更）</h2>
        <p>
          本規約を変更する場合、変更内容および効力発生日をこのページその他適切な方法であらかじめ周知します。
        </p>
      </section>

      <section className="legal-section">
        <h2>第9条（準拠法）</h2>
        <p>
          準拠法は日本法とします。サービスに関する紛争は、適用される法令に従って解決します。
        </p>
        <p className="legal-date">制定日：2026年9月24日</p>
      </section>
    </PageLayout>
  );
}
