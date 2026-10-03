import { data } from "~/framework/http";

export function loader() {
  return data(null, { status: 404 });
}
