import { requireAccessToken } from "@/app/auth/session";
import { StudioList } from "@/app/studio/studio-list";

export default async function StudioPage() {
  await requireAccessToken();
  return <StudioList />;
}
