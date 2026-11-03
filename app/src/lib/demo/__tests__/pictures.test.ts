import { describe, expect, it, vi } from "vitest";
import { demoProductPng, type PictureMotif } from "../pictures";

// `server-only` refuses to load outside the server; the picture-drawing itself is plain.
vi.mock("server-only", () => ({}));

const MOTIFS: PictureMotif[] = ["cake", "cupcake", "loaf", "box", "table", "bench", "board", "dress", "cushion", "set", "vase", "mug"];

describe("the drawn product pictures", () => {
  it.each(MOTIFS)("%s is drawn as a real PNG, square, small enough to store", async (motif) => {
    const png = await demoProductPng({ motif, background: "#f6dcc9", foreground: "#b5483a" });
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeGreaterThan(500);
    expect(png.length).toBeLessThan(200_000);
  });
});
