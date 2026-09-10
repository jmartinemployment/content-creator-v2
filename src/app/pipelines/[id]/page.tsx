import { requireAccessToken } from "@/app/auth/session";
import { PipelineDetail } from "@/app/pipelines/pipeline-detail";

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccessToken();
  const { id } = await params;
  return <PipelineDetail pipelineId={id} />;
}
