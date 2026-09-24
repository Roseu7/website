import { useState } from "react";
import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { PageLayout } from "~/components/layout/PageLayout";
import { ProfileSettingsForm } from "~/components/umigame/ProfileSettingsForm";
import { UmigameBackLink } from "~/components/umigame/UmigameBackLink";
import { UmigameAvatar, type UmigameAvatarType } from "~/utils/umigame/avatar";
import { safeReturnTo } from "~/utils/return-to";
import { requireSameOriginRequest } from "~/utils/request-origin.server";
import { MAX_FORM_BODY_BYTES, readLimitedFormData } from "~/utils/request-body.server";
import {
  logoutUmigame,
  requireUmigameUser,
} from "~/utils/umigame/auth.server";
import { getUmigameEnv, requireUmigameDb } from "~/utils/umigame/env.server";
import { evaluateDisplayName } from "~/utils/umigame/profile-moderation.server";
import { checkDisplayNameRateLimit } from "~/utils/umigame/rate-limit.server";
import {
  deleteUmigameAccount,
  updateUmigameProfile,
} from "~/utils/umigame/user.server";
import { siteConfig } from "~/utils/site";

export const meta = () => [
  { title: `プロフィール設定 | ウミガメのスープ | ${siteConfig.fullName}` },
];

export async function loader({ request, context }: LoaderFunctionArgs) {
  return { user: await requireUmigameUser(request, context) };
}

export async function action({ request, context }: ActionFunctionArgs) {
  requireSameOriginRequest(request);
  const user = await requireUmigameUser(request, context);
  const form = await readLimitedFormData(request, MAX_FORM_BODY_BYTES);
  const intent = String(form.get("intent") ?? "");

  if (intent === "delete-account") {
    const confirmations = [
      "confirmIrreversible",
      "confirmContentRemains",
      "confirmSeparateContact",
    ];
    if (confirmations.some((name) => form.get(name) !== "yes")) {
      return data(
        { error: "退会内容をすべて確認してからチェックを入れてください。" },
        { status: 400 },
      );
    }

    const env = getUmigameEnv(context);
    const db = requireUmigameDb(env);
    await deleteUmigameAccount(db, user.id);
    return logoutUmigame(request, context);
  }

  const displayName = String(form.get("displayName") ?? "").trim();
  if (displayName.length < 1 || displayName.length > 40) {
    return data(
      { error: "表示名は1〜40文字で入力してください。" },
      { status: 400 },
    );
  }
  const env = getUmigameEnv(context);

  if (displayName !== user.displayName) {
    if (!(await checkDisplayNameRateLimit(env, user.id))) {
      return data(
        { error: "表示名の変更回数が多すぎます。少し時間を空けてから試してください。" },
        { status: 429 },
      );
    }

    try {
      const moderation = await evaluateDisplayName(env, user.id, displayName);
      if (!moderation.allowed) {
        return data(
          { error: "この表示名は使用できません。別の名前を入力してください。" },
          { status: 400 },
        );
      }
    } catch (error) {
      console.error("Display-name moderation failed.", error);
      return data(
        { error: "表示名を確認できませんでした。もう一度試してください。" },
        { status: 503 },
      );
    }
  }

  const rawType = String(form.get("avatarType") ?? "lucide");
  const avatarType: UmigameAvatarType =
    rawType === "oauth" || rawType === "generated" ? rawType : "lucide";
  const db = requireUmigameDb(env);
  await updateUmigameProfile(db, user.id, {
    displayName,
    avatarType,
    avatarIcon: form.get("avatarIcon"),
    avatarColor: form.get("avatarColor"),
  });

  const returnTo = safeReturnTo(String(form.get("returnTo") ?? ""));
  return redirect(
    returnTo === "/" ? "/games/umigame/settings/profile" : returnTo,
  );
}

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
