/**
 * Shared load contract for secondary list/status clients.
 * Distinguishes legitimate empty (`ok` + []) from transport/server failure.
 */
export type LoadResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: string; httpStatus?: number }
  | { status: "unauthorized" };

export function loadOk<T>(data: T): LoadResult<T> {
  return { status: "ok", data };
}

export function loadError(error: string, httpStatus?: number): LoadResult<never> {
  return { status: "error", error, httpStatus };
}

export function loadUnauthorized(): LoadResult<never> {
  return { status: "unauthorized" };
}

export async function readLoadResult<T>(
  res: Response,
  parse: (body: unknown) => T,
  options?: { unauthorizedStatuses?: number[] },
): Promise<LoadResult<T>> {
  const unauthorized = options?.unauthorizedStatuses ?? [401];
  if (unauthorized.includes(res.status)) return loadUnauthorized();
  if (!res.ok) {
    let error = `Request failed (HTTP ${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) error = payload.error;
    } catch {
      /* ignore parse errors — keep status text */
    }
    return loadError(error, res.status);
  }
  try {
    const body = await res.json();
    return loadOk(parse(body));
  } catch (cause) {
    return loadError(cause instanceof Error ? cause.message : "Response parse failed", res.status);
  }
}
