import { createRequestHandler } from "react-router";
import { reviewComment } from "../app/utils/umigame/comment-review.server";
import { reviewPuzzleRevision } from "../app/utils/umigame/puzzle-review.server";
import { getUmigameEnvFromBindings } from "../app/utils/umigame/env.server";
import { withSecurityHeaders } from "./security-headers";

declare module "react-router" {
  export interface AppLoadContext {
    cspNonce: string;
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);


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
    // 通常のReact Routerリクエスト処理
    const response = await requestHandler(request, {
      cspNonce,
      cloudflare: { env, ctx },
    });
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
