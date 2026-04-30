import { describe, expect, test } from "bun:test";
import { formatQuantity, scaleQuantity } from "./quantity";

describe("formatQuantity", () => {
  test("null returns empty string", () => {
    expect(formatQuantity(null)).toBe("");
  });

  test("undefined returns empty string", () => {
    expect(formatQuantity(undefined)).toBe("");
  });

  test("integers", () => {
    expect(formatQuantity(1)).toBe("1");
    expect(formatQuantity(2)).toBe("2");
    expect(formatQuantity(10)).toBe("10");
    expect(formatQuantity(0)).toBe("0");
  });

  test("1/2 fraction", () => {
    expect(formatQuantity(0.5)).toBe("½");
    expect(formatQuantity(1.5)).toBe("1 ½");
    expect(formatQuantity(2.5)).toBe("2 ½");
  });

  test("1/3 fraction", () => {
    expect(formatQuantity(1 / 3)).toBe("⅓");
    expect(formatQuantity(1 + 1 / 3)).toBe("1 ⅓");
  });

  test("2/3 fraction", () => {
    expect(formatQuantity(2 / 3)).toBe("⅔");
    expect(formatQuantity(1 + 2 / 3)).toBe("1 ⅔");
  });

  test("1/4 fraction", () => {
    expect(formatQuantity(0.25)).toBe("¼");
    expect(formatQuantity(1.25)).toBe("1 ¼");
  });

  test("3/4 fraction", () => {
    expect(formatQuantity(0.75)).toBe("¾");
    expect(formatQuantity(2.75)).toBe("2 ¾");
  });

  test("fraction within 0.01 tolerance", () => {
    expect(formatQuantity(0.499)).toBe("½");
    expect(formatQuantity(0.501)).toBe("½");
    expect(formatQuantity(0.249)).toBe("¼");
    expect(formatQuantity(0.251)).toBe("¼");
  });

  test("arbitrary decimals not matching a fraction", () => {
    expect(formatQuantity(1.1)).toBe("1.1");
    expect(formatQuantity(0.6)).toBe("0.6");
    expect(formatQuantity(1.55)).toBe("1.55");
  });

  test("trims trailing zeros from decimals", () => {
    expect(formatQuantity(1.1)).toBe("1.1");
    expect(formatQuantity(1.1)).toBe("1.1");
  });
});

describe("scaleQuantity", () => {
  test("scales up", () => {
    expect(scaleQuantity(2, 4, 8)).toBe(4);
  });

  test("scales down", () => {
    expect(scaleQuantity(1, 4, 2)).toBe(0.5);
  });

  test("same servings returns same value", () => {
    expect(scaleQuantity(3, 4, 4)).toBe(3);
  });

  test("null quantity returns null", () => {
    expect(scaleQuantity(null, 4, 8)).toBeNull();
  });

  test("undefined quantity returns null", () => {
    expect(scaleQuantity(undefined, 4, 8)).toBeNull();
  });

  test("zero base servings returns original quantity unchanged", () => {
    expect(scaleQuantity(3, 0, 8)).toBe(3);
  });
});
