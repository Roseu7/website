import { type LoaderFunctionArgs } from "react-router";
import { NotFoundPage } from "../$";
import { HomeControlPage } from "~/components/home/HomeControlPage";
import { redirectHomeControlSubpathToRoot, requireHomeControlHost } from "~/utils/home/host";
import { siteConfig } from "~/utils/site";

export const meta = () => {
  return [
    { title: `Home Control | ${siteConfig.fullName}` },
    { name: "description", content: "自宅PCの状態確認と電源操作を行う管理ページ" },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  requireHomeControlHost(request);
  redirectHomeControlSubpathToRoot(request);
  return null;
}

export function ErrorBoundary() {
  return <NotFoundPage />;
}

export { HomeControlPage };
export default HomeControlPage;
