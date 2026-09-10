import { requireAccessToken } from "@/app/auth/session";
import { PipelineList } from "@/app/pipelines/pipeline-list";

export default async function PipelinesPage() {
  await requireAccessToken();
  return <PipelineList />;
}
