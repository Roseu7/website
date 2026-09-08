import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { shutdownPc } from "~/utils/home/control.server";
import { requireHomeControlHost, requireHomeMutationOrigin } from "~/utils/home/host";

export async function action({ context, request }: ActionFunctionArgs) {
  requireHomeControlHost(request);
  requireHomeMutationOrigin(request);
  const result = await shutdownPc(context);
  return Response.json(result, {
    status: result.ok ? 200 : 502,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function loader(_: LoaderFunctionArgs) {
  return Response.json(
    { error: { code: "method_not_allowed", message: "Use POST /api/home/shutdown" } },
    { status: 405 }
  );
}
