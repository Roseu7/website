import { Link, useRouteLoaderData } from "react-router";
import { PageIntro } from "~/components/layout/PageIntro";
import { PageLayout } from "~/components/layout/PageLayout";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `プライバシーポリシー | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "Digital Sandboxで取り扱う情報と、その利用方法について説明します。",
  },
];

export default function PrivacyPage() {
  const rootData = useRouteLoaderData("root") as { legalBaseHref?: string } | undefined;
  const legalBaseHref = rootData?.legalBaseHref ?? "";

  return (
    <PageLayout contentClassName="page-stack legal-document">
      <PageIntro title="プライバシーポリシー" />

      <section className="legal-section">
        <h2>運営者</h2>
        <p>Roseu</p>
        <p>
          個人情報の取り扱いに関する連絡、開示等の相談は
          <Link to={`${legalBaseHref}/contact`}>お問い合わせページ</Link>から受け付けます。
          個人情報取扱事業者の氏名・住所その他法令上必要な事項は、本人からの求めに応じて遅滞なく回答します。
        </p>
      </section>

      <section className="legal-section">
        <h2>取得する情報</h2>
        <ul>
          <li>
            サイトの配信・不正利用防止のためのIPアドレス、ブラウザー情報、アクセス日時、参照元、リクエスト情報。
          </li>
          <li>
            ログインや機能の提供に必要なCloudflare Accessによる認証に伴うメールアドレス、アカウント識別子、表示名、アバター、プロフィール、投稿、コメント、評価、お気に入り、プレイ履歴。
          </li>
          <li>
            Minecraftサーバーへの申請を利用する場合のDiscord識別子、Minecraft ID・UUID、招待コードおよび申請状況。
          </li>
          <li>お問い合わせフォームに入力された返信先メールアドレス、お名前（任意）、お問い合わせ内容。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>利用目的</h2>
        <ul>
          <li>サイト、ゲーム、ツール、ログインおよび申請機能の提供・維持。</li>
          <li>お問い合わせへの返信、受付確認メールの送信、本人確認、問題の調査および必要な連絡。</li>
          <li>不正利用の防止、セキュリティ確保、利用状況の集計およびサービス改善。</li>
          <li>投稿内容の自動確認、表示、モデレーションおよびサービス品質の維持。</li>
        </ul>
      </section>

      <section className="legal-section">
        <h2>外部サービスの利用</h2>
        <p>
          サイトの運営に必要な範囲で、Cloudflare（配信、Workers、データベース、Access）、Discord（ログイン・サーバー所属確認）、Mojang・Minecraft Servicesのプロフィール確認APIを利用します。公式APIでプロフィールを確認できない場合は、AshconまたはPlayerDBへMinecraft IDを問い合わせることがあります。Discordアバターを選択した場合、その画像をDiscord CDNからブラウザーが読み込みます。
        </p>
        <p>
          機能に応じて、ユーザーが入力した質問・回答・投稿・コメント・おすすめ条件などのテキストを、Jevの判定に必要な範囲でVercel AI GatewayまたはTypeSafeへ送信することがあります。アカウント識別子を判定リクエストに付けて送ることは意図していませんが、入力文に個人情報が含まれていれば、その文字列も送信されます。お問い合わせフォームでは、本人確認にCloudflare Turnstile、メール送信にResendを利用します。問い合わせ内容、返信先メールアドレス、送信に必要な情報はResendへ送信されます。
        </p>
        <p>
          これらのサービスは各事業者の環境で情報を処理します。処理地域や保存期間は各事業者の設定・規約に従う場合があります。ユーザーの情報を販売することはありません。
        </p>
      </section>

      <section className="legal-section">
        <h2>Cookieとブラウザー内保存</h2>
        <p>
          ログイン状態、Cloudflare Accessによる保護、ゲームの匿名セッションなど、機能の提供や安全な動作に必要なCookie・識別子を使用することがあります。表示テーマなどの設定はブラウザー内に保存する場合があります。広告配信や広告目的の追跡Cookieは使用していません。
        </p>
      </section>

      <section className="legal-section">
        <h2>問い合わせ内容の保存</h2>
        <p>
          問い合わせ本文はサイトのデータベースには保存せず、回答と対応に必要な範囲でメールとして取り扱います。送信者が入力した返信先メールアドレスには、受付完了と送信内容を記載した確認メールを送信します。配信障害などにより届かない場合があります。Resendは米国内でメール内容と送信ログを扱い、Freeプランではアカウント利用中30日間保持するとしています。送信先メールボックスでは、対応と記録に必要な期間保管します。
        </p>
        <p>
          迷惑送信防止のためTurnstileによる本人確認と短時間の送信回数制限を行います。送信回数制限にはIPアドレス由来のハッシュ値を使い、元のIPアドレスやお問い合わせ本文をサイトのデータベースに保存しません。お問い合わせ本文をLLMによる迷惑判定へ送信しません。
        </p>
      </section>

      <section className="legal-section">
        <h2>保存期間とアカウント削除</h2>
        <p>
          情報は利用目的の達成に必要な期間保管し、不要になった後は削除または個人を識別できない形にします。ウミガメの初回プレイ結果は本人だけが閲覧できます。アカウントを削除すると、ログイン識別子、評価、お気に入り、初回プレイ結果を削除し、プレイセッションの利用者識別子を別のランダムな識別子に置き換えます。投稿した問題とコメントは、他の利用者が参照できるよう「退会済みユーザー」名義で残ります。削除を希望する投稿がある場合は、お問い合わせください。
        </p>
      </section>

      <section className="legal-section">
        <h2>安全管理と第三者提供</h2>
        <p>
          不正アクセスや漏えいを防ぐため、アクセス制御、通信の保護、必要最小限の情報利用に努めます。法令に基づく場合など法令上認められる場合を除き、本人の同意なく個人データを第三者に提供しません。なお、利用目的の達成に必要な範囲で、個人情報の取扱いを外部事業者に委託することがあります。
        </p>
      </section>

      <section className="legal-section">
        <h2>開示・訂正・削除などの相談</h2>
        <p>
          自身の情報について、利用目的の確認、開示、訂正、利用停止、削除などを希望する場合は、本人確認に必要な情報を添えて
          <Link to={`${legalBaseHref}/contact`}>お問い合わせページ</Link>から連絡してください。法令に従って対応します。
        </p>
      </section>

      <section className="legal-section">
        <h2>ポリシーの変更</h2>
        <p>
          法令やサービス内容の変更に応じて本ポリシーを見直し、このページに掲載した時点から適用します。重要な変更はサイト上で案内します。
        </p>
        <p className="legal-date">制定日：2026年9月24日</p>
        <p className="legal-date">最終更新日：2026年9月25日</p>
      </section>
    </PageLayout>
  );
}
