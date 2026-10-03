import { createFileRoute } from "@tanstack/react-router";
import LabPage from "~/routes/pages/lab";
import { siteConfig } from "~/utils/site";

export const Route = createFileRoute("/lab")({
  component: LabPage,
  head: () => ({ meta: [{ title: `Lab | ${siteConfig.fullName}` }] }),
});
