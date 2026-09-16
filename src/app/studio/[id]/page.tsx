import { requireAccessToken } from "@/app/auth/session";
import { StudioEditor } from "@/app/studio/studio-editor";

export default async function StudioDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccessToken();
  const { id } = await params;
  return <StudioEditor draftId={id} />;
}
