export function safeRedirect(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value))
    return "/dashboard";
  try {
    const url = new URL(value, "https://mirai.invalid");
    return url.origin === "https://mirai.invalid"
      ? url.pathname + url.search + url.hash
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

// Resume purchase journeys inside the buyer workspace after authentication.
export function workspaceDestination(value: string | null) {
  const target = safeRedirect(value);
  const url = new URL(target, "https://mirai.invalid");
  if (/^\/(sign-in|sign-up|verify-email|forgot-password)(\/|$)/.test(url.pathname))
    return "/dashboard";
  if (/^\/plots(\/|$)/.test(url.pathname))
    url.pathname = url.pathname.replace(/^\/plots/, "/dashboard/explore");
  if (url.pathname === "/co-own") url.pathname = "/dashboard/co-own/start";
  return url.pathname + url.search + url.hash;
}

export function authHref(path: string, destination: string) {
  const target = workspaceDestination(destination);
  return target === "/dashboard" ? path : `${path}?redirect=${encodeURIComponent(target)}`;
}
