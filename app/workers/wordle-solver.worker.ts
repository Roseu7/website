import {
  type SolverResult,
  type WordleConstraint,
  filterAnswers,
  suggestMoves,
} from "../utils/wordle";

interface SolveRequestMessage {
  type: "solve";
  id: number;
  constraints: WordleConstraint[];
  turnsLeft: number;
}

interface SolveResponseMessage {
  type: "solve";
  id: number;
  candidateCount: number;
  solver: SolverResult;
}

interface ReadyResponseMessage {
  type: "ready";
}

self.postMessage({ type: "ready" } satisfies ReadyResponseMessage);

self.onmessage = (event: MessageEvent<SolveRequestMessage>) => {
  const message = event.data;
  if (message.type !== "solve") return;

  const candidates = filterAnswers(message.constraints);
  const solver = message.turnsLeft > 0
    ? suggestMoves(candidates, message.turnsLeft)
    : { suggestions: [], recommended: null, mode: "heuristic" as const };

  self.postMessage({
    type: "solve",
    id: message.id,
    candidateCount: candidates.length,
    solver,
  } satisfies SolveResponseMessage);
};
