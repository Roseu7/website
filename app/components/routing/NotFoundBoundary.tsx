import { isNotFound } from "@tanstack/react-router";
import { NotFoundPage } from "~/routes/$";

export function NotFoundBoundary({ error }: { error: Error }) {

  if (isNotFound(error) || ("status" in error && error.status === 404)) {
    return <NotFoundPage />;
  }

  throw error;
}
