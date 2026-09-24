import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (url.hostname !== "roseu.net" && url.hostname !== "www.roseu.net" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Response("Not Found", { status: 404 });
  }

  return redirect("/tools/jev", {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
