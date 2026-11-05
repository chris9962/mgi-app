import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const block = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
const token = (scope: string, name: string) => {
  const m = block(scope).match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`thiếu --${name} trong ${scope}`);
  return m[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const scope of [":root {", ':root[data-theme="dark"] {']) {
  describe(`tương phản WCAG AA ${scope}`, () => {
    const t = (n: string) => token(scope, n);
    test("chữ phụ của sidebar trên nền sidebar ≥ 4.5", () => expect(ratio(t("sidebar-ink-2"), t("sidebar"))).toBeGreaterThanOrEqual(4.5));
    test("chữ mục đang chọn trên nền mục đang chọn ≥ 4.5", () => expect(ratio(t("on-accent"), t("sidebar-active"))).toBeGreaterThanOrEqual(4.5));
    test("chữ trên nút chính ≥ 4.5", () => expect(ratio(t("on-accent"), t("accent"))).toBeGreaterThanOrEqual(4.5));
    test("viền ô nhập trên nền thẻ ≥ 3", () => expect(ratio(t("field-border"), t("card"))).toBeGreaterThanOrEqual(3));
    test("chữ mờ trên nền thẻ ≥ 4.5", () => expect(ratio(t("text-3"), t("card"))).toBeGreaterThanOrEqual(4.5));
  });
}
