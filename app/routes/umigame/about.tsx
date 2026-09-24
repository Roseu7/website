import { ArrowLeft, BrainCircuit, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `Jevを使った実装例 | ウミガメのスープ | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "ウミガメのスープにJevを組み込んだ実装例と、各機能での利用方針を説明します。",
  },
];

const jevUses = [
  "プレイヤーの質問に対するGM判定",
  "最終回答が真相の必須事実を満たしているかの判定",
  "投稿された問題の品質チェック・難易度推定・自動タグ付け",
  "コメントのネタバレ判定とモデレーション",
  "プレイヤー名（表示名）が公開プロフィールとして適切かの判定",
  "自然言語で指定された希望と、公開問題の適合度判定",
];

export default function UmigameAboutPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-about-intro">
        <h2>Jevを使った実装例</h2>
        <p>
          このウミガメのスープでは、Jevを実際のサービスに組み込み、どんな場面で使えるか、
          処理をどう分けると扱いやすいかを試しています。Jevの判定が常に正しいことは前提にせず、
          結果の扱い方も機能ごとに分けています。
        </p>
        <p>
          Jevには文章を書かせるのではなく、問題の状態やユーザー入力をstateとして渡し、それについての型付きの質問を評価させています。
          返ってくるのは自由文ではなく、選択肢・スコア・yes/no系の値と、その分布や確率です。
        </p>
      </section>

      <section className="umigame-about-section">
        <div className="umigame-about-section__title">
          <BrainCircuit size={20} aria-hidden="true" />
          <h2>Jevを利用している機能</h2>
        </div>
        <ul className="umigame-about-use-list umigame-about-use-list--plain">
          {jevUses.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>
      </section>

      <section className="umigame-about-section">
        <h2>このサイトでの扱い方</h2>
        <p>
          ひとつの大きな質問ですべてを決めさせるより、判定したい意味をできるだけ小さく分けています。
          たとえば最終回答では、真相全体に対して一度だけ「正解か」を聞くのではなく、
          必須事実ごとに独立した判定を行い、その結果をゲーム側でまとめています。
        </p>
        <p>
          同じ考え方で、問題投稿の審査、コメント、推薦なども用途ごとの質問として分けています。
          Jevは一度の呼び出しで複数の質問を評価できます。
          独立した判定は、可能なものをまとめて問い合わせています。
        </p>
      </section>

      <section className="umigame-about-section">
        <h2>確率をそのまま正解とは扱わない</h2>
        <p>
          Jevの返す確率やconfidenceは、判断の強さを見るための材料として扱っています。
          高い値だから必ず正しい、低い値だから必ず間違い、という使い方はしていません。
          機能ごとに必要な閾値や、その判定をどうゲームへ反映するかを分けています。
        </p>
        <p>
          また、ユーザーが入力できる文章はJevへの命令ではなく評価対象のデータとして渡します。
          推薦では問題の真相を渡さないなど、その用途に不要な情報もできるだけ入力から外しています。
        </p>
      </section>

      <section className="umigame-about-section">
        <h2>動作を後から確認できるようにする</h2>
        <p>
          Jevを呼び出した用途、provider、model、token使用量、latency、fallbackの有無などは記録しています。
          管理画面では用途別・provider別の実行状況やエラーを確認できるようにしてあり、
          modelや接続方法を変えたときに挙動の差を追える構成を目指しています。
        </p>
      </section>

      <section className="umigame-about-section umigame-about-reference">
        <h2>Jevについてさらに見る</h2>
        <p>
          Jevそのものの詳しい仕様やAPI上での扱い方は、公式のAPIドキュメントや、
          このサイトで接続先として利用している各プロバイダーのドキュメントから確認できます。
        </p>
        <div className="umigame-about-reference__links">
          <a
            href="https://api.typesafe.ai/docs"
            target="_blank"
            rel="noreferrer"
          >
            TypeSafe AI API docs
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <a
            href="https://developers.cloudflare.com/ai/models/typesafe/jev/"
            target="_blank"
            rel="noreferrer"
          >
            Cloudflare Jev docs
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <a
            href="https://vercel.com/docs/ai-gateway/getting-started"
            target="_blank"
            rel="noreferrer"
          >
            Vercel AI Gateway docs
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </section>
    </PageLayout>
  );
}
