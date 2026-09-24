import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, MessageSquare, Send } from "lucide-react";
import { Link } from "react-router";
import { LegalConsentCheckbox } from "~/components/LegalConsentCheckbox";
import { UmigameAuthor } from "~/components/umigame/UmigameAuthor";
import type { PuzzleComment } from "~/utils/umigame/comments.server";
import type { UmigameUser } from "~/utils/umigame/user.server";

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

function formatCommentTime(value: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export function PuzzleComments({
  publicId,
  initialComments,
  viewer,
}: {
  publicId: string;
  initialComments: PuzzleComment[];
  viewer: UmigameUser | null;
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [legalConsentAccepted, setLegalConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/umigame/puzzles/${encodeURIComponent(publicId)}/comments`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { comments?: PuzzleComment[] };
    setComments(Array.isArray(data.comments) ? data.comments : []);
    return data.comments ?? [];
  }, [publicId]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const pollReview = useCallback(
    (attempt = 0) => {
      if (attempt >= 5) return;
      pollTimer.current = setTimeout(() => {
        void refresh()
          .then((nextComments) => {
            if (nextComments.some((comment) => comment.isOwn && comment.status === "pending")) {
              pollReview(attempt + 1);
            }
          })
          .catch(() => {
            pollReview(attempt + 1);
          });
      }, attempt === 0 ? 1200 : 1800);
    },
    [refresh],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = text.trim();
    if (!viewer || !body || submitting) return;
    if (!legalConsentAccepted) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/puzzles/${encodeURIComponent(publicId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body, legalConsent: true }),
        },
      );
      if (!response.ok) throw new Error(await readError(response));

      const data = (await response.json()) as { commentId?: string };
      if (!data.commentId) throw new Error("コメントを保存できませんでした。");

      setComments((current) => [
        {
          id: data.commentId!,
          body,
          status: "pending",
          createdAt: Date.now(),
          reviewedAt: null,
          isOwn: true,
          author: {
            id: viewer.id,
            username: viewer.username,
            displayName: viewer.displayName,
            avatarType: viewer.avatarType,
            avatarIcon: viewer.avatarIcon,
            avatarColor: viewer.avatarColor,
            externalAvatarUrl: viewer.externalAvatarUrl,
            deleted: false,
          },
        },
        ...current,
      ]);
      setText("");
      pollReview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "コメントを投稿できませんでした。");
    } finally {
      setSubmitting(false);
    }
  };

  const reportNotSpoiler = async (commentId: string) => {
    if (!viewer || reported.has(commentId)) return;
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/comments/${encodeURIComponent(commentId)}/report`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await readError(response));
      setReported((current) => new Set(current).add(commentId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "報告を送信できませんでした。");
    }
  };

  return (
    <section className="umigame-comments" id="comments">
      <div className="umigame-comments__head">
        <div>
          <h2>コメント</h2>
          <span>{comments.length}件</span>
        </div>
      </div>

      {viewer ? (
        <form className="umigame-comment-form" onSubmit={handleSubmit}>
          <textarea
            className="umigame-textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="コメントを入力"
            disabled={submitting}
          />
          <LegalConsentCheckbox
            id="umigame-comment-legal-consent"
            checked={legalConsentAccepted}
            onChange={(checked) => {
              setLegalConsentAccepted(checked);
              if (checked) setError(null);
            }}
          />
          <div className="umigame-comment-form__footer">
            <button
              type="submit"
              className="btn site-button"
              disabled={submitting || text.trim().length === 0 || !legalConsentAccepted}
            >
              {submitting ? "投稿中…" : "コメントする"}
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <div className="umigame-comments__login">
          <MessageSquare size={17} aria-hidden="true" />
          <span>コメントするにはログインが必要です。</span>
          <Link
            to={`/auth/access/start?returnTo=${encodeURIComponent(
              `/games/umigame/p/${publicId}`,
            )}`}
            className="btn site-button site-button--ghost"
          >
            ログイン
          </Link>
        </div>
      )}

      {error ? (
        <p className="umigame-error" role="alert">
          {error}
        </p>
      ) : null}

      {comments.length === 0 ? (
        <p className="umigame-comments__empty">まだコメントはありません。</p>
      ) : (
        <ol className="umigame-comment-list">
          {comments.map((comment) => {
            const spoilerHidden =
              comment.status === "spoiler" &&
              !comment.isOwn &&
              !revealed.has(comment.id);
            const isPending = comment.status === "pending";
            const isHiddenReview = comment.status === "hidden_pending_review";

            return (
              <li className="umigame-comment" key={comment.id}>
                <div className="umigame-comment__author">
                  <UmigameAuthor author={comment.author} size={30} />
                  <time dateTime={new Date(comment.createdAt).toISOString()}>
                    {formatCommentTime(comment.createdAt)}
                  </time>
                </div>

                {spoilerHidden ? (
                  <div className="umigame-comment__spoiler">
                    <div>
                      <strong>
                        <AlertTriangle size={17} aria-hidden="true" />
                        真相に近い内容が含まれている可能性があります
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((current) => new Set(current).add(comment.id))
                        }
                      >
                        表示する
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="umigame-comment__body">{comment.body}</p>
                    <div className="umigame-comment__status">
                      {isPending ? <span>Jev審査中</span> : null}
                      {isHiddenReview ? <span>管理確認中</span> : null}
                      {comment.status === "spoiler" && comment.isOwn ? (
                        <span>ネタバレ判定</span>
                      ) : null}
                      {comment.status === "spoiler" && viewer ? (
                        <button
                          type="button"
                          disabled={reported.has(comment.id)}
                          onClick={() => void reportNotSpoiler(comment.id)}
                        >
                          {reported.has(comment.id)
                            ? "報告済み"
                            : "これはネタバレではない"}
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
