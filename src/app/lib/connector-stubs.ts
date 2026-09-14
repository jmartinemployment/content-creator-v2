/**
 * Stub connector registration is allowed only on local/e2e hosts.
 * Production (phi) must fail closed when OAuth is unavailable — never auto-create stubs.
 */
export function connectorStubsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function stubNotConnectedNotice(kind: "GSC" | "Drive" | "SharePoint", detail: string): string {
  return `Stub (not connected): ${kind} ${detail}. Not a live connection — local/e2e only.`;
}

export function connectorOAuthUnavailableError(kind: "GSC" | "Drive" | "SharePoint"): string {
  return `${kind} OAuth is unavailable. Stub connectors are not allowed in this environment.`;
}
