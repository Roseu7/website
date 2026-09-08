import { Form } from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { PageIntro } from "~/components/layout/PageIntro";
import type { McDashboardLoaderData } from "~/utils/mc/dashboard";

interface McDashboardPageProps {
  data: McDashboardLoaderData;
  linkError?: string | null;
}

export function McDashboardPage({ data, linkError }: McDashboardPageProps) {
  const checkedAtText = data.checkedAtLabel;
  const serverOnline = data.serverOnline;

  if (!data.isAuthenticated || !data.discordUser) {
    return (
      <PageLayout contentClassName="page-stack">
        <PageIntro title="Survival Server" />

        <section className="tool-layout">
          <div className="dashboard-shell dashboard-shell--narrow">
            <section className="control-panel dashboard-hero dashboard-hero--login">
              <h3 className="dashboard-hero__title">Discord アカウントでログイン</h3>
              <p className="content-panel__copy">
                ろせサーバー参加者向けのダッシュボードです。<br/>
                ログイン後にサーバー内で /link コマンドを利用して認証すると利用可能です。
              </p>
              <div className="dashboard-actions">
                <a href={data.loginUrl} className="btn site-button">
                  Discord でログイン
                </a>
              </div>
            </section>
          </div>
        </section>
      </PageLayout>
    );
  }

  if (!data.minecraftLink) {
    return (
      <PageLayout contentClassName="page-stack">
        <PageIntro
          title="Survival Server"
          description="ログインは完了しています。ゲーム内で発行したリンクコードを入力して、Minecraftアカウントを紐づけてください。"
        />

        <section className="tool-layout">
          <div className="dashboard-shell dashboard-shell--narrow">
            <section className="control-panel">
              <div className="panel-heading">
                <h2 className="solver-section-title">Link Status</h2>
                <Form method="post" action="/auth/logout">
                  <button type="submit" className="btn site-button site-button--ghost site-button--small">
                    ログアウト
                  </button>
                </Form>
              </div>

              <div className="info-stack">
                <div className="info-row">
                  <span className="info-row__label">Discord</span>
                  <span className="info-row__value">
                    {data.discordUser.globalName ?? data.discordUser.username}
                  </span>
                </div>
                <div className="info-row info-row--copy">
                  <span className="info-row__copy">
                    ゲーム内で /link を実行するとコードが発行されます。ここに入力すると紐づけが完了します。
                  </span>
                </div>
                {data.notice ? (
                  <div className="empty-card dashboard-notice dashboard-notice--success">{data.notice}</div>
                ) : null}
                {linkError ? (
                  <div className="empty-card dashboard-notice dashboard-notice--error">{linkError}</div>
                ) : null}
              </div>

              <Form method="post" className="dashboard-link-form">
                <input type="hidden" name="intent" value="link-code" />
                <label className="dashboard-field">
                  <span className="dashboard-field__label">リンクコード</span>
                  <input
                    type="text"
                    name="code"
                    className="input dashboard-field__input"
                    placeholder="例: A1B2C3"
                    autoComplete="one-time-code"
                    inputMode="text"
                    spellCheck={false}
                    maxLength={32}
                  />
                </label>
                <button type="submit" className="btn site-button">
                  コードを送信
                </button>
              </Form>
            </section>
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout contentClassName="page-stack">
      <PageIntro title="Survival Server" />

      <section className="tool-layout">
        <div className="dashboard-shell">
          <div className="dashboard-grid dashboard-grid--primary">
            <section className="control-panel">
              <div className="panel-heading">
                <h2 className="solver-section-title">Server Status</h2>
                <span className={`badge status-pill dashboard-status-pill ${serverOnline ? "status-pill--online" : "status-pill--offline"}`}>
                  {serverOnline ? "Online" : "Offline"}
                </span>
              </div>

              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-card__label">参加人数</div>
                  <div className="metric-card__value dashboard-metric-value">
                    <span>{data.serverState?.playerCount ?? 0}</span>
                    <span className="dashboard-metric-separator">/</span>
                    <span className="dashboard-metric-subtle">{data.serverState?.maxPlayers ?? 0}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-card__label">最終更新</div>
                  <div className="metric-card__value metric-card__value--small">{checkedAtText}</div>
                </div>
              </div>
            </section>

            <section className="control-panel dashboard-players-panel">
              <div className="panel-heading dashboard-players-panel__heading">
                <h2 className="solver-section-title">Players</h2>
                <span className="solver-meta">
                  {data.serverState?.players.length ?? 0} players
                </span>
              </div>

              {data.serverState && data.serverState.players.length > 0 ? (
                <div className="dashboard-player-grid">
                  {data.serverState.players.map((player, index) => (
                    <div key={player.uuid} className="dashboard-player-card">
                      <span className="dashboard-player-card__rank">
                        {(index + 1).toString().padStart(2, "0")}
                      </span>
                      <span className="dashboard-player-card__name">
                        {player.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-card">現在オンラインのプレイヤーはいません。</div>
              )}
            </section>
          </div>

          <div className="dashboard-grid dashboard-grid--secondary">
            <section className="control-panel dashboard-map-panel">
              <div className="dashboard-hero__copy">
                <h2 className="dashboard-map-panel__title">Server Map</h2>
                <p className="content-panel__copy">
                  平面マップを別タブで開きます。<br />
                  サーバーがオンラインのときのみ利用可能です。
                </p>
              </div>

              <div className="dashboard-actions">
                {serverOnline ? (
                  <a href="/map/" className="btn site-button" target="_blank" rel="noopener noreferrer">
                    Server Map を開く
                  </a>
                ) : (
                  <button type="button" className="btn site-button" disabled>
                    Server Map を開く
                  </button>
                )}
              </div>
            </section>

            <section className="control-panel dashboard-hero dashboard-linked-panel">
              <div className="panel-heading">
                <div className="dashboard-hero__copy">
                  <h2 className="dashboard-hero__title">
                    {data.minecraftLink.minecraftName}
                  </h2>
                  <p className="content-panel__copy">
                    Discord は {data.discordUser.globalName ?? data.discordUser.username} として連携済みです。
                  </p>
                </div>
                <Form method="post" action="/auth/logout">
                  <button type="submit" className="btn site-button site-button--ghost site-button--small">
                    ログアウト
                  </button>
                </Form>
              </div>

              {data.notice ? (
                <div className="empty-card dashboard-notice dashboard-notice--success">{data.notice}</div>
              ) : null}
            </section>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
