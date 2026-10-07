import { describe, expect, it } from "vitest";
import { isImageId, looksLikeImage, pathFor } from "../index";

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("looksLikeImage", () => {
  it("knows a JPEG and a PNG by their first bytes", () => {
    expect(looksLikeImage(jpeg, "image/jpeg")).toBe(true);
    expect(looksLikeImage(png, "image/png")).toBe(true);
  });

  it("refuses bytes that are not the type they claim, and types we don't keep", () => {
    expect(looksLikeImage(png, "image/jpeg")).toBe(false);
    expect(looksLikeImage(jpeg, "image/png")).toBe(false);
    expect(looksLikeImage(new TextEncoder().encode("<svg></svg>"), "image/jpeg")).toBe(false);
    expect(looksLikeImage(jpeg, "image/gif")).toBe(false);
    expect(looksLikeImage(new Uint8Array(), "image/jpeg")).toBe(false);
    expect(looksLikeImage(Uint8Array.from([0xff, 0xd8, 0xff]), "image/jpeg")).toBe(false);
  });
});

describe("where a picture's files are", () => {
  it("is <business>/<picture>/<size>, the shape the bucket's rules expect", () => {
    const org = "11111111-1111-4111-8111-111111111111";
    const id = "22222222-2222-4222-8222-222222222222";
    expect(pathFor(org, id, "thumb")).toBe(`${org}/${id}/thumb`);
    expect(pathFor(org, id, "display")).toBe(`${org}/${id}/display`);
  });

  it("only treats real ids as ids", () => {
    expect(isImageId("22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(isImageId("../etc/passwd")).toBe(false);
    expect(isImageId(undefined)).toBe(false);
  });
});
