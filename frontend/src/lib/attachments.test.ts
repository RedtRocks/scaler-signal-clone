import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  acceptFiles,
  attachmentLabel,
  clampedAspect,
  contentTypeOf,
  fileProblem,
  formatFileSize,
  messageSummary,
  planImageGrid,
  quoteSummary,
} from "./attachments";
import type { Attachment } from "./types";

const att = (file_name: string, content_type: string): Attachment => ({
  id: 1,
  url: "/media/attachments/x",
  file_name,
  content_type,
  size: 10,
  width: null,
  height: null,
});

describe("contentTypeOf", () => {
  it("keeps an allowed browser type", () => expect(contentTypeOf({ name: "a.png", type: "image/png" })).toBe("image/png"));
  it("maps aliases", () =>
    expect(contentTypeOf({ name: "a.zip", type: "application/x-zip-compressed" })).toBe("application/zip"));
  it("falls back to the extension when the browser sends nothing", () =>
    expect(contentTypeOf({ name: "Report.PDF", type: "" })).toBe("application/pdf"));
  it("refuses unknown types", () => {
    expect(contentTypeOf({ name: "a.exe", type: "application/x-msdownload" })).toBeNull();
    expect(contentTypeOf({ name: "a.svg", type: "image/svg+xml" })).toBeNull();
  });
});

describe("fileProblem / acceptFiles", () => {
  const ok = { name: "a.png", size: 100, type: "image/png" };
  it("accepts a normal file", () => expect(fileProblem(ok)).toBeNull());
  it("rejects empty, huge and unsupported files", () => {
    expect(fileProblem({ ...ok, size: 0 })).toContain("empty");
    expect(fileProblem({ ...ok, size: MAX_FILE_BYTES + 1 })).toContain("10 MB");
    expect(fileProblem({ name: "x.exe", size: 5, type: "" })).toContain("supported");
    expect(fileProblem({ ...ok, size: MAX_FILE_BYTES })).toBeNull();
  });
  it("caps one message at ten files", () => {
    const files = Array.from({ length: 12 }, (_, i) => ({ ...ok, name: `${i}.png` }));
    const result = acceptFiles(files, 3);
    expect(result.accepted).toHaveLength(MAX_ATTACHMENTS - 3);
    expect(result.problems).toEqual([`You can attach up to ${MAX_ATTACHMENTS} files to one message.`]);
  });
  it("keeps the good files when some are bad", () => {
    const result = acceptFiles([ok, { name: "x.exe", size: 5, type: "" }], 0);
    expect(result.accepted).toEqual([ok]);
    expect(result.problems).toHaveLength(1);
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [832, "832 B"],
    [2048, "2 KB"],
    [1.4 * 1024 * 1024, "1.4 MB"],
    [10 * 1024 * 1024, "10 MB"],
  ])("%d → %s", (bytes, text) => expect(formatFileSize(bytes)).toBe(text));
});

describe("previews", () => {
  it("labels photos and files like Signal", () => {
    expect(attachmentLabel([])).toBe("");
    expect(attachmentLabel([att("a.png", "image/png")])).toBe("📷 Photo");
    expect(attachmentLabel([att("a.png", "image/png"), att("b.jpg", "image/jpeg")])).toBe("📷 2 photos");
    expect(attachmentLabel([att("Invoice.pdf", "application/pdf")])).toBe("📎 Invoice.pdf");
    expect(attachmentLabel([att("a.png", "image/png"), att("b.pdf", "application/pdf")])).toBe("📎 2 files");
  });
  it("prefers the caption", () => {
    expect(messageSummary({ body: "hi", attachments: [att("a.png", "image/png")] })).toBe("hi");
    expect(messageSummary({ body: "", attachments: [att("a.png", "image/png")] })).toBe("📷 Photo");
    expect(messageSummary({ body: "plain", attachments: [] })).toBe("plain");
  });
  it("describes a quoted attachment", () => {
    expect(quoteSummary({ body: "", attachment: att("a.pdf", "application/pdf") })).toBe("📎 a.pdf");
    expect(quoteSummary({ body: "text", attachment: null })).toBe("text");
  });
});

describe("image layout", () => {
  it("plans the grid", () => {
    expect(planImageGrid(1)).toEqual({ shown: 1, extra: 0, layout: "single" });
    expect(planImageGrid(2).layout).toBe("pair");
    expect(planImageGrid(3).layout).toBe("trio");
    expect(planImageGrid(4)).toEqual({ shown: 4, extra: 0, layout: "quad" });
    expect(planImageGrid(10)).toEqual({ shown: 4, extra: 6, layout: "quad" });
  });
  it("clamps extreme aspect ratios", () => {
    expect(clampedAspect(1000, 100)).toBe(1.9);
    expect(clampedAspect(100, 1000)).toBe(0.75);
    expect(clampedAspect(800, 600)).toBeCloseTo(4 / 3);
    expect(clampedAspect(null, null)).toBeCloseTo(4 / 3);
  });
});
