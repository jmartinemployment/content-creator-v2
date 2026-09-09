import { notFound } from "next/navigation";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { TaskAgentWorkspace, type TaskAgentDetail } from "./task-agent-workspace";

export default async function TaskAgentPage({
  params,
}: {
  params: Promise<{ capability: string }>;
}) {
  await requireAccessToken();
  const { capability } = await params;
  const response = await fetchGccV2(`task-agents/${encodeURIComponent(capability)}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error(`Task agent failed to load (HTTP ${response.status}).`);
  return <TaskAgentWorkspace detail={await response.json() as TaskAgentDetail} />;
}
