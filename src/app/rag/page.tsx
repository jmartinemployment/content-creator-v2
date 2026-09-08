import { redirect } from "next/navigation";
import { requireAccessToken } from "@/app/auth/session";

export default async function RagWriterPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; intent?: string; contentType?: string }>;
}) {
  await requireAccessToken();
  const params = await searchParams;
  const migrated = new URLSearchParams();
  for (const key of ["topic", "intent", "contentType"] as const) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) migrated.set(key, value);
  }
  redirect(`/creates/new${migrated.size > 0 ? `?${migrated.toString()}` : ""}`);
}
