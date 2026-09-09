import { requireAccessToken } from "@/app/auth/session";
import { GridList } from "@/app/grid/grid-list";

export default async function GridPage() {
  await requireAccessToken();
  return <GridList />;
}
