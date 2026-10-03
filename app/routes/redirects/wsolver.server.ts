import { redirect } from "~/framework/http";

export async function loader() {
  throw redirect("/tools/wsolver");
}
