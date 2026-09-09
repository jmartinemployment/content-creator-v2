import { requireAccessToken } from "@/app/auth/session";
import { ProjectList } from "@/app/projects/project-list";

export default async function ProjectsPage() {
  await requireAccessToken();
  return <ProjectList />;
}
