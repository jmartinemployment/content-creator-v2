import { requireAccessToken } from "@/app/auth/session";
import { ProjectDetail } from "@/app/projects/project-detail";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccessToken();
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
