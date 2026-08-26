import { NextResponse } from "next/server";
import { getAccessTokenWithRefresh } from "@/app/auth/session";
import { apiConfig } from "@/app/auth/config";

/** BFF → GeekAPI v1 `api/geek-content-creator/site-analyzer/{id}`. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const token = await getAccessTokenWithRefresh();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized — sign in required" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const res = await fetch(
    `${apiConfig.baseUrl}/api/geek-content-creator/site-analyzer/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: body.error || body.title || body.detail || "Status failed" },
      { status: res.status },
    );
  }

  return NextResponse.json(body);
}
