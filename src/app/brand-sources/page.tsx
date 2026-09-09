import { requireAccessToken } from "@/app/auth/session";
import { CatalogWorkspace } from "./catalog-workspace";

export default async function BrandSourcesPage() {
  await requireAccessToken();
  return <CatalogWorkspace />;
}
