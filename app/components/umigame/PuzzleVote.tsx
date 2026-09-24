import { useState } from "react";
import { ArrowUpDown } from "lucide-react";

type PuzzleVoteValue = -1 | 1;

interface VoteApiResponse {
  voteScore?: number;
  viewerVote?: PuzzleVoteValue | null;
  error?: { message?: string };
}

async function readVoteResponse(response: Response) {
  const data = (await response.json()) as VoteApiResponse;
  if (!response.ok) {
    throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  }
  if (!Number.isFinite(data.voteScore)) {
    throw new Error("評価を更新できませんでした。");
  }
  return data;
}

export function PuzzleVote({
  publicId,
  initialScore,
  initialVote,
  canVote,
}: {
  publicId: string;
  initialScore: number;
  initialVote: PuzzleVoteValue | null;
  canVote: boolean;
}) {  const [score, setScore] = useState(initialScore);
  const [vote, setVote] = useState<PuzzleVoteValue | null>(initialVote);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginTooltip = canVote ? undefined : "この機能はログイン後に使用可能です";

  if (!canVote) {
    return (
      <span className="umigame-vote-summary" aria-label={`評価 ${score}`}>
        <ArrowUpDown aria-hidden="true" />
        <span className="umigame-icon-pair__value">{score}</span>
      </span>
    );
  }

  const submitVote = async (next: PuzzleVoteValue) => {
    if (!canVote || submitting) return;
    const requested = vote === next ? 0 : next;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/umigame/puzzles/${encodeURIComponent(publicId)}/vote`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: requested }),
        },
      );
      const data = await readVoteResponse(response);
      setScore(data.voteScore!);
      setVote(data.viewerVote === 1 || data.viewerVote === -1 ? data.viewerVote : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "評価を更新できませんでした。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="umigame-vote" aria-label="問題の評価">
      <span className="umigame-vote__button-wrap" title={loginTooltip}>
        <button
          type="button"
          className={`btn site-button site-button--ghost site-button--small umigame-vote__button${vote === 1 ? " is-selected" : ""}`}
          aria-label="プラス評価"
          aria-pressed={vote === 1}
          disabled={submitting}
          onClick={() => void submitVote(1)}
        >
          +
        </button>
      </span>
      <span className="umigame-vote__score" aria-label={`評価 ${score}`}>
        {score}
      </span>
      <span className="umigame-vote__button-wrap" title={loginTooltip}>
        <button
          type="button"
          className={`btn site-button site-button--ghost site-button--small umigame-vote__button${vote === -1 ? " is-selected" : ""}`}
          aria-label="マイナス評価"
          aria-pressed={vote === -1}
          disabled={submitting}
          onClick={() => void submitVote(-1)}
        >
          −
        </button>
      </span>
      {error ? (
        <span className="umigame-vote__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
