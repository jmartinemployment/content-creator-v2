import { requireAccessToken } from "@/app/auth/session";
import { GridDetail } from "@/app/grid/grid-detail";

export default async function GridDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccessToken();
  const { id } = await params;
  return <GridDetail gridId={id} />;
}
