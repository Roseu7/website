import { useState } from "react";
import { Heart } from "lucide-react";

interface FavoriteApiResponse {
  favorite?: boolean;
  error?: { message?: string };
}

export function PuzzleFavorite({
  publicId,
  initialFavorite,
  canFavorite,
}: {
  publicId: string;
  initialFavorite: boolean;
  canFavorite: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginTooltip = canFavorite ? undefined : "この機能はログイン後に使用可能です";

  const toggleFavorite = async () => {
    if (!canFavorite || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/puzzles/${encodeURIComponent(publicId)}/favorite`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite: !favorite }),
        },
      );
      const data = (await response.json()) as FavoriteApiResponse;
      if (!response.ok || typeof data.favorite !== "boolean") {
        throw new Error(data.error?.message ?? "お気に入りを更新できませんでした。");
      }
      setFavorite(data.favorite);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "お気に入りを更新できませんでした。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="umigame-favorite">
      <span title={loginTooltip}>
        <button
          type="button"
          className={`btn site-button site-button--ghost umigame-favorite__button${favorite ? " is-selected" : ""}`}
          aria-pressed={favorite}
          disabled={!canFavorite || submitting}
          onClick={() => void toggleFavorite()}
        >
          <Heart size={15} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
          {favorite ? "お気に入り済み" : "お気に入り"}
        </button>
      </span>
      {error ? <span className="umigame-favorite__error" role="alert">{error}</span> : null}
    </div>
  );
}
