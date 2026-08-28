import { NextResponse } from "next/server";
import { getAccessTokenWithRefresh } from "@/app/auth/session";
import { apiConfig } from "@/app/auth/config";

/** BFF → GeekAPI v2 `api/geek-content-creator-v2/site-analyzer/analyze`. */
export async function POST(request: Request) {
  const token = await getAccessTokenWithRefresh();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const res = await fetch(
    `${apiConfig.baseUrl}/api/geek-content-creator-v2/site-analyzer/analyze`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: body.domain,
        seedTopic: body.seedTopic ?? null,
        // Always force a new Geek-SEO run from this UI — never return a cached ready analysis.
        force: true,
      }),
      cache: "no-store",
    },
  );

  const analysis = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: analysis.error || analysis.title || analysis.detail || "Analyze failed" },
      { status: res.status },
    );
  }

  return NextResponse.json(analysis);
}
