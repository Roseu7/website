import { Form, useActionData, useLoaderData } from "~/framework/navigation";

import { PageLayout } from "~/components/layout/PageLayout";

interface ApplyActionData {
  ok?: boolean;
  message: string;
  applicationId?: number;
}

export const meta = () => [
  { title: "Whitelist Application" },
  { name: "description", content: "Minecraftサーバー参加申請" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function ApplyPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as ApplyActionData | undefined;

  return (
    <PageLayout contentClassName="dashboard-shell dashboard-shell--narrow">
      <header className="apply-heading">
        <h1 className="apply-heading__title">Whitelist Application</h1>
        <p className="apply-heading__lead">
          招待コードを持っている人だけが申請できます。<br />
          Minecraft IDは正確に入力してください。
        </p>
      </header>

      {!data.authenticated ? (
        <section className="apply-panel">
          <p>申請には指定Discordサーバーへの参加とログインが必要です。</p>
          <a className="btn site-button" href={data.loginUrl}>Discordでログイン</a>
        </section>
      ) : !data.guildMember ? (
        <section className="apply-panel apply-panel--error">
          <div className="apply-identity">
            <div>
              <span>Discord</span>
              <strong>
                {data.discordName}
                {data.discordUsername ? (
                  <small className="apply-discord-username">@{data.discordUsername}</small>
                ) : null}
              </strong>
            </div>
            <Form method="post" action="/auth/logout">
              <input type="hidden" name="returnTo" value="/apply" />
              <button className="apply-logout" type="submit">ログアウト</button>
            </Form>
          </div>
          <h2>Discordサーバーへの参加を確認できません</h2>
          <p>対象サーバーへ参加した後、再度このページを開いてください。</p>
        </section>
      ) : (
        <section className="apply-panel">
          <div className="apply-identity">
            <div>
              <span>Discord</span>
              <strong>
                {data.discordName}
                {data.discordUsername ? (
                  <small className="apply-discord-username">@{data.discordUsername}</small>
                ) : null}
              </strong>
            </div>
            <Form method="post" action="/auth/logout">
              <input type="hidden" name="returnTo" value="/apply" />
              <button className="apply-logout" type="submit">ログアウト</button>
            </Form>
          </div>
          <Form method="post" className="dashboard-link-form">
            <label className="dashboard-field">
              <span className="dashboard-field__label apply-field-label">MINECRAFT ID</span>
              <input
                className="dashboard-field__input input"
                name="minecraftName"
                required
                minLength={3}
                maxLength={16}
                pattern="[A-Za-z0-9_]+"
                inputMode="text"
                autoComplete="off"
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field__label apply-field-label">INVITE CODE</span>
              <input
                className="dashboard-field__input input apply-code-input"
                name="inviteCode"
                required
                minLength={6}
                maxLength={6}
                pattern="[A-Za-z0-9]+"
                inputMode="text"
                autoComplete="off"
              />
            </label>
            <button className="btn site-button" type="submit">申請を送信</button>
          </Form>
        </section>
      )}

      {actionData ? (
        <p className={`apply-result ${actionData.ok ? "apply-result--success" : "apply-result--error"}`}>
          {actionData.message}
        </p>
      ) : null}
    </PageLayout>
  );
}
import type { loader, action } from './apply.server';
