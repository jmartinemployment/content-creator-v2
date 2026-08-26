import { NextResponse } from "next/server";
import { getAccessTokenWithRefresh } from "@/app/auth/session";
import { apiConfig } from "@/app/auth/config";

/**
 * BFF → GeekAPI v1
 * `api/geek-content-creator/site-analyzer/{id}/section-context?gapTopic=`.
 */
export async function GET(request: Request) {
  const token = await getAccessTokenWithRefresh();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteAnalysisProfileId =
    searchParams.get("siteAnalysisProfileId") ?? searchParams.get("analysisId");
  const gapTopic = searchParams.get("gapTopic");
  if (!siteAnalysisProfileId || !gapTopic) {
    return NextResponse.json(
      { error: "siteAnalysisProfileId and gapTopic required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `${apiConfig.baseUrl}/api/geek-content-creator/site-analyzer/${encodeURIComponent(siteAnalysisProfileId)}/section-context?gapTopic=${encodeURIComponent(gapTopic)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: body.error || body.title || body.detail || "Failed" },
      { status: res.status },
    );
  }
  return NextResponse.json(body);
}
