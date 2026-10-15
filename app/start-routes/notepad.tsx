import { createFileRoute } from "@tanstack/react-router";
import { PageState } from "~/framework/page";
import NotepadPage from "~/routes/pages/notepad";

export const Route = createFileRoute("/notepad")({
  component: () => <PageState route="/notepad"><NotepadPage /></PageState>,
  head: () => ({ meta: [{ title: "メモ帳 | R OS.3u" }] }),
});
