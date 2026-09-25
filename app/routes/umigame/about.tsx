import { BrainCircuit, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `Jevを使った実装例 | ウミガメのスープ | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "このウミガメのスープでJevを使っている機能と、判定結果の使い方を説明します。",
  },
];

const jevUses = [
  "プレイヤーの質問に対するGM判定",
  "最終回答が真相の必須事実を満たしているかの判定",
  "投稿された問題の品質チェック・難易度推定・自動タグ付け",
  "コメントのネタバレや不適切な内容の判定",
  "プレイヤー名（表示名）が公開プロフィールとして適切かの判定",
  "希望に合う公開問題を探すおすすめ機能",
];

export default function UmigameAboutPage() {
  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-about-intro">
        <h2>Jevを使った実装例</h2>
        <p>このウミガメのスープは、JevをGMの返答や投稿問題の審査に使う実装例です。Jevの判定は誤ることもあるため、結果をどう使うかは機能ごとに決めています。</p>
        <p>問題の内容やプレイヤーの文章をJevに渡し、選択式や真偽を問う質問を評価させています。文章を生成させるのではなく、選択肢や確率を受け取っています。</p>
      </section>

      <section className="umigame-about-section">
        <h2>なぜJevを使うのか</h2>
        <p>このゲームで必要なのは、GMの返答に使う選択肢や、最終回答に必須事実が含まれるかといった判定です。Jevは文章を自由に生成するための対話型モデルではなく、あらかじめ定めた問いに対して選択肢や確率を返すためのモデルです。その形式が、必要な判定を受け取ってゲームのルールに当てはめる作りに合っています。</p>
        <p>小型の対話型LLMでも、同じような仕組みは実現できます。そのうえで、このサイトでは、返答の候補や判定基準を問いとして明示でき、複数の判定を一度に送れる点を重視してJevを選びました。想定した候補以外の返答はGMの答えとして採用せず、エラーとして扱います。応答速度と利用コストも、繰り返し判定が必要なこのゲームで重視した点です。受け取った結果をどう表示し、どの条件で公開や正解とするかは、サイト側のコードで決めています。</p>
      </section>

      <section className="umigame-about-section">
        <h2>GM判定は一問ずつ</h2>
        <ol className="umigame-about-flow">
          <li><strong>入力</strong><span>問題文・真相・必須事実と、今回の質問</span></li>
          <li><strong>Jevの判定</strong><span>5つの返答候補から一つを選び、選んだ候補とその確率を返す</span></li>
          <li><strong>サイトの処理</strong><span>返答が候補に含まれるか確かめ、プレイヤーに表示する</span></li>
        </ol>
        <p>過去の会話を毎回すべて渡して続きを書かせるのではなく、問題の真相に照らして、そのときの質問を一つずつ判定しています。</p>
      </section>

      <section className="umigame-about-section">
        <h2>Jevとコードの役割</h2>
        <p>Jevには文章の意味を読む判定を任せます。文字数の確認、利用回数の制限、ログインや権限の確認、判定を採用する確率の基準、結果の保存などはサイト側のコードで処理します。Jevの判定だけで公開や正解を決めないための分担です。</p>
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
        <h2>GMの返答を五つに分ける</h2>
        <p>プレイヤーの質問には、問題文と真相をもとに「はい」「いいえ」「場合による」「関係ありません」「設定されていません」のいずれかで答えます。「関係ありません」は真相を解くのに不要な事柄、「設定されていません」は答えに関わり得るものの、問題側で決まっていない事柄です。</p>
        <p>「はい」「いいえ」だけに絞ると、真相にない設定まで決めつけてしまいます。質問の内容に応じて、答えを限定できない場合も示すようにしています。</p>
      </section>

      <section className="umigame-about-section">
        <h2>判定をどう組み合わせるか</h2>
        <p>GMの5択と難易度の5段階にはChoice（選択式）を使います。必須事実が含まれるか、コメントがネタバレに当たるかなど、独立して調べたい条件にはBoolean（真偽判定）を使います。このサイトではScore型は使っていません。</p>
        <p>最終回答では、真相全体について一度だけ正誤を聞くのではなく、問題ごとに設定した必須事実が回答に含まれるかを一つずつ調べます。真相と矛盾する記述も別に調べ、各事実の重要度から充足率を計算して正誤を決めています。不正解のときは不足している事実を明かさず、正解度を表示します。</p>
        <p>投稿問題では、問題文と真相の矛盾に加え、後付けの設定だけで答えが成り立っていないか、別の筋の通る答えも同じくらい成り立たないかを調べます。また、難易度やタグ、コメントの判定も目的ごとに質問を分け、一度に送れる質問はまとめてJevへ渡しています。</p>
        <p>一方、おすすめ機能では、候補から一つを選ぶChoiceにはせず、問題ごとに希望との適合をBooleanで独立して判定します。その確率をサイト側で並べ替えています。</p>
      </section>

      <section className="umigame-about-section">
        <h2>制作時に試したこと</h2>
        <p>否定を含む文、言い換えやスラング、複数候補の比較、表示名の判定、GMの返答などを試しました。試した範囲では、文章の意味を読む判定は使いやすい一方で、厳密な文字列の一致や数の計算、候補をまとめた比較では期待どおりにならない例もありました。そのため、このサイトでは意味の判定はJevに尋ね、厳密な処理はコードで行っています。</p>
      </section>

      <section className="umigame-about-section">
        <h2>自由な表示名とコメントのために</h2>
        <p>表示名やコメントを禁止語だけで判定すると、言い換えを見逃したり、普通の名前や問題への批判まで止めたりするおそれがあります。このサイトでは、表示名が公開名として不適切か、コメントに嫌がらせ・脅迫・差別的表現・スパム・ネタバレなどが含まれるかをJevに尋ねています。表示名は不適切さの確率が基準以上なら受け付けず、コメントは項目ごとの確率に応じてネタバレを伏せたり、嫌がらせなどの強い疑いがあるものを確認待ちにしたりします。</p>
        <p>制作時に試した範囲では、不適切な表現を検出できる例が多く、判定基準の指示を具体化すると拾いやすくなる傾向も見られました。ただし、限られたテストでの結果であり、すべてを検出できるわけではありません。自由な言い回しを残しながら、問題のある投稿を見つけやすくするための使い方です。</p>
      </section>

      <section className="umigame-about-section">
        <h2>判定結果と失敗時の扱い</h2>
        <p>Jevの返す確率は判定の材料ですが、高い値でも正しさが保証されるわけではありません。たとえば0.95という値は「95%の回答が正しい」と実証された数値ではありません。投稿問題に大きな矛盾や既存問題との重複の疑いがある場合は、公開前の確認待ちにします。コメントは、ネタバレならネタバレ扱いにし、不適切な内容の疑いが強ければ確認待ちにします。</p>
        <p>Jevには、ユーザーの文章を命令ではなく評価対象として読むよう指定しています。この指定だけで悪意ある入力に完全に耐えられるとは考えておらず、認証や権限の判断にはJevを使いません。</p>
        <p>また、おすすめ機能には問題の真相を渡さず、公開されているタイトルや問題文、難易度などだけを使って候補を評価しています。</p>
        <p>Jevが利用できず判定できなかった場合、サイト側でGMの返答を推測して補いません。プレイ中は一時的なエラーを返します。投稿問題やコメントは、判定が終わるまで公開せず確認前の状態にとどめます。</p>
        <p>Jevによる判定のために外部サービスへ送信する情報については、<Link to="/privacy">プライバシーポリシー</Link>にも記載しています。</p>
      </section>

      <section className="umigame-about-section umigame-about-reference">
        <h2>Jevについてさらに見る</h2>
        <p>Jevの仕様と、このサイトで使う接続先の扱い方は、次の資料で確認できます。</p>
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
