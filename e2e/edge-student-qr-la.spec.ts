import { expect, test } from "@playwright/test";
import { PHONE, cameraOptions, qrCamera, withEdgeData } from "./edge-student-support";

test.use({ ...PHONE, ...cameraOptions(qrCamera("https://zalo.me/g/khong-phai-link-truong")) });
withEdgeData();

test("A16 camera thấy QR không phải link trường: báo không phải của trường, không chuyển màn", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quét mã QR" }).click();
  const dialog = page.getByRole("dialog", { name: "Quét mã QR" });
  await expect(dialog.getByRole("status")).toHaveText("Mã QR này không phải của trường.", { timeout: 20_000 });
  await expect(dialog.getByLabel("Camera")).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Chưa có trường" })).toBeVisible();
});
