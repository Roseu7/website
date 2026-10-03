import { useState } from "react";

import { Form, useActionData, useLoaderData } from "~/framework/navigation";

import { PageLayout } from "~/components/layout/PageLayout";

import { ProfileSettingsForm } from "~/components/umigame/ProfileSettingsForm";

import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";

import { UmigameAvatar } from "~/utils/umigame/avatar";

import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `プロフィール設定 | ウミガメのスープ | ${siteConfig.fullName}` },
];

export default function UmigameProfileSettingsPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [deleteConfirmations, setDeleteConfirmations] = useState({
    irreversible: false,
    contentRemains: false,
    separateContact: false,
  });
  const canDelete = Object.values(deleteConfirmations).every(Boolean);

  return (
    <PageLayout contentClassName="page-stack">
      <UmigameBackLink fallbackTo="/games/umigame" fallbackLabel="問題一覧に戻る" />

      <section className="umigame-profile-head">
        <UmigameAvatar
          userId={user.id}
          type={user.avatarType}
          icon={user.avatarIcon}
          color={user.avatarColor}
          externalUrl={user.externalAvatarUrl}
          size={56}
        />
        <h2>プロフィール設定</h2>
      </section>
      <ProfileSettingsForm
        user={user}
        returnTo="/games/umigame/settings/profile"
      />

      <section className="umigame-delete-account">
        <div>
          <h2>アカウントを削除</h2>
          <p>
            ログイン情報、Vote、お気に入り、プレイ履歴との紐付けを削除します。
            投稿した問題とコメントは残り、作者は「退会済みユーザー」と表示されます。
          </p>
        </div>

        <Form
          method="post"
          className="umigame-delete-account__form"
          onSubmit={(event) => {
            if (!window.confirm("ウミガメのアカウントを削除します。元に戻せません。続行しますか？")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete-account" />
          <label className="umigame-delete-account__confirm">
            <input
              type="checkbox"
              name="confirmIrreversible"
              value="yes"
              required
              checked={deleteConfirmations.irreversible}
              onChange={(event) => setDeleteConfirmations((current) => ({
                ...current,
                irreversible: event.target.checked,
              }))}
            />
            <span>アカウントの削除は取り消せないことを確認しました。</span>
          </label>
          <label className="umigame-delete-account__confirm">
            <input
              type="checkbox"
              name="confirmContentRemains"
              value="yes"
              required
              checked={deleteConfirmations.contentRemains}
              onChange={(event) => setDeleteConfirmations((current) => ({
                ...current,
                contentRemains: event.target.checked,
              }))}
            />
            <span>
              投稿した問題とコメントが「退会済みユーザー」名義で残ることを確認しました。
            </span>
          </label>
          <label className="umigame-delete-account__confirm">
            <input
              type="checkbox"
              name="confirmSeparateContact"
              value="yes"
              required
              checked={deleteConfirmations.separateContact}
              onChange={(event) => setDeleteConfirmations((current) => ({
                ...current,
                separateContact: event.target.checked,
              }))}
            />
            <span>
              退会後に投稿した問題やコメントの削除を希望する場合は、別途連絡が必要なことを確認しました。
            </span>
          </label>
          {actionData?.error ? (
            <p className="umigame-error" role="alert">{actionData.error}</p>
          ) : null}
          <button
            type="submit"
            className="btn site-button umigame-delete-account__button"
            disabled={!canDelete}
          >
            アカウントを削除
          </button>
        </Form>
      </section>
    </PageLayout>
  );
}
import type { loader, action } from './settings-profile.server';
