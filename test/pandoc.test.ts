import { expect, test } from "bun:test";
import { normalizeTypstAssetPaths } from "../src/handlers/pandoc.ts";

test("normalizeTypstAssetPaths rewrites extracted media paths to the Typst shadow root", () => {
  const shadowFiles = {
    "media/example.png": new Uint8Array([1, 2, 3]),
  };

  const normalized = normalizeTypstAssetPaths(
    [
      '#image("media/example.png")',
      '#image("./media/example.png")',
      '#image("../media/example.png")',
      '#image("../../media/example.png")',
      '#image("/media/example.png")',
      '#image("media/missing.png")',
    ].join("\n"),
    shadowFiles,
  );

  expect(normalized).toContain('#image("/project/media/example.png")');
  expect(normalized).not.toContain('#image("media/example.png")');
  expect(normalized).not.toContain('#image("./media/example.png")');
  expect(normalized).not.toContain('#image("../media/example.png")');
  expect(normalized).not.toContain('#image("../../media/example.png")');
  expect(normalized).toContain('#image("media/missing.png")');
});
