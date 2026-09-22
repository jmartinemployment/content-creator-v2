import { NextRequest } from "next/server";
import { getAccessTokenWithRefresh } from "@/lib/auth/session";
import { apiConfig } from "@/lib/config";

/**
 * Proxy to GeekAPI Content Writer v2 controllers (merged into GeekAPI).
 * Requires the signed-in user's OAuth Bearer. Does not fall back to API key
 * when the user token is rejected — that masked auth failures.
 * Never exposes keys to the browser.
 */

// Generate can now run several independent, fully-generated content types in one call (no more
// cheap repurpose-derivation shortcut for any of them) -- the platform default is not guaranteed
// long enough, and a killed function surfaces as an empty-body 500 with no diagnostic at all.
export const maxDuration = 300;

async function proxy(
  request: NextRequest,
  path: string[],
): Promise<Response> {
  const targetUrl = new URL(`/${path.join("/")}`, apiConfig.baseUrl);
  targetUrl.search = request.nextUrl.search;

  const token = await getAccessTokenWithRefresh();
  if (!token) {
    return Response.json(
      { error: "Unauthorized — sign in required" },
      { status: 401 },
    );
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const bufferedBody = hasBody ? await request.arrayBuffer() : undefined;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: bufferedBody,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (err) {
    // Previously uncaught -- a timeout, a reset connection, or GeekAPI simply not answering threw
    // here and Next.js's own default handling returned a bare, empty 500 with no body at all,
    // indistinguishable from every other kind of failure. This is the one that's actually ours to
    // report accurately. Plain text, not JSON: gccRequest's error path reads the body directly as
    // the error message (response.text(), never parsed), matching every other error body this
    // proxy already passes through unchanged from GeekAPI itself.
    const detail = err instanceof Error ? err.message : String(err);
    return new Response(`Could not reach GeekAPI: ${detail}`, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function handler(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
