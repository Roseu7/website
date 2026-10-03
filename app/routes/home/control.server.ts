import { type LoaderFunctionArgs } from "~/framework/http";

import { redirectHomeControlSubpathToRoot, requireHomeControlHost } from "~/utils/home/host";

export async function loader({ request }: LoaderFunctionArgs) {
  requireHomeControlHost(request);
  redirectHomeControlSubpathToRoot(request);
  return null;
}
