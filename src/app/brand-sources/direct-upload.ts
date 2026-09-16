import type { DirectUploadGrant, UploadCompletion } from "./context-contract";

type UploadScope =
  | { kind: "knowledge"; assetId?: string | null }
  | { kind: "attachment"; createId: string };

function endpointFor(scope: UploadScope): string {
  return scope.kind === "knowledge"
    ? "/api/gcc-v2/knowledge/uploads"
    : `/api/gcc-v2/creates/${encodeURIComponent(scope.createId)}/attachments/uploads`;
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mediaType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return {
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    html: "text/html",
    htm: "text/html",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }[extension ?? ""] ?? "application/octet-stream";
}

/**
 * Only metadata and finalization use the authenticated Next.js BFF. File bytes are sent to the
 * short-lived object-storage URL returned by GeekAPI.
 */
export async function uploadContextFile(
  file: File,
  scope: UploadScope,
  onProgress?: (state: string) => void,
): Promise<UploadCompletion> {
  onProgress?.("Requesting secure upload…");
  const checksum = await sha256(file);
  const declaredMediaType = mediaType(file);
  const issue = await fetch(endpointFor(scope), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assetId: scope.kind === "knowledge" ? scope.assetId || undefined : undefined,
      fileName: file.name,
      byteSize: file.size,
      mediaType: declaredMediaType,
      sha256: checksum,
    }),
  });
  const grant = (await issue.json().catch(() => null)) as DirectUploadGrant | { error?: string } | null;
  if (!issue.ok || !grant || !("uploadUrl" in grant)) {
    throw new Error(grant && "error" in grant ? grant.error : `Upload request failed (HTTP ${issue.status}).`);
  }
  if (file.size > grant.maxBytes) throw new Error(`File exceeds the ${grant.maxBytes}-byte upload limit.`);

  onProgress?.("Uploading directly to private storage…");
  const uploadHeaders = new Headers(grant.headers ?? grant.requiredHeaders);
  if (!uploadHeaders.has("content-type")) {
    uploadHeaders.set("content-type", declaredMediaType);
  }
  const stored = await fetch(grant.uploadUrl, {
    method: grant.method ?? "PUT",
    headers: uploadHeaders,
    body: file,
  });
  if (!stored.ok) throw new Error(`Direct upload failed (HTTP ${stored.status}).`);

  onProgress?.("Verifying upload…");
  const complete = await fetch(`${endpointFor(scope)}/${encodeURIComponent(grant.uploadId)}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ byteSize: file.size, sha256: checksum }),
  });
  const result = (await complete.json().catch(() => null)) as UploadCompletion | { error?: string } | null;
  if (!complete.ok || !result || !("ingestionJobId" in result)) {
    throw new Error(result && "error" in result ? result.error : `Upload verification failed (HTTP ${complete.status}).`);
  }
  onProgress?.("Queued for ingestion");
  return result;
}
