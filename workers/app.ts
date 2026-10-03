import handler from "@tanstack/react-start/server-entry";
import { reviewComment } from "../app/utils/umigame/comment-review.server";
import { reviewPuzzleRevision } from "../app/utils/umigame/puzzle-review.server";
import { getUmigameEnvFromBindings } from "../app/utils/umigame/env.server";
import { withSecurityHeaders } from "./security-headers";



type UmigameQueueMessage =
  | {
      type: "puzzle_review";
      revisionId: string;
    }
  | {
      type: "comment_review";
      commentId: string;
    };

export default {
  async fetch(request, env, ctx) {
    const cspNonce = crypto.randomUUID().replaceAll("-", "");
    const headers = new Headers(request.headers);
    // The nonce is generated here; never trust an incoming value of this header.
    headers.set("X-Website-Nonce", cspNonce);
    const response = await handler.fetch(new Request(request, { headers }), { context: {
      cspNonce,
      nonce: cspNonce,
      cloudflare: { env, ctx },
    } });
    return withSecurityHeaders(request, response, cspNonce);
  },

  async queue(batch: MessageBatch<UmigameQueueMessage>, env) {
    const umigameEnv = getUmigameEnvFromBindings(env);
    for (const message of batch.messages) {
      try {
        if (message.body?.type === "puzzle_review" && message.body.revisionId) {
          await reviewPuzzleRevision(
            umigameEnv,
            message.body.revisionId,
          );
          message.ack();
          continue;
        }

        if (message.body?.type === "comment_review" && message.body.commentId) {
          await reviewComment(
            umigameEnv,
            message.body.commentId,
          );
          message.ack();
          continue;
        }

        message.ack();
      } catch (error) {
        console.error("Umigame queue job failed.", error);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, UmigameQueueMessage>;
