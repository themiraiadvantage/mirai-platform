export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  const base =
    configured || (process.env.NODE_ENV !== "production" ? "http://localhost:4000/api/v1" : "");
  if (!base) throw new ApiError("Sign-in is not configured yet. Please contact support.", 0);
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...options,
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError("We could not reach MIRAI. Check your connection and try again.", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      response.status === 429
        ? "Too many attempts. Please wait a minute and try again."
        : Array.isArray(body?.message)
          ? body.message.join(". ")
          : body?.message;
    throw new ApiError(
      typeof message === "string" ? message : "Something went wrong. Please try again.",
      response.status,
      body,
    );
  }
  return body as T;
}
