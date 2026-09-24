import type { LoaderFunctionArgs } from "react-router";
import { fetchPcState } from "~/utils/home/control.server";
import { requireHomeControlHost } from "~/utils/home/host";

export async function loader({ context, request }: LoaderFunctionArgs) {
  requireHomeControlHost(request);
  const state = await fetchPcState(context);
  return Response.json(state, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function action() {
  return Response.json(
    { error: { code: "method_not_allowed", message: "Use GET /api/home/status" } },
    { status: 405 }
  );
}
