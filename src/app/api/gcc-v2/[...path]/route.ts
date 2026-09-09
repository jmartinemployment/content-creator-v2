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
  const contentType = request.headers.get("content-type");
  const isUploadControlRoute = path.includes("uploads");
  if (hasBody && isUploadControlRoute && !contentType?.toLowerCase().includes("application/json")) {
    return Response.json(
      { error: "File bytes must be uploaded directly to the issued storage URL." },
      { status: 415 },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (hasBody && Number.isFinite(contentLength) && contentLength > 1_048_576) {
    return Response.json(
      { error: "The BFF accepts metadata only; upload file bytes directly to storage." },
      { status: 413 },
    );
  }
  const bufferedBody = hasBody ? await request.arrayBuffer() : undefined;

  const headers = new Headers();
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
