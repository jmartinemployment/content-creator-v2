import { requireAccessToken } from "@/app/auth/session";
import { RoiCalculator } from "@/app/roi/roi-calculator";

export default async function RoiPage() {
  await requireAccessToken();
  return <RoiCalculator />;
}
