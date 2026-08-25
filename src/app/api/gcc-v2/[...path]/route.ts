import { NextRequest } from "next/server";
import { getAccessTokenWithRefresh } from "@/app/auth/session";
import { apiConfig } from "@/app/auth/config";

/** BFF → GeekAPI `api/geek-content-creator-v2/*` with GeekOAuth bearer. */
async function proxy(
  request: NextRequest,
  path: string[],
): Promise<Response> {
  const targetUrl = new URL(
    `${apiConfig.baseUrl}/api/geek-content-creator-v2/${path.join("/")}`,
  );
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

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: bufferedBody,
    redirect: "manual",
    cache: "no-store",
  });

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
