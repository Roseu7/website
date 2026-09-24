import { Link } from "react-router";
import { UmigameAvatar, type UmigameAvatarType } from "~/utils/umigame/avatar";

export interface UmigameAuthorInfo {
  id: string;
  username: string;
  displayName: string;
  avatarType: UmigameAvatarType;
  avatarIcon: string | null;
  avatarColor: string | null;
  externalAvatarUrl: string | null;
  deleted?: boolean;
}

export function UmigameAuthor({
  author,
  size = 28,
  linked = true,
}: {
  author: UmigameAuthorInfo;
  size?: number;
  linked?: boolean;
}) {
  if (author.deleted) {
    return (
      <span className="umigame-author-link is-static is-deleted">
        退会済みユーザー
      </span>
    );
  }

  const content = (
    <>
      <UmigameAvatar
        userId={author.id}
        type={author.avatarType}
        icon={author.avatarIcon}
        color={author.avatarColor}
        externalUrl={author.externalAvatarUrl}
        size={size}
      />
      <span>{author.displayName}</span>
    </>
  );

  if (!linked) {
    return <span className="umigame-author-link is-static">{content}</span>;
  }

  return (
    <Link
      to={`/games/umigame/u/${encodeURIComponent(author.username)}`}
      className="umigame-author-link"
    >
      {content}
    </Link>
  );
}
