import { ArrowRight, ExternalLink } from "lucide-react";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { listPublishedPuzzleLicenses } from "~/utils/umigame/db.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `ライセンス一覧 | ウミガメのスープ | ${siteConfig.fullName}` },
  {
    name: "description",
    content: "ウミガメのスープで公開している問題の出典・ライセンス・帰属情報。",
  },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const db = requireUmigameDb(getUmigameEnv(context));
  const entries = await listPublishedPuzzleLicenses(db);
  return {
    licensed: entries.filter((entry) => entry.sourceType !== "original"),
  };
}

function attributionText(text: string | null, licenseName: string | null) {
  if (!text) return null;
  let value = text.trim();
  if (licenseName) {
    for (const suffix of [`${licenseName}。`, licenseName]) {
      if (value.endsWith(suffix)) {
        value = value.slice(0, -suffix.length).trim();
        break;
      }
    }
  }
  return value || null;
}

export default function UmigameLicensesPage() {
  const { licensed } = useLoaderData<typeof loader>();

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink
        fallbackTo="/games/umigame"
        fallbackLabel="問題一覧に戻る"
      />

      <section className="umigame-licenses-head umigame-licenses-head--simple">
        <h2>ライセンス一覧</h2>
      </section>

      <section
        className={`umigame-license-section${licensed.length === 0 ? " umigame-license-section--empty" : ""}`}
      >
        {licensed.length === 0 ? (
          <p className="empty-card">外部ライセンスの公開問題はありません。</p>
        ) : (
          <div className="umigame-license-list">
            {licensed.map((entry) => {
              const attribution = attributionText(
                entry.attributionText,
                entry.licenseName,
              );

              return (
                <article key={entry.puzzleId} className="umigame-license-card">
                  <div className="umigame-license-card__head">
                    <Link to={`/games/umigame/p/${entry.displayId}`}>
                      <h3>{entry.title}</h3>
                    </Link>
                    <span className="status-pill">
                      {entry.licenseName ?? "ライセンス情報なし"}
                    </span>
                  </div>

                  {attribution ? <p>{attribution}</p> : null}

                  <div className="umigame-license-card__actions">
                    {entry.sourceUrl ? (
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn site-button site-button--ghost"
                      >
                        原典
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    ) : null}
                    <Link
                      to={`/games/umigame/p/${entry.displayId}`}
                      className="btn site-button site-button--ghost"
                    >
                      この問題を見る
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="umigame-license-note">
        <h2>サイトで使用しているOSSライセンス</h2>
        <p>
          Lucideなど、サイトUIで使用しているライブラリのライセンスは
          <Link to="/licenses"> サイト全体のLicensesページ</Link>
          で確認できます。
        </p>
      </section>
    </PageLayout>
  );
}
