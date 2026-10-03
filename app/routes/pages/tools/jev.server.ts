

import { type LoaderFunctionArgs } from "~/framework/http";

import { isJevAuthenticated } from "~/utils/jev/access.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  return {
    authenticated: await isJevAuthenticated(request, context),
  };
}
