import { NextResponse } from "next/server";
import { getAccessTokenWithRefresh } from "@/app/auth/session";

/** Access token JSON for SignalR (browser cannot read the httpOnly cookie). */
export async function GET() {
  const token = await getAccessTokenWithRefresh();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ accessToken: token });
}
