import { NextResponse } from "next/server";
import { getAccessTokenWithRefresh } from "@/app/auth/session";
import { apiConfig } from "@/app/auth/config";

/** BFF → GeekAPI v2 `api/geek-content-creator-v2/site-analyzer/profiles/recent`. */
export async function GET(request: Request) {
  const token = await getAccessTokenWithRefresh();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "50";
  const res = await fetch(
    `${apiConfig.baseUrl}/api/geek-content-creator/site-analyzer/profiles/recent?limit=${encodeURIComponent(limit)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          body.error || body.title || body.detail || "Failed to list site_analysis_profiles",
      },
      { status: res.status },
    );
  }

  return NextResponse.json(body);
}
