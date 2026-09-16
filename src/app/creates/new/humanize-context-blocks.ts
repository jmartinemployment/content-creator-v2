/** Map GeekAPI context preflight block codes to short operator copy. */

export function humanizeContextBlock(code: string): string {
  const attachment = /^run_attachment:([^:]+):(.+)$/.exec(code);
  if (attachment) {
    const [, id, reason] = attachment;
    const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
    switch (reason) {
      case "processing":
      case "not_ready":
        return `Attachment ${shortId} is still processing. Wait until it is ready, or remove it.`;
      case "failed":
        return `Attachment ${shortId} failed to ingest. Remove it and try again.`;
      case "not_finalized":
        return `Attachment ${shortId} upload is not finished yet.`;
      case "not_owned":
        return `Attachment ${shortId} is missing or not owned by this create.`;
      case "expired":
        return `Attachment ${shortId} retention expired. Remove it.`;
      default:
        return `Attachment ${shortId}: ${reason.replaceAll("_", " ")}.`;
    }
  }
  return code;
}

export function humanizeContextBlocks(codes: string[]): string[] {
  return codes.map(humanizeContextBlock);
}

export function isAttachmentPendingBlock(code: string): boolean {
  return /:processing$|:not_ready$|:not_finalized$/.test(code);
}

export function isAttachmentFailedBlock(code: string): boolean {
  return /:failed$/.test(code);
}
