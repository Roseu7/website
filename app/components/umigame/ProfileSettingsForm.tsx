import { useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  UmigameAvatar,
  type UmigameAvatarType,
} from "~/utils/umigame/avatar";

interface ProfileSettingsUser {
  id: string;
  displayName: string;
  avatarType: UmigameAvatarType;
  avatarIcon: string | null;
  avatarColor: string | null;
  externalAvatarUrl: string | null;
}

interface ProfileSettingsFormProps {
  user: ProfileSettingsUser;
  returnTo: string;
  compact?: boolean;
}

export function ProfileSettingsForm({
  user,
  returnTo,
  compact = false,
}: ProfileSettingsFormProps) {
  const fetcher = useFetcher<{ error?: string }>();
  const [avatarType, setAvatarType] = useState<UmigameAvatarType>(user.avatarType);
  const [avatarColor, setAvatarColor] = useState(user.avatarColor ?? "slate");
  const [customOptionsOpen, setCustomOptionsOpen] = useState(!compact);
  const showCustomOptions = avatarType === "lucide";
  const saving = fetcher.state !== "idle";

  return (
    <fetcher.Form
      method="post"
      action="/games/umigame/settings/profile"
      className={compact ? "umigame-profile-form is-compact" : "umigame-profile-form"}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="umigame-field">
        <span>表示名</span>
        <input
          className="umigame-input"
          name="displayName"
          defaultValue={user.displayName}
          maxLength={40}
          required
        />
      </label>

      <fieldset className="umigame-fieldset">
        <legend>アバター</legend>
        <div className="umigame-avatar-types">
          {user.externalAvatarUrl ? (
            <label>
              <input
                type="radio"
                name="avatarType"
                value="oauth"
                defaultChecked={user.avatarType === "oauth"}
                onChange={() => setAvatarType("oauth")}
              />
              <span>画像</span>
            </label>
          ) : null}
          <label>
            <input
              type="radio"
              name="avatarType"
              value="generated"
              defaultChecked={user.avatarType === "generated"}
              onChange={() => setAvatarType("generated")}
            />
            <span>自動</span>
          </label>
          <label>
            <input
              type="radio"
              name="avatarType"
              value="lucide"
              defaultChecked={user.avatarType === "lucide"}
              onChange={() => {
                setAvatarType("lucide");
                setCustomOptionsOpen(true);
              }}
            />
            <span>カスタム</span>
          </label>
        </div>
      </fieldset>

      {showCustomOptions ? (
        <>
          {compact ? (
            <button
              type="button"
              className="umigame-profile-form__custom-toggle"
              aria-expanded={customOptionsOpen}
              onClick={() => setCustomOptionsOpen((current) => !current)}
            >
              {customOptionsOpen ? "アイコンと色を閉じる" : "アイコンと色を変更"}
            </button>
          ) : null}
          <div
            className={
              compact && !customOptionsOpen
                ? "umigame-custom-avatar-options is-collapsed"
                : "umigame-custom-avatar-options"
            }
          >
            <fieldset className="umigame-fieldset">
              <legend>アイコン</legend>
              <div className="umigame-avatar-grid">
                {AVATAR_ICONS.map((icon) => (
                  <label className="umigame-avatar-choice" key={icon} title={icon}>
                    <input
                      type="radio"
                      name="avatarIcon"
                      value={icon}
                      defaultChecked={(user.avatarIcon ?? "user") === icon}
                    />
                    <UmigameAvatar
                      userId={user.id}
                      type="lucide"
                      icon={icon}
                      color={avatarColor}
                      size={42}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="umigame-fieldset">
              <legend>色</legend>
              <div className="umigame-color-grid">
                {AVATAR_COLORS.map((color) => (
                  <label className="umigame-color-choice" key={color}>
                    <input
                      type="radio"
                      name="avatarColor"
                      value={color}
                      defaultChecked={(user.avatarColor ?? "slate") === color}
                      onChange={() => setAvatarColor(color)}
                    />
                    <span data-avatar-color={color}>{color}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </>
      ) : (
        <>
          <input
            type="hidden"
            name="avatarIcon"
            value={user.avatarIcon ?? "user"}
          />
          <input
            type="hidden"
            name="avatarColor"
            value={user.avatarColor ?? "slate"}
          />
        </>
      )}

      {fetcher.data?.error ? (
        <p className="umigame-profile-error" role="alert">
          {fetcher.data.error}
        </p>
      ) : null}

      <button type="submit" className="btn site-button" disabled={saving}>
        {saving ? "確認中…" : "保存"}
      </button>
      {compact ? (
        <Link
          to="/games/umigame/settings/profile"
          className="btn site-button site-button--ghost umigame-profile-form__settings-link"
        >
          アカウント設定
        </Link>
      ) : null}
    </fetcher.Form>
  );
}
