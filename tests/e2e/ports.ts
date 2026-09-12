function parsePortEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const trimmed = String(raw).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`${name} must be an integer port 1–65535, got ${JSON.stringify(raw)}`);
  }
  const port = Number(trimmed);
  if (port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer port 1–65535, got ${port}`);
  }
  return port;
}

export const appPort = parsePortEnv("E2E_APP_PORT", 3004);
export const platformPort = parsePortEnv("E2E_PLATFORM_PORT", 4310);

const appSet = process.env.E2E_APP_PORT !== undefined && process.env.E2E_APP_PORT !== "";
const platformSet = process.env.E2E_PLATFORM_PORT !== undefined && process.env.E2E_PLATFORM_PORT !== "";
if (appSet !== platformSet) {
  throw new Error("Set both E2E_APP_PORT and E2E_PLATFORM_PORT together, or neither.");
}
