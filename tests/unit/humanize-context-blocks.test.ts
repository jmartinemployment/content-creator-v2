import assert from "node:assert/strict";
import test from "node:test";
import {
  humanizeContextBlock,
  isAttachmentFailedBlock,
  isAttachmentPendingBlock,
} from "../../src/app/creates/new/humanize-context-blocks";

test("humanizes distinct attachment block codes without GUID walls", () => {
  assert.match(
    humanizeContextBlock("run_attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:processing"),
    /still processing/i,
  );
  assert.match(
    humanizeContextBlock("run_attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:failed"),
    /failed to ingest/i,
  );
  assert.match(
    humanizeContextBlock("run_attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:not_finalized"),
    /not finished/i,
  );
  assert.match(
    humanizeContextBlock("run_attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:not_ready"),
    /still processing/i,
  );
});

test("classifies pending vs failed attachment blocks", () => {
  assert.equal(isAttachmentPendingBlock("run_attachment:x:processing"), true);
  assert.equal(isAttachmentPendingBlock("run_attachment:x:not_ready"), true);
  assert.equal(isAttachmentFailedBlock("run_attachment:x:failed"), true);
  assert.equal(isAttachmentFailedBlock("run_attachment:x:processing"), false);
});
