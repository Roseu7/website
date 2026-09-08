export function rewriteMapLocation(location: string, requestUrl: URL, origin: string) {
  const publicMapBase = new URL("/map/", requestUrl);

  if (location.startsWith(origin)) {
    const suffix = location.slice(origin.length).replace(/^\/?/, "");
    return new URL(suffix, publicMapBase).toString();
  }

  if (location.startsWith("/")) {
    return new URL(location.replace(/^\//, ""), publicMapBase).toString();
  }

  return new URL(location, publicMapBase).toString();
}
