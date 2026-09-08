import { isRouteErrorResponse, useRouteError } from "react-router";
import { NotFoundPage } from "~/routes/$";

export function NotFoundBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  throw error;
}
