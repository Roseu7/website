import { redirect } from "react-router";

export async function loader() {
  throw redirect("/tools/wsolver");
}

export default function WsolverRedirect() {
  return null;
}
