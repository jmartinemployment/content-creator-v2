import { redirect } from "next/navigation";

/**
 * Legacy product surface. Phase U: `/creates/new` is the only creation UX.
 * Preserve useful query params and send operators to Create.
 */
export default async function LegacyRagRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();

  const pick = (key: string): string | null => {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0].trim();
    }
    return null;
  };

  const topic = pick("topic");
  if (topic) params.set("topic", topic);

  const contentType =
    pick("contentType") ?? pick("writingIntent") ?? pick("intent") ?? pick("type");
  if (contentType) params.set("contentType", contentType);

  const qs = params.toString();
  redirect(qs ? `/creates/new?${qs}` : "/creates/new");
}
