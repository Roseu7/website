
import { NotFoundPage } from "../$";
import { HomeControlPage } from "~/components/home/HomeControlPage";
export default HomeControlPage;

import { siteConfig } from "~/utils/site";

export const meta = () => {
  return [
    { title: `Home Control | ${siteConfig.fullName}` },
    { name: "description", content: "自宅PCの状態確認と電源操作を行う管理ページ" },
    { name: "robots", content: "noindex, nofollow" },
  ];
};

export function ErrorBoundary() {
  return <NotFoundPage />;
}
